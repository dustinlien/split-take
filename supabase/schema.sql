-- ============================================================
-- Split Take — Supabase Schema
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- TESTS
-- ------------------------------------------------------------
create table if not exists tests (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  url             text not null,
  status          text not null default 'draft'
                    check (status in ('draft', 'running', 'paused', 'ended')),
  winner_variant_id uuid,           -- set on end; FK added below after variants
  created_at      timestamptz not null default now()
);

-- ------------------------------------------------------------
-- VARIANTS
-- ------------------------------------------------------------
create table if not exists variants (
  id              uuid primary key default gen_random_uuid(),
  test_id         uuid not null references tests(id) on delete cascade,
  label           text not null,
  traffic_weight  integer not null default 0
                    check (traffic_weight >= 0 and traffic_weight <= 100),
  is_control      boolean not null default false,
  created_at      timestamptz not null default now()
);

-- Add FK from tests → variants now that variants exists
alter table tests
  add constraint fk_winner_variant
  foreign key (winner_variant_id)
  references variants(id)
  on delete set null
  deferrable initially deferred;

-- ------------------------------------------------------------
-- VARIANT CHANGES
-- ------------------------------------------------------------
create table if not exists variant_changes (
  id              uuid primary key default gen_random_uuid(),
  variant_id      uuid not null references variants(id) on delete cascade,
  element_id      text not null,        -- CSS selector, e.g. "#hero-headline"
  change_type     text not null
                    check (change_type in ('text', 'image', 'visibility')),
  new_value       text not null,
  created_at      timestamptz not null default now()
);

-- ------------------------------------------------------------
-- VISITS
-- ------------------------------------------------------------
create table if not exists visits (
  id              uuid primary key default gen_random_uuid(),
  test_id         uuid not null references tests(id) on delete cascade,
  variant_id      uuid not null references variants(id) on delete cascade,
  visitor_token   text not null,        -- SHA-256 hash of client UUID
  timestamp       timestamptz not null default now()
);

create index if not exists visits_test_variant_idx
  on visits(test_id, variant_id);

create index if not exists visits_visitor_idx
  on visits(visitor_token);

-- ------------------------------------------------------------
-- CONVERSIONS
-- ------------------------------------------------------------
create table if not exists conversions (
  id              uuid primary key default gen_random_uuid(),
  test_id         uuid not null references tests(id) on delete cascade,
  variant_id      uuid not null references variants(id) on delete cascade,
  visitor_token   text not null,
  timestamp       timestamptz not null default now()
);

create index if not exists conversions_test_variant_idx
  on conversions(test_id, variant_id);

create index if not exists conversions_visitor_idx
  on conversions(visitor_token);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table tests           enable row level security;
alter table variants        enable row level security;
alter table variant_changes enable row level security;
alter table visits          enable row level security;
alter table conversions     enable row level security;

-- ------------------------------------------------------------
-- ANON (snippet on visitor pages)
--   • Can read tests, variants, variant_changes (to serve experiments)
--   • Can insert visits and conversions (to log activity)
-- ------------------------------------------------------------

create policy "anon_read_tests"
  on tests for select to anon using (true);

create policy "anon_read_variants"
  on variants for select to anon using (true);

create policy "anon_read_variant_changes"
  on variant_changes for select to anon using (true);

create policy "anon_insert_visits"
  on visits for insert to anon with check (true);

create policy "anon_insert_conversions"
  on conversions for insert to anon with check (true);

-- ------------------------------------------------------------
-- AUTHENTICATED (control panel users)
--   • Full access to all tables
-- ------------------------------------------------------------

create policy "auth_all_tests"
  on tests for all to authenticated using (true) with check (true);

create policy "auth_all_variants"
  on variants for all to authenticated using (true) with check (true);

create policy "auth_all_variant_changes"
  on variant_changes for all to authenticated using (true) with check (true);

create policy "auth_all_visits"
  on visits for all to authenticated using (true) with check (true);

create policy "auth_all_conversions"
  on conversions for all to authenticated using (true) with check (true);

-- ============================================================
-- HELPER VIEWS (optional, speeds up dashboard queries)
-- ============================================================

create or replace view test_results as
select
  v.id              as variant_id,
  v.test_id,
  v.label,
  v.is_control,
  v.traffic_weight,
  count(distinct vi.visitor_token)  as visitors,
  count(distinct c.visitor_token)   as converters
from variants v
left join visits      vi on vi.variant_id = v.id
left join conversions c  on c.variant_id  = v.id
group by v.id, v.test_id, v.label, v.is_control, v.traffic_weight;
