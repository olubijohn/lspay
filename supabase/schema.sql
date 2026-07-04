-- ============================================================================
-- LSPay — Supabase / PostgreSQL schema
-- ============================================================================
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New query)
-- to create all tables, then run seed.sql (optional) for demo data.
--
-- This mirrors the in-memory data model in src/store.tsx / src/lib/types.ts.
-- Money values are stored as NUMERIC(10,2) (pounds.pence). IDs use bigint
-- identity columns to match the app's numeric ids.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- tenants  (schools)
-- ---------------------------------------------------------------------------
create table if not exists tenants (
  id                  bigint generated always as identity primary key,
  name                text        not null,
  code                text        not null,
  address             text        not null default '',
  contact_name        text        not null default '',
  contact_email       text        not null default '',
  enrollment_key      text        not null unique,
  paystack_public_key text        not null default '',
  created_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- system_users  (super admins + tenant staff)
-- role: 'super_admin' | 'tenant_admin' | 'backoffice' | 'kiosk_operator'
-- NOTE: password_hash holds a hash in production. The demo data uses plain
-- strings only for local prototyping — never store plaintext passwords live.
-- ---------------------------------------------------------------------------
create table if not exists system_users (
  id            bigint generated always as identity primary key,
  name          text    not null,
  email         text    not null unique,
  password_hash text    not null,
  role          text    not null check (role in ('super_admin','tenant_admin','backoffice','kiosk_operator')),
  tenant_id     bigint  references tenants(id) on delete cascade,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- parent_users
-- ---------------------------------------------------------------------------
create table if not exists parent_users (
  id            bigint generated always as identity primary key,
  name          text not null,
  email         text not null unique,
  password_hash text not null,
  phone         text,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- students
-- card_status: 'Active' | 'Issued' | 'Unassigned' | 'Blocked'
-- card_lifecycle_status: 'none' | 'pending_assignment' | 'assigned'
--                        | 'ready' | 'delivered' | 'activated'
-- ---------------------------------------------------------------------------
create table if not exists students (
  id                        bigint generated always as identity primary key,
  tenant_id                 bigint not null references tenants(id) on delete cascade,
  name                      text   not null,
  student_id                text   not null,
  card_status               text   not null default 'Unassigned'
                              check (card_status in ('Active','Issued','Unassigned','Blocked')),
  card_hardware_id          text   not null default '',
  card_type                 text   not null default 'NFC',
  wallet_balance            numeric(10,2) not null default 0,
  daily_limit               numeric(10,2) not null default 0,
  monthly_limit             numeric(10,2) not null default 0,
  pin                       text   not null default '',
  parent_notification_sent  boolean not null default false,
  image_url                 text   not null default '',
  class_name                text   not null default '',
  card_lifecycle_status     text   not null default 'none'
                              check (card_lifecycle_status in
                                ('none','pending_assignment','assigned','ready','delivered','activated')),
  activated_at              timestamptz,
  home_address              text   not null default '',
  billing_address           text   not null default '',
  parent_name               text   not null default '',
  parent_email              text   not null default '',
  created_at                timestamptz not null default now(),
  unique (tenant_id, student_id)
);

-- Join table: which parents are linked to which students (was linkedStudentIds)
create table if not exists parent_students (
  parent_id  bigint not null references parent_users(id) on delete cascade,
  student_id bigint not null references students(id) on delete cascade,
  primary key (parent_id, student_id)
);

-- ---------------------------------------------------------------------------
-- inventory_items
-- ---------------------------------------------------------------------------
create table if not exists inventory_items (
  id            bigint generated always as identity primary key,
  tenant_id     bigint not null references tenants(id) on delete cascade,
  name          text   not null,
  category      text   not null default 'Mains',
  stock         integer not null default 0,
  cost_price    numeric(10,2) not null default 0,
  selling_price numeric(10,2) not null default 0,
  image_url     text,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- transactions  (kiosk sales)
-- ---------------------------------------------------------------------------
create table if not exists transactions (
  id            bigint generated always as identity primary key,
  tenant_id     bigint not null references tenants(id) on delete cascade,
  student_id    bigint not null references students(id) on delete cascade,
  student_name  text   not null,
  school_name   text   not null,
  items_string  text   not null default '',
  amount        numeric(10,2) not null default 0,
  cost          numeric(10,2) not null default 0,
  date          date   not null default current_date,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- stock_movements
-- type: 'restock' | 'sale'
-- ---------------------------------------------------------------------------
create table if not exists stock_movements (
  id         bigint generated always as identity primary key,
  tenant_id  bigint not null references tenants(id) on delete cascade,
  item_id    bigint not null references inventory_items(id) on delete cascade,
  item_name  text   not null,
  date       date   not null default current_date,
  type       text   not null check (type in ('restock','sale')),
  quantity   integer not null default 0,
  note       text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- notifications
-- target_role: 'super_admin' | 'tenant' | 'parent'
-- type: 'card_pending' | 'card_ready' | 'card_delivered' | 'limit_exceeded'
-- ---------------------------------------------------------------------------
create table if not exists notifications (
  id                  bigint generated always as identity primary key,
  target_role         text not null check (target_role in ('super_admin','tenant','parent')),
  target_tenant_id    bigint references tenants(id) on delete cascade,
  target_parent_email text,
  type                text not null check (type in ('card_pending','card_ready','card_delivered','limit_exceeded')),
  message             text not null,
  student_id          bigint not null references students(id) on delete cascade,
  student_name        text not null default '',
  is_read             boolean not null default false,
  created_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Helpful indexes
-- ---------------------------------------------------------------------------
create index if not exists idx_students_tenant        on students(tenant_id);
create index if not exists idx_inventory_tenant        on inventory_items(tenant_id);
create index if not exists idx_transactions_tenant     on transactions(tenant_id);
create index if not exists idx_transactions_student    on transactions(student_id);
create index if not exists idx_stock_movements_tenant  on stock_movements(tenant_id);
create index if not exists idx_system_users_tenant     on system_users(tenant_id);
create index if not exists idx_notifications_role       on notifications(target_role);
