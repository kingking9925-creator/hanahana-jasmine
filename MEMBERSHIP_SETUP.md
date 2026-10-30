# 會員與付款串接狀態

目前首頁載入 members.js。右上角提供註冊會員與登入，視窗另有會員與付款分頁。
api/membership.js 是 Vercel Node.js Function，支援 status、register、login、session、logout。
目前預設關閉註冊登入，付款未實作，不會建立訂單、扣款或開通付費權益。

## 開放會員前

1. 建立或選擇站主擁有的 Supabase 專案，啟用 Email/password 登入與 Email 驗證。
2. 在 Supabase Authentication 設定正確的正式 Site URL，測試驗證信的寄送與登入。
3. 在對應 Vercel 專案設定 SUPABASE_URL 與 SUPABASE_ANON_KEY，使用公開 anon/publishable 金鑰；不要使用 service_role 金鑰。
4. PUBLIC_SITE_URL 設為 https://fafa-jasmineliu.vercel.app（換網域時同步調整）。
5. 正式開放前補齊會員服務條款、隱私告知及必要的防濫用設定，完成真實測試帳號流程後才設定 MEMBERS_ENABLED=true 並重新部署。
6. 目前登入 Cookie 最多一小時，過期需重新登入。帳號復原目前由客服協助，尚未實作站內忘記密碼流程。

密碼不會寫入瀏覽器儲存空間；會員 access token 放在 Secure、HttpOnly、SameSite=Lax Cookie。
啟用前仍須在實際 Supabase 與 Vercel 環境驗證，不能把本機模擬測試視為實際帳號測試。
目前 members.js 只接在首頁；其他頁面尚未載入會員入口。

## 付款尚待實作

先確認綠界商店審核狀態與可用付款方式，再確定商品名稱、價格、單次或訂閱、退款及服務條款。
接著實作伺服器建立訂單、商店簽章、綠界付款回呼驗證、持久化訂單紀錄、重複通知處理與會員權益開通。
收款金鑰只放 Vercel 環境變數；不得放入 HTML、members.js 或 Git。
不得把前端返回成功頁當作付款成功依據。
在以上工作完成前，保留「尚未開放付款」狀態，不要收取真實款項。
