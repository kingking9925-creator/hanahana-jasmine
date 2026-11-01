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

## 會員點數（NT$1 = 1 點）＋ 綠界儲值

已實作：`api/points.js`（建立綠界訂單、接收付款通知並入帳、查詢點數）、`member.html`（會員頁面：點數、儲值、紀錄、我的遊戲、設定）、`supabase/points.sql`（資料表與入帳函式）。
儲值方案：50／150／300／600／1500，付款方式 ALL（信用卡、ATM、超商代碼等，由綠界頁面選擇）。
入帳只依據綠界伺服器通知（ReturnURL）並驗證 CheckMacValue；從綠界返回網站的頁面不會當作付款成功。同一筆訂單只會入帳一次。

### 開通步驟（先測試環境）
1. Supabase → SQL Editor：貼上 `supabase/points.sql` 全部內容執行一次。
2. Supabase → Project Settings → API：複製 `service_role` 金鑰。
3. Vercel → 專案 → Settings → Environment Variables 新增：
   - `SUPABASE_SERVICE_ROLE_KEY` = 上一步的金鑰（只放這裡，絕不貼到聊天室、HTML 或 GitHub）
   - `ECPAY_ENV` = `stage`
   - `POINTS_ENABLED` = `true`
   - `ADMIN_EMAILS` = 你的會員 Email（站長，可用逗號分隔多個），才能使用 `admin-points.html` 點數管理
4. Vercel 重新部署（Deployments → 最新一筆 → Redeploy）。
5. 登入會員 → 會員頁面 → 點數 → 選方案，用綠界測試信用卡付款：卡號 4311-9522-2222-2222、有效期限填未來日期、安全碼 222、3D 驗證碼 1234。
6. 確認點數紀錄出現「儲值」、餘額增加。

### 切換正式收款
1. 在綠界廠商後台取得正式 MerchantID、HashKey、HashIV。
2. Vercel 環境變數新增 `ECPAY_MERCHANT_ID`、`ECPAY_HASH_KEY`、`ECPAY_HASH_IV`，並把 `ECPAY_ENV` 改成 `prod`，重新部署。
3. 先用小額（NT$50）實際付款一次確認入帳。
4. 正式開放前，補上點數使用條款（用途、有效期限、退款方式等）。

### 之後遊戲／AI 扣點
伺服器端呼叫 Supabase `spend_points(user_id, 點數, 'game' 或 'ai', 用途代碼)`；點數不足回傳 -1。只能用 service_role 呼叫，前端無法自行扣點或加點。

## 暗夜模式
`theme.js` 已載入全站每一頁。會員頁面 → 設定 → 外觀主題可選「亮色／暗夜模式／跟隨系統」，存在瀏覽器，登入時也會存到會員帳號（Supabase user_metadata.theme）。

## 點數制度 v2（依《點數使用條款》實作）
- 付費點數無期限；贈送點數每筆各自到期（預設 90 天），過期自動不能使用。
- 扣點順序：先扣付費點數，再扣贈送點數（先到期的先扣）。函式：`spend_points`（回傳 -1 點數不足、-2 帳號停權）。
- 儲值時記錄同意的條款版本（`topup_orders.terms_version`、`agreed_at`）。修改條款時，把 `api/points.js` 的 `TERMS_VERSION` 一起更新。
- 停權中的帳號不能儲值、不能扣點。
- 站長頁 `admin-points.html`（需登入且在 ADMIN_EMAILS 名單內）：
  - 查詢會員點數與停權狀態
  - 發送贈送點數（可設天數與原因）
  - 信用卡退單：扣回該筆點數，不足時自動停權並記錄欠款
  - 例外退款（重複扣款／盜刷／系統錯誤）：扣回點數並標記退款，款項請到綠界廠商後台退刷
  - 停權／解除停權（可一併清除欠款）
- 已執行過舊版 `points.sql` 也沒關係，直接再貼一次新版執行即可（可重複執行）。
