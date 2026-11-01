'use strict';
// 共用：會員登入狀態（檔名底線開頭，Vercel 不會把它當成 API 網址）
// access token（約 1 小時）＋ refresh token（30 天）都放在 HttpOnly Cookie；
// access 過期時自動用 refresh 換新的，會員不會每小時被登出。
const ACCESS = '__Host-jasmine_access';
const REFRESH = '__Host-jasmine_refresh';
const REFRESH_DAYS = 30;

function getCookie(req, name) {
  const item = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(name + '='));
  if (!item) return '';
  try { return decodeURIComponent(item.slice(name.length + 1)); } catch { return ''; }
}
function cookieStr(name, value, maxAge) { return `${name}=${encodeURIComponent(value)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`; }
function setSession(res, data) {
  const age = Math.max(60, Math.min(Number(data.expires_in) || 3600, 3600));
  const cookies = [cookieStr(ACCESS, data.access_token, age)];
  if (data.refresh_token) cookies.push(cookieStr(REFRESH, data.refresh_token, REFRESH_DAYS * 86400));
  res.setHeader('Set-Cookie', cookies);
}
function clearSession(res) { res.setHeader('Set-Cookie', [cookieStr(ACCESS, '', 0), cookieStr(REFRESH, '', 0)]); }

// 取得目前登入的會員；必要時自動續期。回傳 { id, email, token, raw } 或 null
async function getUser(req, res, base, anon) {
  if (!base || !anon) return null;
  const token = getCookie(req, ACCESS);
  if (token) {
    const r = await fetch(base + '/auth/v1/user', { headers: { apikey: anon, Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(10000) });
    if (r.ok) { const u = await r.json(); return { id: u.id, email: u.email, token, raw: u }; }
  }
  const rt = getCookie(req, REFRESH);
  if (!rt) { if (token) clearSession(res); return null; }
  const r = await fetch(base + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: { apikey: anon, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: rt }), signal: AbortSignal.timeout(10000) });
  if (!r.ok) { clearSession(res); return null; }
  const d = await r.json();
  if (!d.access_token || !d.user) { clearSession(res); return null; }
  setSession(res, d);
  return { id: d.user.id, email: d.user.email, token: d.access_token, raw: d.user };
}

module.exports = { ACCESS, REFRESH, getCookie, setSession, clearSession, getUser };
