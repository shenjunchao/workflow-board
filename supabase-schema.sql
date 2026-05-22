create table if not exists public.user_app_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  app_data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_app_data enable row level security;

drop policy if exists "Users can read own app data" on public.user_app_data;
drop policy if exists "Users can insert own app data" on public.user_app_data;
drop policy if exists "Users can update own app data" on public.user_app_data;

create policy "Users can read own app data"
on public.user_app_data
for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can insert own app data"
on public.user_app_data
for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can update own app data"
on public.user_app_data
for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'workflow-images',
  'workflow-images',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can read own workflow images" on storage.objects;
drop policy if exists "Users can upload own workflow images" on storage.objects;
drop policy if exists "Users can update own workflow images" on storage.objects;
drop policy if exists "Users can delete own workflow images" on storage.objects;

create policy "Users can read own workflow images"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'workflow-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can upload own workflow images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'workflow-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can update own workflow images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'workflow-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'workflow-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can delete own workflow images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'workflow-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
