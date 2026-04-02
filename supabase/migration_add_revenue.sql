-- Run this in Supabase → SQL Editor
-- Adds revenue tracking to conversions

alter table conversions
  add column if not exists revenue numeric(10, 2) not null default 0;
