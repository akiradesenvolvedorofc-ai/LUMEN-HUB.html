
-- LUMEN HUB + SUPABASE
-- Cole tudo no SQL Editor do seu projeto Supabase e clique em Run.
create extension if not exists pgcrypto;

create table if not exists public.config (
  id integer primary key default 1 check (id = 1),
  name text not null default 'Lumen Hub',
  tag text not null default 'Tudo para Roblox em um só lugar. Scripts testados, executores atualizados e suporte rápido.',
  logo text not null default '',
  a text not null default '#ff2d3d',
  b text not null default '#ff7a45',
  bg text not null default '#050305',
  radius integer not null default 20,
  light boolean not null default false,
  discord text not null default 'https://discord.gg/seu-convite',
  insta text not null default 'https://instagram.com/seuperfil',
  footer text not null default '© Lumen Hub. Todos os direitos reservados.'
);

create table if not exists public.scripts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  game text not null default 'Universal',
  price numeric(10,2) not null default 0 check (price >= 0),
  description text not null default '',
  img text not null default '',
  code text not null default '',
  hot boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.execs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plat text not null default '',
  status text not null default 'Online',
  description text not null default '',
  link text not null default '#',
  created_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  avatar text not null default '',
  rating integer not null check (rating between 1 and 5),
  text text not null check (char_length(text) between 5 and 300),
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  unique(user_id)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','paid','cancelled')),
  total numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  script_id uuid not null references public.scripts(id) on delete restrict,
  name text not null,
  price numeric(10,2) not null check (price >= 0)
);

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  username text not null default 'Cliente',
  avatar text not null default '',
  status text not null default 'open' check (status in ('open','closed')),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.tickets add column if not exists username text not null default 'Cliente';
alter table public.tickets add column if not exists avatar text not null default '';

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  sender_user_id uuid references auth.users(id) on delete set null,
  sender_role text not null check (sender_role in ('user','staff')),
  text text not null check (char_length(text) between 1 and 800),
  created_at timestamptz not null default now()
);

create index if not exists idx_scripts_game on public.scripts(game);
create index if not exists idx_orders_user on public.orders(user_id);
create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_order_items_order on public.order_items(order_id);
create index if not exists idx_tickets_user on public.tickets(user_id);
create index if not exists idx_messages_ticket on public.messages(ticket_id);

insert into public.config(id) values (1) on conflict (id) do nothing;

insert into public.scripts(name,game,price,hot,description,code)
select * from (values
('Auto Farm Pro','Blox Fruits',0,true,'Farm automático de level, frutas e baús.','-- Cole aqui o seu script' || chr(10) || 'print("Auto Farm Pro")'),
('God Raid Hub','Blox Fruits',9.99,true,'Raids automáticas com troca de fruta.','-- Cole aqui o seu script' || chr(10) || 'print("God Raid Hub")'),
('Garden Boost','Grow a Garden',0,false,'Planta, colhe e vende sozinho.','-- Cole aqui o seu script' || chr(10) || 'print("Garden Boost")'),
('Night Survivor','99 Noites',6.50,true,'Coleta recursos e evita perigos.','-- Cole aqui o seu script' || chr(10) || 'print("Night Survivor")'),
('Piece Master','Sailor Piece',12.90,false,'Missões e bosses automáticos.','-- Cole aqui o seu script' || chr(10) || 'print("Piece Master")'),
('Haven Tools','Brookhaven',0,false,'Utilidades para roleplay.','-- Cole aqui o seu script' || chr(10) || 'print("Haven Tools")')
) as x(name,game,price,hot,description,code)
where not exists (select 1 from public.scripts);

insert into public.execs(name,plat,status,description,link)
select * from (values
('Executor Exemplo A','PC','Online','Estável e rápido. Substitua pelos seus dados.','#'),
('Executor Exemplo B','Android','Online','Versão mobile com atualizações semanais.','#'),
('Executor Exemplo C','iOS','Atualizando','Em manutenção após atualização do jogo.','#')
) as x(name,plat,status,description,link)
where not exists (select 1 from public.execs);

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.get_script_code(p_script_id uuid)
returns text
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_code text;
  v_price numeric;
  v_owned boolean := false;
begin
  select code, price into v_code, v_price
  from public.scripts where id = p_script_id;

  if v_code is null then return null; end if;
  if coalesce(v_price,0) = 0 or public.is_admin() then return v_code; end if;

  if auth.uid() is not null then
    select exists(
      select 1
      from public.orders o
      join public.order_items oi on oi.order_id=o.id
      where o.user_id=auth.uid()
        and o.status='paid'
        and oi.script_id=p_script_id
    ) into v_owned;
  end if;

  if v_owned then return v_code; end if;
  return null;
end;
$$;

create or replace function public.create_order(p_script_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_total numeric(10,2);
begin
  if auth.uid() is null then raise exception 'Faça login com o Discord.'; end if;

  if p_script_ids is null or cardinality(p_script_ids)=0 then
    raise exception 'Nenhum item válido no carrinho.';
  end if;

  with chosen as (
    select distinct s.id,s.name,s.price
    from public.scripts s
    where s.id = any(p_script_ids)
      and s.price > 0
      and not exists (
        select 1
        from public.orders o
        join public.order_items oi on oi.order_id=o.id
        where o.user_id=auth.uid() and o.status='paid' and oi.script_id=s.id
      )
  )
  select coalesce(sum(price),0) into v_total from chosen;

  if v_total <= 0 then raise exception 'Nenhum item válido no carrinho.'; end if;

  insert into public.orders(user_id,status,total)
  values(auth.uid(),'pending',v_total)
  returning id into v_order_id;

  insert into public.order_items(order_id,script_id,name,price)
  select v_order_id,s.id,s.name,s.price
  from public.scripts s
  where s.id = any(p_script_ids)
    and s.price > 0
    and not exists (
      select 1
      from public.orders o
      join public.order_items oi on oi.order_id=o.id
      where o.user_id=auth.uid() and o.status='paid' and oi.script_id=s.id
    );

  return jsonb_build_object(
    'id',v_order_id,
    'userId',auth.uid(),
    'status','pending',
    'total',v_total,
    'items',(select jsonb_agg(jsonb_build_object('id',script_id,'name',name,'price',price)) from public.order_items where order_id=v_order_id)
  );
end;
$$;

create or replace function public.upsert_review(p_rating integer,p_text text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  u record;
  v_verified boolean;
  v_id uuid;
begin
  select * into u from auth.users where id=auth.uid();
  if u.id is null then raise exception 'Faça login com o Discord.'; end if;
  if p_rating < 1 or p_rating > 5 then raise exception 'Escolha de 1 a 5 estrelas.'; end if;
  if char_length(trim(p_text)) < 5 then raise exception 'Escreva pelo menos 5 caracteres.'; end if;

  select exists(
    select 1 from public.orders where user_id=auth.uid() and status='paid'
  ) into v_verified;

  insert into public.reviews(user_id,name,avatar,rating,text,verified)
  values(
    auth.uid(),
    coalesce(u.raw_user_meta_data->>'full_name',u.raw_user_meta_data->>'name',u.email,'Cliente'),
    coalesce(u.raw_user_meta_data->>'avatar_url',''),
    p_rating,left(trim(p_text),300),v_verified
  )
  on conflict(user_id) do update set
    name=excluded.name,avatar=excluded.avatar,rating=excluded.rating,text=excluded.text,
    verified=excluded.verified,created_at=now()
  returning id into v_id;

  return jsonb_build_object('id',v_id);
end;
$$;

create or replace function public.send_support_message(p_text text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t record;
  u record;
  msg jsonb;
begin
  if auth.uid() is null then raise exception 'Faça login com o Discord.'; end if;
  if char_length(trim(p_text))=0 then raise exception 'Digite uma mensagem.'; end if;

  select * into u from auth.users where id=auth.uid();
  if u.id is null then raise exception 'Usuário inválido.'; end if;

  select * into t from public.tickets where user_id=auth.uid() and status='open' order by updated_at desc limit 1;
  if t.id is null then
    insert into public.tickets(user_id,username,avatar,status)
    values(
      auth.uid(),
      coalesce(u.raw_user_meta_data->>'full_name',u.raw_user_meta_data->>'name',u.email,'Cliente'),
      coalesce(u.raw_user_meta_data->>'avatar_url',''),
      'open'
    ) returning * into t;
  else
    update public.tickets set username=coalesce(u.raw_user_meta_data->>'full_name',u.raw_user_meta_data->>'name',u.email,'Cliente'),
      avatar=coalesce(u.raw_user_meta_data->>'avatar_url','') where id=t.id;
  end if;

  insert into public.messages(ticket_id,sender_user_id,sender_role,text)
  values(t.id,auth.uid(),'user',left(trim(p_text),800));

  update public.tickets set updated_at=now() where id=t.id;

  select jsonb_build_object(
    'id',t.id,'userId',auth.uid(),'status','open','updated',extract(epoch from now())*1000,
    'messages',jsonb_build_array(jsonb_build_object(
      'from','user','name',coalesce(u.raw_user_meta_data->>'full_name',u.email,'Você'),
      'text',left(trim(p_text),800),'at',extract(epoch from now())*1000
    ))
  ) into msg;

  return msg;
end;
$$;

create or replace function public.admin_reply(p_ticket_id uuid,p_text text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Acesso negado.'; end if;
  if char_length(trim(p_text))=0 then raise exception 'Digite uma mensagem.'; end if;
  insert into public.messages(ticket_id,sender_user_id,sender_role,text)
  values(p_ticket_id,auth.uid(),'staff',left(trim(p_text),800));
  update public.tickets set updated_at=now(),status='open' where id=p_ticket_id;
  return jsonb_build_object('ok',true);
end;
$$;

create or replace function public.close_ticket(p_ticket_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Acesso negado.'; end if;
  update public.tickets set status='closed',updated_at=now() where id=p_ticket_id;
  return true;
end;
$$;

alter table public.config enable row level security;
alter table public.scripts enable row level security;
alter table public.execs enable row level security;
alter table public.user_roles enable row level security;
alter table public.reviews enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.tickets enable row level security;
alter table public.messages enable row level security;

drop policy if exists config_public_read on public.config;
create policy config_public_read on public.config for select using (true);
drop policy if exists config_admin_update on public.config;
create policy config_admin_update on public.config for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists scripts_public_read on public.scripts;
create policy scripts_public_read on public.scripts for select using (true);
drop policy if exists scripts_admin_insert on public.scripts;
create policy scripts_admin_insert on public.scripts for insert to authenticated with check (public.is_admin());
drop policy if exists scripts_admin_update on public.scripts;
create policy scripts_admin_update on public.scripts for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists scripts_admin_delete on public.scripts;
create policy scripts_admin_delete on public.scripts for delete to authenticated using (public.is_admin());

drop policy if exists execs_public_read on public.execs;
create policy execs_public_read on public.execs for select using (true);
drop policy if exists execs_admin_insert on public.execs;
create policy execs_admin_insert on public.execs for insert to authenticated with check (public.is_admin());
drop policy if exists execs_admin_update on public.execs;
create policy execs_admin_update on public.execs for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists execs_admin_delete on public.execs;
create policy execs_admin_delete on public.execs for delete to authenticated using (public.is_admin());

drop policy if exists roles_self_read on public.user_roles;
create policy roles_self_read on public.user_roles for select to authenticated using (user_id=auth.uid() or public.is_admin());

drop policy if exists reviews_public_read on public.reviews;
create policy reviews_public_read on public.reviews for select using (true);
drop policy if exists reviews_self_delete on public.reviews;
create policy reviews_self_delete on public.reviews for delete to authenticated using (user_id=auth.uid() or public.is_admin());

drop policy if exists orders_self_read on public.orders;
create policy orders_self_read on public.orders for select to authenticated using (user_id=auth.uid() or public.is_admin());
drop policy if exists orders_admin_update on public.orders;
create policy orders_admin_update on public.orders for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists order_items_read on public.order_items;
create policy order_items_read on public.order_items for select to authenticated using (
  exists(select 1 from public.orders o where o.id=order_id and (o.user_id=auth.uid() or public.is_admin()))
);

drop policy if exists tickets_self_read on public.tickets;
create policy tickets_self_read on public.tickets for select to authenticated using (user_id=auth.uid() or public.is_admin());

drop policy if exists messages_read on public.messages;
create policy messages_read on public.messages for select to authenticated using (
  exists(select 1 from public.tickets t where t.id=ticket_id and (t.user_id=auth.uid() or public.is_admin()))
);

-- Não dê acesso direto ao código dos scripts pela API pública.
revoke select on public.scripts from anon, authenticated;
grant select (id,name,game,price,hot,description,img) on public.scripts to anon, authenticated;
grant insert (name,game,price,description,img,code,hot) on public.scripts to authenticated;
grant update (name,game,price,description,img,code,hot) on public.scripts to authenticated;
grant delete on public.scripts to authenticated;

grant select on public.config to anon, authenticated;
grant update (name,tag,logo,a,b,bg,radius,light,discord,insta,footer) on public.config to authenticated;
grant select on public.execs to anon, authenticated;
grant insert,update,delete on public.execs to authenticated;
grant select on public.user_roles to authenticated;
grant select,delete on public.reviews to anon,authenticated;
grant select,update on public.orders to authenticated;
grant select on public.order_items to authenticated;
grant select on public.tickets,public.messages to authenticated;

revoke all on function public.get_script_code(uuid) from public;
grant execute on function public.get_script_code(uuid) to anon,authenticated;
revoke all on function public.create_order(uuid[]) from public;
grant execute on function public.create_order(uuid[]) to authenticated;
revoke all on function public.upsert_review(integer,text) from public;
grant execute on function public.upsert_review(integer,text) to authenticated;
revoke all on function public.send_support_message(text) from public;
grant execute on function public.send_support_message(text) to authenticated;
revoke all on function public.admin_reply(uuid,text) from public;
grant execute on function public.admin_reply(uuid,text) to authenticated;
revoke all on function public.close_ticket(uuid) from public;
grant execute on function public.close_ticket(uuid) to authenticated;

-- Depois do primeiro login com Discord, descubra o UUID em Authentication > Users
-- e execute:
-- insert into public.user_roles(user_id,role) values('COLE-O-UUID-AQUI','admin')
-- on conflict (user_id) do update set role='admin';
