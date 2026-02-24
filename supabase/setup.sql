-- Run this SQL once in Supabase SQL Editor.
-- It creates tables, storage bucket, and access policies used by /admin.

create extension if not exists pgcrypto;

create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  "reelUrl" text not null,
  summary text not null,
  "relatedDocumentIds" text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.documents (
  id text primary key,
  title text not null,
  description text not null,
  date date not null,
  "downloadUrl" text not null,
  created_at timestamptz not null default now()
);

alter table public.videos enable row level security;
alter table public.documents enable row level security;

-- Security: only the admin email should have write privileges.
-- Keep this in sync with ADMIN_EMAIL in runtime config.
drop policy if exists "Allow public read access on videos" on public.videos;
drop policy if exists "Public read videos" on public.videos;
drop policy if exists "Authenticated manage videos" on public.videos;
drop policy if exists "Admin manage videos" on public.videos;

drop policy if exists "Allow public read access on documents" on public.documents;
drop policy if exists "Public read documents" on public.documents;
drop policy if exists "Authenticated manage documents" on public.documents;
drop policy if exists "Admin manage documents" on public.documents;

create policy "Public read videos"
  on public.videos
  for select
  to public
  using (true);

create policy "Admin manage videos"
  on public.videos
  for all
  to authenticated
  using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'builderjo@admin.com')
  with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'builderjo@admin.com');

create policy "Public read documents"
  on public.documents
  for select
  to public
  using (true);

create policy "Admin manage documents"
  on public.documents
  for all
  to authenticated
  using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'builderjo@admin.com')
  with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'builderjo@admin.com');

insert into storage.buckets (id, name, public)
values ('documents', 'documents', true)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "Public read documents bucket" on storage.objects;
drop policy if exists "Authenticated upload documents bucket" on storage.objects;
drop policy if exists "Authenticated update documents bucket" on storage.objects;
drop policy if exists "Authenticated delete documents bucket" on storage.objects;
drop policy if exists "Admin upload documents bucket" on storage.objects;
drop policy if exists "Admin update documents bucket" on storage.objects;
drop policy if exists "Admin delete documents bucket" on storage.objects;

create policy "Public read documents bucket"
  on storage.objects
  for select
  to public
  using (bucket_id = 'documents');

create policy "Admin upload documents bucket"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'documents'
    and lower(coalesce(auth.jwt() ->> 'email', '')) = 'builderjo@admin.com'
  );

create policy "Admin update documents bucket"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'documents'
    and lower(coalesce(auth.jwt() ->> 'email', '')) = 'builderjo@admin.com'
  )
  with check (
    bucket_id = 'documents'
    and lower(coalesce(auth.jwt() ->> 'email', '')) = 'builderjo@admin.com'
  );

create policy "Admin delete documents bucket"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'documents'
    and lower(coalesce(auth.jwt() ->> 'email', '')) = 'builderjo@admin.com'
  );
