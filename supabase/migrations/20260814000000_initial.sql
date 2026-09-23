-- Arkhe mini-MVP · PostgreSQL / Supabase schema
create extension if not exists pgcrypto;

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  client text not null default '',
  status text not null default 'In progress' check (status in ('In progress', 'On hold', 'Complete')),
  location text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.spaces (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.specification_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  space_id uuid not null references public.spaces(id) on delete restrict,
  name text not null,
  category text not null,
  supplier text not null,
  description text not null default '',
  quantity numeric(12, 2) not null default 1 check (quantity >= 0),
  unit_price numeric(12, 2) not null default 0 check (unit_price >= 0),
  lead_time_weeks integer not null default 0 check (lead_time_weeks >= 0),
  status text not null default 'Draft' check (status in ('Draft', 'Reviewing', 'Approved', 'Ordered')),
  notes text not null default '',
  image_url text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  item_id uuid not null references public.specification_items(id) on delete cascade,
  name text not null,
  path text not null unique,
  url text not null,
  type text not null,
  size bigint not null default 0,
  created_at timestamptz not null default now()
);

create table public.share_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  is_active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index spaces_project_order_idx on public.spaces(project_id, sort_order);
create index items_project_order_idx on public.specification_items(project_id, sort_order);
create index items_project_status_idx on public.specification_items(project_id, status);
create index attachments_item_idx on public.attachments(item_id);
create index share_links_token_idx on public.share_links(token) where is_active;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger projects_set_updated_at before update on public.projects
for each row execute function public.set_updated_at();
create trigger items_set_updated_at before update on public.specification_items
for each row execute function public.set_updated_at();

alter table public.projects enable row level security;
alter table public.spaces enable row level security;
alter table public.specification_items enable row level security;
alter table public.attachments enable row level security;
alter table public.share_links enable row level security;

create policy "Owners manage projects" on public.projects
for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "Owners manage spaces" on public.spaces
for all using (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()))
with check (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()));

create policy "Owners manage specification items" on public.specification_items
for all using (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()))
with check (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()));

create policy "Owners manage attachments" on public.attachments
for all using (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()))
with check (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()));

create policy "Owners manage share links" on public.share_links
for all using (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()))
with check (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('project-assets', 'project-assets', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "Owners upload project assets" on storage.objects for insert to authenticated
with check (
  bucket_id = 'project-assets'
  and exists (
    select 1 from public.projects p
    where p.id::text = (storage.foldername(name))[1]
      and p.owner_id = auth.uid()
  )
);

create policy "Owners update project assets" on storage.objects for update to authenticated
using (
  bucket_id = 'project-assets'
  and exists (
    select 1 from public.projects p
    where p.id::text = (storage.foldername(name))[1]
      and p.owner_id = auth.uid()
  )
);

create policy "Owners delete project assets" on storage.objects for delete to authenticated
using (
  bucket_id = 'project-assets'
  and exists (
    select 1 from public.projects p
    where p.id::text = (storage.foldername(name))[1]
      and p.owner_id = auth.uid()
  )
);

-- A security-definer RPC is the only anonymous data surface. It returns only
-- approved/ordered items for a currently active token and exposes no owner id.
create or replace function public.get_shared_project(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'project', jsonb_build_object(
      'id', p.id,
      'ownerId', '',
      'name', p.name,
      'client', p.client,
      'status', p.status,
      'location', p.location,
      'updatedAt', p.updated_at,
      'createdAt', p.created_at
    ),
    'spaces', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'projectId', s.project_id,
        'name', s.name,
        'sortOrder', s.sort_order
      ) order by s.sort_order)
      from public.spaces s where s.project_id = p.id
    ), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id,
        'projectId', i.project_id,
        'spaceId', i.space_id,
        'name', i.name,
        'category', i.category,
        'supplier', i.supplier,
        'description', i.description,
        'quantity', i.quantity,
        'unitPrice', i.unit_price,
        'leadTimeWeeks', i.lead_time_weeks,
        'status', i.status,
        'notes', i.notes,
        'imageUrl', i.image_url,
        'sortOrder', i.sort_order,
        'updatedAt', i.updated_at,
        'createdAt', i.created_at
      ) order by i.sort_order)
      from public.specification_items i
      where i.project_id = p.id and i.status in ('Approved', 'Ordered')
    ), '[]'::jsonb),
    'attachments', '[]'::jsonb,
    'shareLinks', '[]'::jsonb
  )
  from public.share_links l
  join public.projects p on p.id = l.project_id
  where l.token = p_token
    and l.is_active
    and (l.expires_at is null or l.expires_at > now())
  limit 1;
$$;

revoke all on function public.get_shared_project(text) from public;
grant execute on function public.get_shared_project(text) to anon, authenticated;
