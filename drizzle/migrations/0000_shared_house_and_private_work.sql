-- ===== Papéis =====
create type public.app_role as enum ('admin');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "Ver os próprios papéis" on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- ===== E-mails liberados =====
create table public.allowed_emails (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);
grant select, insert, delete on public.allowed_emails to authenticated;
grant all on public.allowed_emails to service_role;
alter table public.allowed_emails enable row level security;
create policy "Admin vê e-mails" on public.allowed_emails for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Admin libera e-mails" on public.allowed_emails for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy "Admin remove e-mails" on public.allowed_emails for delete to authenticated
  using (public.has_role(auth.uid(), 'admin') and email <> 'douglasmenezesb1@gmail.com');

insert into public.allowed_emails (email) values ('douglasmenezesb1@gmail.com');

-- Membro = usuário logado cujo e-mail ainda está liberado
create or replace function public.is_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from auth.users u join public.allowed_emails a on a.email = lower(u.email)
    where u.id = auth.uid()
  )
$$;
grant execute on function public.is_member() to authenticated;

-- Só e-mails liberados conseguem criar conta
create or replace function public.check_email_allowed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.allowed_emails where email = lower(new.email)) then
    raise exception 'email_not_allowed';
  end if;
  return new;
end;
$$;
create trigger before_auth_user_created_check_allowed
before insert on auth.users for each row execute function public.check_email_allowed();

-- Dono vira admin depois de confirmar o e-mail
create or replace function public.grant_owner_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email_confirmed_at is not null and lower(new.email) = 'douglasmenezesb1@gmail.com' then
    insert into public.user_roles (user_id, role) values (new.id, 'admin') on conflict (user_id, role) do nothing;
  end if;
  return new;
end;
$$;
create trigger on_auth_user_created_grant_owner
after insert on auth.users for each row execute function public.grant_owner_admin();
create trigger on_auth_user_confirmed_grant_owner
after update of email_confirmed_at on auth.users for each row
when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
execute function public.grant_owner_admin();

-- ===== Tarefas (cartões = pessoais, afazeres = compartilhados) =====
create table public.tasks (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null default auth.uid(),
  kind text not null default 'card' check (kind in ('card', 'afazer')),
  title text not null,
  project text not null default '',
  notes text not null default '',
  date text not null default '',
  time text not null default '09:00',
  priority text not null default 'media',
  status text not null default 'todo',
  labels text[] not null default '{}',
  checklist jsonb not null default '[]',
  reminders text[] not null default '{}',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.tasks to authenticated;
grant all on public.tasks to service_role;
alter table public.tasks enable row level security;
create policy "Ver tarefas" on public.tasks for select to authenticated
  using (public.is_member() and (kind = 'afazer' or user_id = auth.uid()));
create policy "Criar tarefas" on public.tasks for insert to authenticated
  with check (public.is_member() and user_id = auth.uid());
create policy "Editar tarefas" on public.tasks for update to authenticated
  using (public.is_member() and (kind = 'afazer' or user_id = auth.uid()))
  with check (public.is_member() and (kind = 'afazer' or user_id = auth.uid()));
create policy "Excluir tarefas" on public.tasks for delete to authenticated
  using (public.is_member() and (kind = 'afazer' or user_id = auth.uid()));

-- ===== Estoque (compartilhado) =====
create table public.stock_items (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  qty integer not null default 1,
  note text not null default '',
  expiry text not null default '',
  cat text not null default 'm',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.stock_items to authenticated;
grant all on public.stock_items to service_role;
alter table public.stock_items enable row level security;
create policy "Membros veem estoque" on public.stock_items for select to authenticated using (public.is_member());
create policy "Membros criam estoque" on public.stock_items for insert to authenticated with check (public.is_member());
create policy "Membros editam estoque" on public.stock_items for update to authenticated using (public.is_member()) with check (public.is_member());
create policy "Membros removem estoque" on public.stock_items for delete to authenticated using (public.is_member());

-- ===== Mercado (compartilhado) =====
create table public.shop_items (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  done boolean not null default false,
  stock_id text,
  created_at timestamptz not null default now()
);
create unique index shop_items_stock_id_key on public.shop_items (stock_id) where stock_id is not null;
grant select, insert, update, delete on public.shop_items to authenticated;
grant all on public.shop_items to service_role;
alter table public.shop_items enable row level security;
create policy "Membros veem mercado" on public.shop_items for select to authenticated using (public.is_member());
create policy "Membros criam mercado" on public.shop_items for insert to authenticated with check (public.is_member());
create policy "Membros editam mercado" on public.shop_items for update to authenticated using (public.is_member()) with check (public.is_member());
create policy "Membros removem mercado" on public.shop_items for delete to authenticated using (public.is_member());

-- ===== Preferências da casa (compartilhadas, linha única) =====
create table public.house_settings (
  id integer primary key default 1 check (id = 1),
  auto boolean not null default true,
  skip text[] not null default '{}'
);
grant select, update on public.house_settings to authenticated;
grant all on public.house_settings to service_role;
alter table public.house_settings enable row level security;
create policy "Membros veem preferências" on public.house_settings for select to authenticated using (public.is_member());
create policy "Membros editam preferências" on public.house_settings for update to authenticated using (public.is_member()) with check (public.is_member());
insert into public.house_settings (id) values (1);

-- ===== Atualização ao vivo =====
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.stock_items;
alter publication supabase_realtime add table public.shop_items;
alter publication supabase_realtime add table public.house_settings;

-- ===== Estoque inicial =====
insert into public.stock_items (id, name, qty, note, expiry, cat, created_at)
select id, name, qty, note, expiry, cat, timestamptz '2026-01-01' + (pos * interval '1 second')
from (values
('s0','Nescau lata',1,'2/3','2026-05-01','m',0),
('s1','Leite em pó',1,'Acabando','2027-04-14','m',1),
('s2','Leite condensado',2,'1 Aberto','','m',2),
('s3','Creme de leite',3,'','','m',3),
('s4','Batata palha',2,'Fechado','','m',4),
('s5','Fermento pão',2,'Fechado','2027-01-23','m',5),
('s6','Massa',2,'','','m',6),
('s7','Chá preto',4,'Fechado','','m',7),
('s8','Café',2,'Fechado','','m',8),
('s9','Amido de milho',1,'Acabando','2027-07-02','m',9),
('s10','Fermento',2,'4 Fechado','2027-06-01','m',10),
('s11','Maionese',0,'','','m',11),
('s12','Milho para pipoca',1,'Fechado','2027-02-06','m',12),
('s13','Sal grosso',2,'1 Fechado','2027-11-01','m',13),
('s14','Erva-mate',1,'Fechado','','m',14),
('s15','Polenta',1,'Fechado','2026-11-01','m',15),
('s16','Feijão',1,'3/4','','m',16),
('s17','Arroz',0,'','','m',17),
('s18','Óleo de soja',1,'Cheio','','m',18),
('s19','Azeite',1,'Cheio','','m',19),
('s20','Vinagre',1,'1/3','','m',20),
('s21','Molho shoyu',1,'Metade','2027-01-01','m',21),
('s22','Farinha',1,'Fechado','','m',22),
('s23','Aveia',1,'Metade','','m',23),
('s24','Magic Toast',0,'','','m',24),
('s25','Sal',1,'Metade','','m',25),
('s26','Pão',1,'Acabando','','m',26),
('s27','Ketchup',1,'Aberto','','m',27),
('s28','Iogurte',0,'','','m',28),
('s29','Papel filme',2,'1 Fechado','','c',29),
('s30','Papel alumínio',1,'Aberto','','c',30),
('s31','Filtro de café',1,'Acabando','','c',31),
('s32','Papel toalha',2,'','','c',32),
('s33','Superbonder',0,'','','c',33),
('s34','Lixo pia',0,'','','c',34),
('s35','Lixo cozinha',1,'','','c',35),
('s36','Tapete Polar',1,'','','c',36),
('s37','Detergente',1,'','','l',37),
('s38','Lava-roupas',1,'','','l',38),
('s39','Álcool',1,'','','l',39),
('s40','Desinfetante Veja',1,'','','l',40),
('s41','Esponja Banho',1,'','','l',41),
('s42','Sabonete',2,'','','h',42),
('s43','Shampoo',1,'','','h',43),
('s44','Condicionador',1,'','','h',44),
('s45','Sachê cachorro',2,'Fechado','2028-01-01','p',45),
('s46','Ração',1,'','','p',46)
) as v(id, name, qty, note, expiry, cat, pos);