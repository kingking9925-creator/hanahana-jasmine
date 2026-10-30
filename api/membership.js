'use strict';
// Vercel environment: SUPABASE_URL, SUPABASE_ANON_KEY, MEMBERS_ENABLED=true.
// Set Supabase Site URL and email confirmation before enabling.
// Payment remains unavailable until products, orders and verified callbacks are implemented.
const COOKIE = '__Host-jasmine_access';
const SITE = process.env.PUBLIC_SITE_URL || 'https://fafa-jasmineliu.vercel.app';
function clearCookie(res) { res.setHeader('Set-Cookie', COOKIE + '=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0'); }
function cookieToken(req) { const item = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(COOKIE + '=')); if (!item) return ''; try { return decodeURIComponent(item.slice(COOKIE.length + 1)); } catch { return ''; } }
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const send = (status, data) => res.status(status).json(data);
  const action = req.query && req.query.action || 'status';
  if (!['GET', 'POST'].includes(req.method)) { res.setHeader('Allow', 'GET, POST'); return send(405, {error:'不支援此請求。'}); }
  if (req.method === 'POST') {
    const origin = req.headers.origin;
    const allowed = [SITE];
    if (process.env.VERCEL_URL) allowed.push('https://' + process.env.VERCEL_URL);
    if (!origin || !allowed.includes(origin)) return send(403, {error:'請從網站頁面操作。'});
    if (!(req.headers['content-type'] || '').startsWith('application/json')) return send(415, {error:'請求格式不正確。'});
    if (Number(req.headers['content-length'] || 0) > 8192) return send(413, {error:'資料過長。'});
  }
  const ready = process.env.MEMBERS_ENABLED === 'true' && !!process.env.SUPABASE_URL && !!process.env.SUPABASE_ANON_KEY;
  if (action === 'status' && req.method === 'GET') return send(200, {authReady:ready, paymentReady:false});
  if (action === 'logout' && req.method === 'POST') { clearCookie(res); return send(200, {ok:true}); }
  if (!ready) return send(503, {error:'會員功能準備中，目前尚未開放註冊與登入。'});
  let base;
  try { base = new URL(process.env.SUPABASE_URL); if (base.protocol !== 'https:') throw new Error(); } catch { return send(503,{error:'會員服務暫時無法使用。'}); }
  const upstream = async (path, method, body, token) => {
    const response = await fetch(base.origin + '/auth/v1/' + path, {
      method, headers: {'apikey':process.env.SUPABASE_ANON_KEY, 'Content-Type':'application/json', ...(token ? {'Authorization':'Bearer ' + token} : {})},
      ...(body ? {body:JSON.stringify(body)} : {}), signal:AbortSignal.timeout(10000)
    });
    return {response, data:await response.json().catch(() => ({}))};
  };
  try {
    if (action === 'session' && req.method === 'GET') {
      const token = cookieToken(req); if (!token) return send(200,{user:null});
      const result = await upstream('user','GET',null,token);
      if (!result.response.ok) { clearCookie(res); return send(200,{user:null}); }
      return send(200,{user:{id:result.data.id,email:result.data.email}});
    }
    if (['register','login'].includes(action) && req.method === 'POST') {
      let body = req.body || {}; if (typeof body === 'string') { try {body=JSON.parse(body);}catch{return send(400,{error:'請求格式不正確。'});} }
      const email = typeof body.email === 'string' ? body.email.trim() : '';
      const password = typeof body.password === 'string' ? body.password : '';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length>254 || password.length>128 || password.length<(action==='register'?8:1)) return send(400,{error:'請檢查 Email 與密碼；註冊密碼至少 8 個字元。'});
      const result = await upstream(action==='register'?'signup':'token?grant_type=password','POST',{email,password});
      if (!result.response.ok) return send(result.response.status===429?429:400,{error:result.response.status===429?'操作太頻繁，請稍後再試。':action==='login'?'無法登入，請確認帳號、密碼與信箱驗證狀態。':'暫時無法註冊，請檢查資料或稍後再試。'});
      if (result.data.access_token) {
        const age = Math.max(1, Math.min(Number(result.data.expires_in)||3600,3600));
        res.setHeader('Set-Cookie', COOKIE+'='+encodeURIComponent(result.data.access_token)+'; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age='+age);
        return send(200,{ok:true,signedIn:true});
      }
      return send(200,{ok:true,signedIn:false,message:'請查看信箱完成驗證，再回到網站登入。若曾註冊，請直接登入。'});
    }
    if (action === 'payment') return send(503,{error:'付款方案尚未開放，目前不會建立訂單或扣款。'});
    return send(404,{error:'找不到此會員功能。'});
  } catch { return send(503,{error:'會員服務連線逾時，請稍後再試。'}); }
};
