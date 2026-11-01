'use strict';
// 會員：註冊、登入（自動續期 30 天）、登出、個人資料、頭像
// Vercel 環境變數：SUPABASE_URL、SUPABASE_ANON_KEY、MEMBERS_ENABLED=true；
//   個人資料／頭像需要 SUPABASE_SERVICE_ROLE_KEY（只放 Vercel）
const { setSession, clearSession, getUser } = require('./_auth');
const FAVS = ['frontia','flai','ashbone','quarterfull','hana-realm'];
const SITE = process.env.PUBLIC_SITE_URL || 'https://fafa-jasmineliu.vercel.app';
const GENDERS = ['', '女', '男', '其他', '不透露'];
const PRESET_AVATARS = ['🌸','🐰','🐱','🐶','🦊','🐻','🐼','🦄','🐥','🍓','🌙','⭐'];

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
    if (Number(req.headers['content-length'] || 0) > (action === 'avatar' ? 160000 : 8192)) return send(413, {error:'資料過長。'});
  }
  const ready = process.env.MEMBERS_ENABLED === 'true' && !!process.env.SUPABASE_URL && !!process.env.SUPABASE_ANON_KEY;
  if (action === 'status' && req.method === 'GET') return send(200, {authReady:ready, paymentReady:false});
  if (action === 'logout' && req.method === 'POST') { clearSession(res); return send(200, {ok:true}); }
  if (!ready) return send(503, {error:'會員功能準備中，目前尚未開放註冊與登入。'});
  let base;
  try { const u = new URL(process.env.SUPABASE_URL); if (u.protocol !== 'https:') throw new Error(); base = u.origin; } catch { return send(503,{error:'會員服務暫時無法使用。'}); }
  const anon = process.env.SUPABASE_ANON_KEY, service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const upstream = async (path, method, body, token) => {
    const response = await fetch(base + '/auth/v1/' + path, {
      method, headers: {'apikey':anon, 'Content-Type':'application/json', ...(token ? {'Authorization':'Bearer ' + token} : {})},
      ...(body ? {body:JSON.stringify(body)} : {}), signal:AbortSignal.timeout(10000)
    });
    return {response, data:await response.json().catch(() => ({}))};
  };
  const admin = async (path, method = 'GET', body, prefer) => {
    const r = await fetch(base + '/rest/v1/' + path, { method, headers: { apikey: service, Authorization: 'Bearer ' + service, 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(10000) });
    const text = await r.text(); let data = null; try { data = text ? JSON.parse(text) : null; } catch {}
    return { ok: r.ok, data };
  };
  const readBody = () => { let b = req.body || {}; if (typeof b === 'string') { try { b = JSON.parse(b); } catch { return null; } } return b; };
  const getProfile = async id => { if (!service) return null; const r = await admin('member_profiles?select=avatar,real_name,birthday,gender,phone,address&user_id=eq.' + id); return r.ok ? (r.data[0] || {}) : null; };
  const saveProfile = async (id, patch) => { patch.updated_at = new Date().toISOString(); return admin('member_profiles?on_conflict=user_id', 'POST', { user_id: id, ...patch }, 'resolution=merge-duplicates,return=minimal'); };

  try {
    if (action === 'session' && req.method === 'GET') {
      const user = await getUser(req, res, base, anon);
      if (!user) return send(200,{user:null});
      const md = user.raw.user_metadata || {};
      return send(200,{user:{id:user.id,email:user.email,createdAt:user.raw.created_at,nickname:typeof md.nickname==='string'?md.nickname:'',avatarPreset:PRESET_AVATARS.includes(md.avatar_preset)?md.avatar_preset:'',theme:['light','dark','system'].includes(md.theme)?md.theme:'',favorites:Array.isArray(md.favorites)?md.favorites.filter(f=>FAVS.includes(f)):[]}});
    }
    if (['register','login'].includes(action) && req.method === 'POST') {
      const body = readBody(); if (!body) return send(400,{error:'請求格式不正確。'});
      const email = typeof body.email === 'string' ? body.email.trim() : '';
      const password = typeof body.password === 'string' ? body.password : '';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length>254 || password.length>128 || password.length<(action==='register'?8:1)) return send(400,{error:'請檢查 Email 與密碼；註冊密碼至少 8 個字元。'});
      const result = await upstream(action==='register'?'signup?redirect_to='+encodeURIComponent(SITE+'/member.html?verified=1'):'token?grant_type=password','POST',{email,password});
      if (!result.response.ok) return send(result.response.status===429?429:400,{error:result.response.status===429?'操作太頻繁，請稍後再試。':action==='login'?'無法登入，請確認帳號、密碼與信箱驗證狀態。':'暫時無法註冊，請檢查資料或稍後再試。'});
      if (result.data.access_token) { setSession(res, result.data); return send(200,{ok:true,signedIn:true}); }
      return send(200,{ok:true,signedIn:false,message:'驗證信已寄出！請到信箱點「驗證我的信箱」，完成後會自動回到會員頁面登入。若曾註冊過，請直接登入。'});
    }

    // 以下都需要登入
    const user = await getUser(req, res, base, anon);
    if (!user) return send(401,{error:'請先登入會員。'});

    // 私人資料（只有本人和站長看得到）
    if (action === 'private' && req.method === 'GET') {
      const p = await getProfile(user.id);
      if (!p) return send(503,{error:'個人資料功能尚未開通。'});
      return send(200,{profile:{avatar:p.avatar||'',realName:p.real_name||'',birthday:p.birthday||'',birthdayLocked:!!p.birthday,gender:p.gender||'',phone:p.phone||'',address:p.address||''}});
    }
    if (action === 'private' && req.method === 'POST') {
      if (!service) return send(503,{error:'個人資料功能尚未開通。'});
      const b = readBody(); if (!b) return send(400,{error:'請求格式不正確。'});
      const cur = await getProfile(user.id) || {};
      const patch = {};
      const str = (v, max) => typeof v === 'string' ? v.trim().slice(0, max) : undefined;
      if (b.realName !== undefined) { const v = str(b.realName, 30); if (v === undefined || /[<>]/.test(v)) return send(400,{error:'姓名格式不正確。'}); patch.real_name = v || null; }
      if (b.gender !== undefined) { if (!GENDERS.includes(b.gender)) return send(400,{error:'性別選項不正確。'}); patch.gender = b.gender || null; }
      if (b.phone !== undefined) { const v = str(b.phone, 20); if (v && !/^[0-9+\-() ]{6,20}$/.test(v)) return send(400,{error:'手機號碼格式不正確。'}); patch.phone = v || null; }
      if (b.address !== undefined) { const v = str(b.address, 120); if (v === undefined || /[<>]/.test(v)) return send(400,{error:'地址格式不正確。'}); patch.address = v || null; }
      if (b.birthday) {
        if (cur.birthday) { if (b.birthday !== cur.birthday) return send(400,{error:'生日設定後無法自行修改，如需更正請聯繫花花。'}); }
        else {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(b.birthday)) return send(400,{error:'生日格式不正確。'});
          const d = new Date(b.birthday + 'T00:00:00Z'); const y = d.getUTCFullYear();
          if (isNaN(d) || d.toISOString().slice(0,10) !== b.birthday || y < 1900 || d > new Date()) return send(400,{error:'生日日期不正確。'});
          patch.birthday = b.birthday;
        }
      }
      if (!Object.keys(patch).length) return send(400,{error:'沒有要更新的資料。'});
      const r = await saveProfile(user.id, patch);
      return r.ok ? send(200,{ok:true}) : send(503,{error:'儲存失敗，請稍後再試。'});
    }
    if (action === 'avatar' && req.method === 'POST') {
      const b = readBody(); if (!b) return send(400,{error:'請求格式不正確。'});
      if (typeof b.preset === 'string') {
        if (b.preset && !PRESET_AVATARS.includes(b.preset)) return send(400,{error:'頭像選項不正確。'});
        const md = await upstream('user','PUT',{data:{avatar_preset:b.preset}},user.token);
        if (!md.response.ok) return send(400,{error:'更新失敗，請重新登入後再試。'});
        if (service) await saveProfile(user.id, { avatar: null });
        return send(200,{ok:true});
      }
      if (!service) return send(503,{error:'上傳頭像功能尚未開通。'});
      const img = typeof b.image === 'string' ? b.image : '';
      if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(img) || img.length > 150000) return send(400,{error:'圖片格式不正確或檔案太大。'});
      const r = await saveProfile(user.id, { avatar: img });
      if (r.ok) await upstream('user','PUT',{data:{avatar_preset:''}},user.token);
      return r.ok ? send(200,{ok:true}) : send(503,{error:'儲存失敗，請稍後再試。'});
    }
    if (action === 'profile' && req.method === 'POST') {
      const body = readBody(); if (!body) return send(400,{error:'請求格式不正確。'});
      const data = {};
      if (typeof body.nickname === 'string') { const n = body.nickname.trim(); if (n.length > 20 || /[<>]/.test(n)) return send(400,{error:'暱稱最多 20 個字，且不能包含 < >。'}); data.nickname = n; }
      if (typeof body.theme === 'string') { if (!['light','dark','system'].includes(body.theme)) return send(400,{error:'主題設定不正確。'}); data.theme = body.theme; }
      if (Array.isArray(body.favorites)) { data.favorites = [...new Set(body.favorites.filter(x=>FAVS.includes(x)))]; }
      if (!Object.keys(data).length) return send(400,{error:'沒有要更新的資料。'});
      const result = await upstream('user','PUT',{data},user.token);
      if (!result.response.ok) return send(result.response.status===401?401:400,{error:'更新失敗，請重新登入後再試。'});
      return send(200,{ok:true});
    }
    if (action === 'payment') return send(503,{error:'付款方案尚未開放，目前不會建立訂單或扣款。'});
    return send(404,{error:'找不到此會員功能。'});
  } catch { return send(503,{error:'會員服務連線逾時，請稍後再試。'}); }
};
