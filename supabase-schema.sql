-- RF FIOS PREMIUM: esquema inicial do banco Supabase
create extension if not exists pgcrypto;

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric(10,2) not null default 0 check (price >= 0),
  duration_minutes integer not null default 60 check (duration_minutes > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  phone text not null,
  service_id uuid not null references public.services(id),
  booking_date date not null,
  start_time time not null,
  notes text,
  status text not null default 'pending' check (status in ('pending','confirmed','cancelled')),
  created_at timestamptz not null default now(),
  unique (booking_date, start_time)
);

alter table public.services enable row level security;
alter table public.appointments enable row level security;

-- Catálogo público; somente usuários autenticados administram serviços.
create policy "Public can view active services" on public.services
for select using (active = true);
create policy "Admins manage services" on public.services
for all to authenticated using (true) with check (true);

-- Clientes podem solicitar horário, mas não podem ler a lista de clientes.
create policy "Public can request appointment" on public.appointments
for insert to anon, authenticated
with check (status = 'pending');
create policy "Admins view appointments" on public.appointments
for select to authenticated using (true);
create policy "Admins update appointments" on public.appointments
for update to authenticated using (true) with check (true);

-- Retorna somente os horários já ocupados, sem expor dados pessoais.
create or replace function public.get_busy_slots(booking_date date)
returns table(start_time time)
language sql
security definer
set search_path = public
as $$
  select a.start_time
  from public.appointments a
  where a.booking_date = get_busy_slots.booking_date
    and a.status <> 'cancelled';
$$;
grant execute on function public.get_busy_slots(date) to anon, authenticated;

insert into public.services(name,price,duration_minutes) values
('Corte e escova',0,60),
('Coloração',0,120),
('Tratamento capilar',0,90),
('Unhas',0,60),
('Sobrancelhas',0,30)
on conflict do nothing;
