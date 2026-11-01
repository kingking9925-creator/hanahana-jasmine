-- 花花 Jasmine 會員點數（NT$1 = 1 點）
-- 在 Supabase Dashboard → SQL Editor 貼上整份執行一次即可。
-- 會員只能「讀」自己的資料；入帳、扣點只能由伺服器（service_role）執行。

create table if not exists public.member_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.topup_orders (
  trade_no text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null check (amount > 0),
  points integer not null check (points > 0),
  status text not null default 'pending' check (status in ('pending','paid','failed')),
  payment_type text,
  ecpay_trade_no text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  notify jsonb
);
create index if not exists topup_orders_user_idx on public.topup_orders(user_id, created_at desc);

create table if not exists public.point_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  delta integer not null,
  balance_after integer not null,
  reason text not null,          -- topup / game / ai / admin
  ref text,                      -- 訂單編號或用途代碼
  note text,
  created_at timestamptz not null default now(),
  unique (reason, ref)
);
create index if not exists point_ledger_user_idx on public.point_ledger(user_id, created_at desc);

alter table public.member_wallets enable row level security;
alter table public.topup_orders  enable row level security;
alter table public.point_ledger  enable row level security;

drop policy if exists "read own wallet" on public.member_wallets;
create policy "read own wallet" on public.member_wallets for select to authenticated using (auth.uid() = user_id);
drop policy if exists "read own orders" on public.topup_orders;
create policy "read own orders" on public.topup_orders for select to authenticated using (auth.uid() = user_id);
drop policy if exists "read own ledger" on public.point_ledger;
create policy "read own ledger" on public.point_ledger for select to authenticated using (auth.uid() = user_id);
-- 不建立 insert/update/delete 政策：一般會員無法自行改點數。

-- 綠界付款成功通知 → 入帳（同一筆訂單只會入帳一次）
create or replace function public.credit_topup(p_trade_no text, p_amount integer, p_ecpay_trade_no text, p_payment_type text, p_notify jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare o public.topup_orders; nb integer;
begin
  select * into o from public.topup_orders where trade_no = p_trade_no for update;
  if not found then return 'not_found'; end if;
  if o.status = 'paid' then return 'already'; end if;
  if o.amount <> p_amount then return 'amount_mismatch'; end if;
  update public.topup_orders set status = 'paid', paid_at = now(), ecpay_trade_no = p_ecpay_trade_no, payment_type = p_payment_type, notify = p_notify where trade_no = p_trade_no;
  insert into public.member_wallets(user_id, balance) values (o.user_id, o.points)
    on conflict (user_id) do update set balance = public.member_wallets.balance + excluded.balance, updated_at = now()
    returning balance into nb;
  insert into public.point_ledger(user_id, delta, balance_after, reason, ref, note) values (o.user_id, o.points, nb, 'topup', p_trade_no, '儲值 NT$' || o.amount);
  return 'ok';
end $$;

-- 之後遊戲／AI 扣點用（點數不足會回傳 -1）
create or replace function public.spend_points(p_user uuid, p_cost integer, p_reason text, p_ref text, p_note text default null)
returns integer language plpgsql security definer set search_path = public as $$
declare nb integer;
begin
  if p_cost <= 0 then raise exception 'cost must be positive'; end if;
  update public.member_wallets set balance = balance - p_cost, updated_at = now()
    where user_id = p_user and balance >= p_cost returning balance into nb;
  if nb is null then return -1; end if;
  insert into public.point_ledger(user_id, delta, balance_after, reason, ref, note) values (p_user, -p_cost, nb, p_reason, p_ref, p_note);
  return nb;
end $$;

revoke all on function public.credit_topup(text, integer, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.spend_points(uuid, integer, text, text, text) from public, anon, authenticated;
grant execute on function public.credit_topup(text, integer, text, text, jsonb) to service_role;
grant execute on function public.spend_points(uuid, integer, text, text, text) to service_role;
