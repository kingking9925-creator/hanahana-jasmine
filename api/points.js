'use strict';
// 會員點數（NT$1 = 1 點）＋ 綠界 ECPay 全方位金流儲值
// Vercel 環境變數：
//   SUPABASE_URL、SUPABASE_ANON_KEY（已有）、SUPABASE_SERVICE_ROLE_KEY（新增，只放 Vercel，絕不放前端或 Git）
//   ECPAY_ENV = stage（測試，預設）或 prod（正式收款）
//   ECPAY_MERCHANT_ID、ECPAY_HASH_KEY、ECPAY_HASH_IV（正式環境必填；測試環境未填時使用綠界公開測試帳號）
//   POINTS_ENABLED = true 才開放儲值
const crypto = require('crypto');
const COOKIE = '__Host-jasmine_access';
const SITE = process.env.PUBLIC_SITE_URL || 'https://fafa-jasmineliu.vercel.app';
const PACKAGES = [50, 150, 300, 600, 1500];      // NT$ = 點數
const STAGE = { id: '3002607', key: 'pwFHCqoQZGmho4w6', iv: 'EkRm7iFT261dpevs' }; // 綠界公開測試商店

function ecpayConf() {
  const prod = process.env.ECPAY_ENV === 'prod';
  const id = process.env.ECPAY_MERCHANT_ID || (prod ? '' : STAGE.id);
  const key = process.env.ECPAY_HASH_KEY || (prod ? '' : STAGE.key);
  const iv = process.env.ECPAY_HASH_IV || (prod ? '' : STAGE.iv);
  return { prod, id, key, iv, url: prod ? 'https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5' : 'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5' };
}
// 綠界 .NET 相容 URL encode（已用官方範例驗證）
function ecEncode(s) { return encodeURIComponent(s).replace(/%20/g, '+').replace(/'/g, '%27').replace(/~/g, '%7e').toLowerCase(); }
function checkMac(params, key, iv) {
  const keys = Object.keys(params).filter(k => k !== 'CheckMacValue').sort((a, b) => { const x = a.toLowerCase(), y = b.toLowerCase(); return x < y ? -1 : x > y ? 1 : 0; });
  const raw = 'HashKey=' + key + '&' + keys.map(k => k + '=' + params[k]).join('&') + '&HashIV=' + iv;
  return crypto.createHash('sha256').update(ecEncode(raw)).digest('hex').toUpperCase();
}
function safeEq(a, b) { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); }
function cookieToken(req) { const item = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(COOKIE + '=')); if (!item) return ''; try { return decodeURIComponent(item.slice(COOKIE.length + 1)); } catch { return ''; } }
function twTime(d = new Date()) { const t = new Date(d.getTime() + 8 * 3600e3); const p = n => String(n).padStart(2, '0'); return `${t.getUTCFullYear()}/${p(t.getUTCMonth() + 1)}/${p(t.getUTCDate())} ${p(t.getUTCHours())}:${p(t.getUTCMinutes())}:${p(t.getUTCSeconds())}`; }

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const action = (req.query && req.query.action) || 'status';
  const send = (s, d) => res.status(s).json(d);
  const base = process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).origin : '';
  const anon = process.env.SUPABASE_ANON_KEY, service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const conf = ecpayConf();
  const ready = process.env.POINTS_ENABLED === 'true' && !!base && !!anon && !!service && !!conf.id && !!conf.key && !!conf.iv;
  const rest = async (path, { method = 'GET', body, token, admin, prefer } = {}) => {
    const key = admin ? service : anon;
    const r = await fetch(base + '/rest/v1/' + path, { method, headers: { apikey: key, Authorization: 'Bearer ' + (admin ? service : token), 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(10000) });
    const text = await r.text(); let data = null; try { data = text ? JSON.parse(text) : null; } catch {}
    return { ok: r.ok, status: r.status, data };
  };
  const currentUser = async () => {
    const token = cookieToken(req); if (!token || !base) return null;
    const r = await fetch(base + '/auth/v1/user', { headers: { apikey: anon, Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(10000) });
    if (!r.ok) return null; const u = await r.json(); return { id: u.id, email: u.email, token };
  };

  try {
    // ---------- 綠界付款結果通知（伺服器對伺服器） ----------
    if (action === 'notify') {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      if (req.method !== 'POST' || !ready) return res.status(400).send('0|NotReady');
      let p = req.body || {};
      if (typeof p === 'string') p = Object.fromEntries(new URLSearchParams(p));
      if (!p.CheckMacValue || !safeEq(checkMac(p, conf.key, conf.iv), p.CheckMacValue)) return res.status(400).send('0|CheckMacValueError');
      if (p.MerchantID !== conf.id) return res.status(400).send('0|MerchantError');
      if (String(p.RtnCode) !== '1') return res.status(200).send('1|OK');            // 未付款成功（例：取號）不入帳
      if (conf.prod && String(p.SimulatePaid) === '1') return res.status(200).send('1|OK'); // 正式環境忽略模擬付款
      const r = await rest('rpc/credit_topup', { method: 'POST', admin: true, body: { p_trade_no: String(p.MerchantTradeNo), p_amount: Number(p.TradeAmt), p_ecpay_trade_no: String(p.TradeNo || ''), p_payment_type: String(p.PaymentType || ''), p_notify: p } });
      if (!r.ok) return res.status(500).send('0|DBError');
      return res.status(200).send(['ok', 'already'].includes(r.data) ? '1|OK' : '0|' + r.data);
    }

    if (action === 'status' && req.method === 'GET') return send(200, { pointsReady: ready, env: conf.prod ? 'prod' : 'stage', packages: PACKAGES, rate: 1 });
    if (!ready) return send(503, { error: '點數儲值準備中，尚未開放。' });

    if (req.method === 'POST') {
      const allowed = [SITE]; if (process.env.VERCEL_URL) allowed.push('https://' + process.env.VERCEL_URL);
      if (!allowed.includes(req.headers.origin)) return send(403, { error: '請從網站頁面操作。' });
    }
    const user = await currentUser();
    if (!user) return send(401, { error: '請先登入會員。' });

    // ---------- 我的點數 ----------
    if (action === 'wallet' && req.method === 'GET') {
      const [w, l, o] = await Promise.all([
        rest('member_wallets?select=balance&user_id=eq.' + user.id, { token: user.token }),
        rest('point_ledger?select=delta,balance_after,reason,ref,note,created_at&order=created_at.desc&limit=30', { token: user.token }),
        rest('topup_orders?select=trade_no,amount,points,status,payment_type,created_at,paid_at&order=created_at.desc&limit=10', { token: user.token })
      ]);
      if (!w.ok || !l.ok || !o.ok) return send(503, { error: '點數資料讀取失敗，請稍後再試。' });
      return send(200, { balance: (w.data[0] && w.data[0].balance) || 0, ledger: l.data, orders: o.data, packages: PACKAGES, env: conf.prod ? 'prod' : 'stage' });
    }

    // ---------- 建立儲值訂單 → 回傳綠界付款表單 ----------
    if (action === 'topup' && req.method === 'POST') {
      let body = req.body || {}; if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
      const amount = Number(body.amount);
      if (!PACKAGES.includes(amount)) return send(400, { error: '請選擇儲值方案。' });
      const since = new Date(Date.now() - 10 * 60e3).toISOString();
      const recent = await rest(`topup_orders?select=trade_no&user_id=eq.${user.id}&status=eq.pending&created_at=gte.${since}`, { admin: true });
      if (recent.ok && recent.data.length >= 5) return send(429, { error: '建立訂單太頻繁，請稍後再試。' });
      const tradeNo = 'HJ' + Date.now().toString(36).toUpperCase() + crypto.randomBytes(3).toString('hex').toUpperCase(); // ≤20 碼
      const ins = await rest('topup_orders', { method: 'POST', admin: true, prefer: 'return=minimal', body: { trade_no: tradeNo, user_id: user.id, amount, points: amount } });
      if (!ins.ok) return send(503, { error: '建立訂單失敗，請稍後再試。' });
      const params = {
        MerchantID: conf.id, MerchantTradeNo: tradeNo, MerchantTradeDate: twTime(), PaymentType: 'aio',
        TotalAmount: String(amount), TradeDesc: '花花Jasmine會員點數儲值', ItemName: `花花 Jasmine 會員點數 ${amount} 點`,
        ReturnURL: SITE + '/api/points?action=notify', ChoosePayment: 'ALL', EncryptType: '1',
        ClientBackURL: SITE + '/member.html?tab=points&trade=' + tradeNo, NeedExtraPaidInfo: 'N'
      };
      params.CheckMacValue = checkMac(params, conf.key, conf.iv);
      return send(200, { action: conf.url, fields: params, tradeNo });
    }
    return send(404, { error: '找不到此功能。' });
  } catch (e) {
    if (action === 'notify') return res.status(500).send('0|Error');
    return send(503, { error: '服務連線逾時，請稍後再試。' });
  }
};
module.exports.checkMac = checkMac; // 測試用
