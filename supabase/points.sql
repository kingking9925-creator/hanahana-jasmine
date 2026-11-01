-- 花花 Jasmine 會員點數 v2（依《點數使用條款》實作）
-- 在 Supabase Dashboard → SQL Editor 貼上整份執行。可重複執行（已執行過 v1 也可以直接跑）。
-- 規則：
--   付費點數（member_wallets.balance）：NT$1 = 1 點，無使用期限
--   贈送點數（point_grants）：預設 90 天到期，不退款、不折現
--   扣點順序：先扣付費點數，再扣贈送點數（先到期的先扣）
--   信用卡退單：扣回點數；不足扣回時停權並記錄欠款
-- 會員只能讀自己的資料；入帳、扣點、退單、停權只能由伺服器（service_role）執行。

-- ---------- 資料表 ----------
create table if not exists public.member_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),          -- 付費點數
  updated_at timestamptz not null default now()
);
alter table public.member_wallets add column if not exists suspended boolean not null default false;
alter table public.member_wallets add column if not exists suspend_reason text;
alter table public.member_wallets add column if not exists owed integer not null default 0 check (owed >= 0); -- 退單後尚未追回的點數（= 新台幣）

create table if not exists public.topup_orders (
  trade_no text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null check (amount > 0),
  points integer not null check (points > 0),
  status text not null default 'pending',
  payment_type text,
  ecpay_trade_no text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  notify jsonb
);
alter table public.topup_orders add column if not exists terms_version text;   -- 儲值時同意的條款版本
alter table public.topup_orders add column if not exists agreed_at timestamptz;
alter table public.topup_orders add column if not exists closed_at timestamptz;
alter table public.topup_orders add column if not exists admin_note text;
alter table public.topup_orders drop constraint if exists topup_orders_status_check;
alter table public.topup_orders add constraint topup_orders_status_check check (status in ('pending','paid','failed','refunded','chargeback'));
create index if not exists topup_orders_user_idx on public.topup_orders(user_id, created_at desc);

create table if not exists public.point_grants (                    -- 贈送點數（每一筆各自到期）
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null check (amount > 0),
  remaining integer not null check (remaining >= 0),
  expires_at timestamptz not null,
  reason text not null default 'bonus',
  ref text,
  note text,
  created_at timestamptz not null default now(),
  unique (reason, ref)
);
create index if not exists point_grants_user_idx on public.point_grants(user_id, expires_at);

create table if not exists public.point_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  delta integer not null,
  balance_after integer not null,
  reason text not null,          -- topup / bonus / game / ai / chargeback / refund / admin
  ref text,
  note text,
  created_at timestamptz not null default now()
);
alter table public.point_ledger add column if not exists kind text not null default 'paid'; -- paid / bonus
alter table public.point_ledger drop constraint if exists point_ledger_reason_ref_key;
create unique index if not exists point_ledger_once_idx on public.point_ledger(reason, ref, kind) where reason in ('topup','chargeback','refund','bonus');
create index if not exists point_ledger_user_idx on public.point_ledger(user_id, created_at desc);

alter table public.member_wallets enable row level security;
alter table public.topup_orders  enable row level security;
alter table public.point_ledger  enable row level security;
alter table public.point_grants  enable row level security;

drop policy if exists "read own wallet" on public.member_wallets;
create policy "read own wallet" on public.member_wallets for select to authenticated using (auth.uid() = user_id);
drop policy if exists "read own orders" on public.topup_orders;
create policy "read own orders" on public.topup_orders for select to authenticated using (auth.uid() = user_id);
drop policy if exists "read own ledger" on public.point_ledger;
create policy "read own ledger" on public.point_ledger for select to authenticated using (auth.uid() = user_id);
drop policy if exists "read own grants" on public.point_grants;
create policy "read own grants" on public.point_grants for select to authenticated using (auth.uid() = user_id);
-- 不建立 insert/update/delete 政策：一般會員無法自行改點數。

-- ---------- 小工具 ----------
create or replace function public._bonus_left(p_user uuid) returns integer language sql stable security definer set search_path = public as $$
  select coalesce(sum(remaining), 0)::integer from public.point_grants where user_id = p_user and remaining > 0 and expires_at > now();
$$;
create or replace function public._wallet_row(p_user uuid) returns public.member_wallets language plpgsql security definer set search_path = public as $$
declare w public.member_wallets;
begin
  insert into public.member_wallets(user_id) values (p_user) on conflict (user_id) do nothing;
  select * into w from public.member_wallets where user_id = p_user for update;
  return w;
end $$;

-- ---------- 會員看自己的錢包（前端呼叫） ----------
create or replace function public.wallet_summary() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare u uuid := auth.uid(); w public.member_wallets; b integer;
begin
  if u is null then return null; end if;
  select * into w from public.member_wallets where user_id = u;
  b := public._bonus_left(u);
  return jsonb_build_object(
    'paid', coalesce(w.balance, 0), 'bonus', b, 'total', coalesce(w.balance, 0) + b,
    'suspended', coalesce(w.suspended, false), 'suspend_reason', w.suspend_reason, 'owed', coalesce(w.owed, 0),
    'grants', coalesce((select jsonb_agg(jsonb_build_object('remaining', remaining, 'expires_at', expires_at, 'note', note) order by expires_at)
                        from public.point_grants where user_id = u and remaining > 0 and expires_at > now()), '[]'::jsonb));
end $$;

-- ---------- 綠界付款成功 → 入帳付費點數（同一筆只入帳一次） ----------
create or replace function public.credit_topup(p_trade_no text, p_amount integer, p_ecpay_trade_no text, p_payment_type text, p_notify jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare o public.topup_orders; w public.member_wallets;
begin
  select * into o from public.topup_orders where trade_no = p_trade_no for update;
  if not found then return 'not_found'; end if;
  if o.status <> 'pending' then return 'already'; end if;
  if o.amount <> p_amount then return 'amount_mismatch'; end if;
  update public.topup_orders set status = 'paid', paid_at = now(), ecpay_trade_no = p_ecpay_trade_no, payment_type = p_payment_type, notify = p_notify where trade_no = p_trade_no;
  w := public._wallet_row(o.user_id);
  update public.member_wallets set balance = balance + o.points, updated_at = now() where user_id = o.user_id returning * into w;
  insert into public.point_ledger(user_id, delta, balance_after, reason, ref, note, kind) values (o.user_id, o.points, w.balance, 'topup', p_trade_no, '儲值 NT$' || o.amount, 'paid');
  return 'ok';
end $$;

-- ---------- 扣點（遊戲／AI）：先扣付費，再扣贈送（先到期先扣） ----------
-- 回傳剩餘總點數；-1 點數不足；-2 帳號停權中
drop function if exists public.spend_points(uuid, integer, text, text, text);
create or replace function public.spend_points(p_user uuid, p_cost integer, p_reason text, p_ref text, p_note text default null)
returns integer language plpgsql security definer set search_path = public as $$
declare w public.member_wallets; b integer; from_paid integer; need integer; g record; take integer;
begin
  if p_cost <= 0 then raise exception 'cost must be positive'; end if;
  w := public._wallet_row(p_user);
  if w.suspended then return -2; end if;
  b := public._bonus_left(p_user);
  if w.balance + b < p_cost then return -1; end if;
  from_paid := least(w.balance, p_cost);
  if from_paid > 0 then
    update public.member_wallets set balance = balance - from_paid, updated_at = now() where user_id = p_user returning * into w;
    insert into public.point_ledger(user_id, delta, balance_after, reason, ref, note, kind) values (p_user, -from_paid, w.balance + b, p_reason, p_ref, p_note, 'paid');
  end if;
  need := p_cost - from_paid;
  if need > 0 then
    for g in select id, remaining from public.point_grants where user_id = p_user and remaining > 0 and expires_at > now() order by expires_at, id for update loop
      exit when need = 0;
      take := least(g.remaining, need);
      update public.point_grants set remaining = remaining - take where id = g.id;
      need := need - take;
    end loop;
    insert into public.point_ledger(user_id, delta, balance_after, reason, ref, note, kind) values (p_user, -(p_cost - from_paid), w.balance + public._bonus_left(p_user), p_reason, p_ref, p_note, 'bonus');
  end if;
  return w.balance + public._bonus_left(p_user);
end $$;

-- ---------- 發放贈送點數（活動、加贈、補償） ----------
create or replace function public.grant_bonus(p_user uuid, p_amount integer, p_days integer, p_reason text, p_ref text, p_note text)
returns integer language plpgsql security definer set search_path = public as $$
declare w public.member_wallets;
begin
  if p_amount <= 0 or p_days <= 0 then raise exception 'invalid amount/days'; end if;
  w := public._wallet_row(p_user);
  insert into public.point_grants(user_id, amount, remaining, expires_at, reason, ref, note) values (p_user, p_amount, p_amount, now() + make_interval(days => p_days), coalesce(p_reason,'bonus'), p_ref, p_note);
  insert into public.point_ledger(user_id, delta, balance_after, reason, ref, note, kind) values (p_user, p_amount, w.balance + public._bonus_left(p_user), 'bonus', p_ref, coalesce(p_note,'贈送點數') || '（' || p_days || ' 天內有效）', 'bonus');
  return w.balance + public._bonus_left(p_user);
end $$;

-- ---------- 信用卡退單：扣回點數，不足時停權並記錄欠款 ----------
create or replace function public.chargeback_order(p_trade_no text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare o public.topup_orders; w public.member_wallets; taken integer; short integer;
begin
  select * into o from public.topup_orders where trade_no = p_trade_no for update;
  if not found then return jsonb_build_object('result','not_found'); end if;
  if o.status <> 'paid' then return jsonb_build_object('result','not_paid','status',o.status); end if;
  w := public._wallet_row(o.user_id);
  taken := least(w.balance, o.points); short := o.points - taken;
  update public.member_wallets set balance = balance - taken, owed = owed + short,
    suspended = suspended or short > 0,
    suspend_reason = case when short > 0 then '信用卡退單，尚有 ' || (owed + short) || ' 點（NT$' || (owed + short) || '）未追回' else suspend_reason end,
    updated_at = now() where user_id = o.user_id returning * into w;
  update public.topup_orders set status = 'chargeback', closed_at = now(), admin_note = p_note where trade_no = p_trade_no;
  insert into public.point_ledger(user_id, delta, balance_after, reason, ref, note, kind) values (o.user_id, -taken, w.balance + public._bonus_left(o.user_id), 'chargeback', p_trade_no, '信用卡退單扣回' || case when short > 0 then '（不足 ' || short || ' 點，帳號暫停）' else '' end, 'paid');
  return jsonb_build_object('result','ok','taken',taken,'short',short,'suspended',w.suspended);
end $$;

-- ---------- 例外退款（重複扣款／盜刷／系統錯誤）：扣回該筆點數，款項由站長在綠界後台退刷 ----------
create or replace function public.refund_order(p_trade_no text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare o public.topup_orders; w public.member_wallets; taken integer;
begin
  select * into o from public.topup_orders where trade_no = p_trade_no for update;
  if not found then return jsonb_build_object('result','not_found'); end if;
  if o.status <> 'paid' then return jsonb_build_object('result','not_paid','status',o.status); end if;
  w := public._wallet_row(o.user_id);
  taken := least(w.balance, o.points);
  update public.member_wallets set balance = balance - taken, updated_at = now() where user_id = o.user_id returning * into w;
  update public.topup_orders set status = 'refunded', closed_at = now(), admin_note = p_note where trade_no = p_trade_no;
  insert into public.point_ledger(user_id, delta, balance_after, reason, ref, note, kind) values (o.user_id, -taken, w.balance + public._bonus_left(o.user_id), 'refund', p_trade_no, '例外退款：' || coalesce(p_note,''), 'paid');
  return jsonb_build_object('result','ok','taken',taken);
end $$;

-- ---------- 停權／解除停權 ----------
create or replace function public.set_suspension(p_user uuid, p_suspend boolean, p_reason text default null, p_clear_owed boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare w public.member_wallets;
begin
  w := public._wallet_row(p_user);
  update public.member_wallets set suspended = p_suspend, suspend_reason = case when p_suspend then p_reason else null end,
    owed = case when p_clear_owed then 0 else owed end, updated_at = now() where user_id = p_user returning * into w;
  return to_jsonb(w);
end $$;

-- ---------- 站長查詢 ----------
create or replace function public.admin_find_user(p_email text) returns jsonb language sql stable security definer set search_path = public, auth as $$
  select jsonb_build_object('id', u.id, 'email', u.email, 'created_at', u.created_at,
    'paid', coalesce(w.balance,0), 'bonus', public._bonus_left(u.id), 'suspended', coalesce(w.suspended,false), 'suspend_reason', w.suspend_reason, 'owed', coalesce(w.owed,0))
  from auth.users u left join public.member_wallets w on w.user_id = u.id where lower(u.email) = lower(trim(p_email)) limit 1;
$$;

-- ---------- 權限 ----------
revoke all on function public._bonus_left(uuid) from public, anon, authenticated;
revoke all on function public._wallet_row(uuid) from public, anon, authenticated;
revoke all on function public.credit_topup(text, integer, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.spend_points(uuid, integer, text, text, text) from public, anon, authenticated;
revoke all on function public.grant_bonus(uuid, integer, integer, text, text, text) from public, anon, authenticated;
revoke all on function public.chargeback_order(text, text) from public, anon, authenticated;
revoke all on function public.refund_order(text, text) from public, anon, authenticated;
revoke all on function public.set_suspension(uuid, boolean, text, boolean) from public, anon, authenticated;
revoke all on function public.admin_find_user(text) from public, anon, authenticated;
revoke all on function public.wallet_summary() from public, anon;
grant execute on function public.wallet_summary() to authenticated;
grant execute on function public._bonus_left(uuid), public._wallet_row(uuid), public.credit_topup(text, integer, text, text, jsonb),
  public.spend_points(uuid, integer, text, text, text), public.grant_bonus(uuid, integer, integer, text, text, text),
  public.chargeback_order(text, text), public.refund_order(text, text), public.set_suspension(uuid, boolean, text, boolean),
  public.admin_find_user(text) to service_role;
