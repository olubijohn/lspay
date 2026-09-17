-- ============================================================================
-- LSPay - Supabase Permission & Access Fix
-- ============================================================================
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New query)
-- to allow the frontend application (anon key) to read and write to the tables.
-- ============================================================================

-- 1. Grant schema usage
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- 2. Grant CRUD privileges on all existing tables
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;

-- 3. Grant sequence access (needed for auto-incrementing ID generation)
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- 4. Automatically grant permissions for future tables and sequences
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

-- 5. Disable Row Level Security (RLS) on all application tables so client queries are not blocked
ALTER TABLE IF EXISTS public.tenants DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.system_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.parent_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.students DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.parent_students DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.inventory_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.stock_movements DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notifications DISABLE ROW LEVEL SECURITY;
