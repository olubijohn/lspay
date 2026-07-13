-- ============================================================================
-- LSPay — optional demo seed data
-- ============================================================================
-- Run AFTER schema.sql. Mirrors the demo data baked into src/store.tsx so a
-- fresh Supabase project behaves like the in-memory prototype.
--
-- WARNING: password_hash values below are PLAINTEXT for local prototyping only.
-- Replace with real hashes (e.g. bcrypt) before any real deployment.
-- ============================================================================

-- Tenants ------------------------------------------------------------------
insert into tenants (name, code, address, contact_name, contact_email, enrollment_key, paystack_public_key) values
  ('Greenwood Academy', 'GRE', '12 Oak Lane, London', 'Sarah Mitchell', 'sarah@greenwood.edu', 'SCH-GRE-2026', 'pk_live_edb8e52140a0da4881f5e029db11a7528be8ceb9'),
  ('Riverside Primary',  'RIV', '45 Thames St, Oxford', 'Lisa Chen',      'lisa@riverside.edu',  'SCH-RIV-2026', 'pk_live_edb8e52140a0da4881f5e029db11a7528be8ceb9');

-- System users -------------------------------------------------------------
insert into system_users (name, email, password_hash, role, tenant_id, is_active) values
  ('Platform Admin', 'admin@lspay.com',     'admin123', 'super_admin',    null, true),
  ('Sarah Mitchell', 'sarah@greenwood.edu', 'green123', 'tenant_admin',   (select id from tenants where code='GRE'), true),
  ('James Park',     'james@greenwood.edu', 'james123', 'kiosk_operator', (select id from tenants where code='GRE'), true),
  ('Lisa Chen',      'lisa@riverside.edu',  'river123', 'tenant_admin',   (select id from tenants where code='RIV'), true);

-- Parent users -------------------------------------------------------------
insert into parent_users (name, email, password_hash, phone) values
  ('Helen Johnson', 'helen@family.com',  'parent123', '+44 7700 900123'),
  ('Robert Davis',  'robert@family.com', 'parent456', '+44 7700 900456');

-- Students -----------------------------------------------------------------
insert into students (tenant_id, name, student_id, card_status, card_hardware_id, card_type, wallet_balance, daily_limit, monthly_limit, pin, parent_notification_sent, class_name, home_address, billing_address, parent_name, parent_email, image_url, card_lifecycle_status, activated_at) values
  ((select id from tenants where code='GRE'), 'Emma Johnson',    'STU-001', 'Active',     'E214D03D',  'NFC', 45.50, 10, 150, '1234', true,  'Year 9B', '5 Elm Road, London',     '5 Elm Road, London',     'Helen Johnson', 'helen@family.com',  'https://api.dicebear.com/7.x/initials/svg?seed=Emma Johnson',    'activated', '2026-06-02'),
  ((select id from tenants where code='GRE'), 'Oliver Smith',    'STU-002', 'Issued',     'QR-REF771', 'QR',  20.00,  8, 100, '',     true,  'Year 8A', '12 Oak St, London',      '12 Oak St, London',      'Carol Smith',   'carol@smith.com',   'https://api.dicebear.com/7.x/initials/svg?seed=Oliver Smith',    'ready',     null),
  ((select id from tenants where code='GRE'), 'Sophia Brown',    'STU-003', 'Unassigned', '',          'NFC',  0.00, 10, 100, '',     false, 'Year 7C', '8 Pine Ave, London',     '8 Pine Ave, London',     'David Brown',   'david@brown.com',   'https://api.dicebear.com/7.x/initials/svg?seed=Sophia Brown',    'pending_assignment', null),
  ((select id from tenants where code='RIV'), 'Liam Davis',      'STU-101', 'Active',     'NFC-4421',  'NFC', 32.00, 12, 200, '4567', false, 'Year 6B', '22 River Lane, Oxford',  '22 River Lane, Oxford',  'Robert Davis',  'robert@family.com', 'https://api.dicebear.com/7.x/initials/svg?seed=Liam Davis',      'activated', '2026-05-20'),
  ((select id from tenants where code='RIV'), 'Isabella Wilson', 'STU-102', 'Blocked',    'NFC-7733',  'NFC', 15.00, 10, 150, '9876', false, 'Year 5A', '33 Riverside Dr, Oxford','33 Riverside Dr, Oxford','Maria Wilson',  'maria@wilson.com',  'https://api.dicebear.com/7.x/initials/svg?seed=Isabella Wilson', 'activated', '2026-06-09');

-- Link parents to students -------------------------------------------------
insert into parent_students (parent_id, student_id) values
  ((select id from parent_users where email='helen@family.com'),  (select id from students where student_id='STU-001')),
  ((select id from parent_users where email='robert@family.com'), (select id from students where student_id='STU-101'));

-- Inventory ----------------------------------------------------------------
insert into inventory_items (tenant_id, name, category, stock, cost_price, selling_price) values
  ((select id from tenants where code='GRE'), 'Grilled Chicken & Rice', 'Mains',  50, 1.80, 3.50),
  ((select id from tenants where code='GRE'), 'Margherita Pizza Slice', 'Mains',  30, 1.20, 2.75),
  ((select id from tenants where code='GRE'), 'Cheese & Tomato Wrap',   'Snacks', 40, 0.80, 1.80),
  ((select id from tenants where code='GRE'), 'Chocolate Brownie',      'Snacks', 60, 0.40, 1.20),
  ((select id from tenants where code='GRE'), 'Orange Juice 330ml',     'Drinks', 80, 0.30, 1.00),
  ((select id from tenants where code='GRE'), 'Sparkling Water 500ml',  'Drinks',100, 0.20, 0.75),
  ((select id from tenants where code='RIV'), 'Fish & Chips',           'Mains',  35, 2.00, 4.00),
  ((select id from tenants where code='RIV'), 'Veggie Burger',          'Mains',  25, 1.50, 3.25),
  ((select id from tenants where code='RIV'), 'Apple',                  'Snacks',120, 0.15, 0.50),
  ((select id from tenants where code='RIV'), 'Ribena Carton',          'Drinks', 90, 0.25, 0.80);

-- Transactions (kiosk sales) -----------------------------------------------
insert into transactions (tenant_id, student_id, student_name, school_name, items_string, amount, cost, date) values
  ((select id from tenants where code='GRE'), (select id from students where student_id='STU-001'), 'Emma Johnson', 'Greenwood Academy', 'Grilled Chicken & Rice x1, Orange Juice 330ml x1', 4.50, 2.10, '2026-06-08'),
  ((select id from tenants where code='GRE'), (select id from students where student_id='STU-001'), 'Emma Johnson', 'Greenwood Academy', 'Margherita Pizza Slice x1, Chocolate Brownie x1',  3.95, 1.60, '2026-06-09'),
  ((select id from tenants where code='GRE'), (select id from students where student_id='STU-002'), 'Oliver Smith', 'Greenwood Academy', 'Cheese & Tomato Wrap x1, Sparkling Water 500ml x1', 2.55, 1.00, '2026-06-09'),
  ((select id from tenants where code='RIV'), (select id from students where student_id='STU-101'), 'Liam Davis',   'Riverside Primary', 'Fish & Chips x1, Ribena Carton x1',                 4.80, 2.25, '2026-06-08'),
  ((select id from tenants where code='RIV'), (select id from students where student_id='STU-101'), 'Liam Davis',   'Riverside Primary', 'Veggie Burger x1, Apple x2',                       4.25, 1.80, '2026-06-10'),
  ((select id from tenants where code='GRE'), (select id from students where student_id='STU-001'), 'Emma Johnson', 'Greenwood Academy', 'Sparkling Water 500ml x1',                         0.75, 0.20, '2026-06-10');

-- Stock movements ----------------------------------------------------------
insert into stock_movements (tenant_id, item_id, item_name, date, type, quantity, note)
select t.id, i.id, v.item_name, v.date::date, v.type, v.quantity, v.note
from (values
  ('GRE','Grilled Chicken & Rice','2026-06-08','sale',    1, null),
  ('GRE','Orange Juice 330ml',    '2026-06-08','sale',    1, null),
  ('GRE','Margherita Pizza Slice','2026-06-09','sale',    1, null),
  ('GRE','Chocolate Brownie',     '2026-06-09','sale',    1, null),
  ('GRE','Cheese & Tomato Wrap',  '2026-06-09','sale',    1, null),
  ('GRE','Sparkling Water 500ml', '2026-06-09','sale',    1, null),
  ('GRE','Sparkling Water 500ml', '2026-06-10','sale',    1, null),
  ('GRE','Grilled Chicken & Rice','2026-06-07','restock',20, 'Weekly restock'),
  ('GRE','Orange Juice 330ml',    '2026-06-07','restock',30, 'Weekly restock'),
  ('RIV','Fish & Chips',          '2026-06-08','sale',    1, null),
  ('RIV','Ribena Carton',         '2026-06-08','sale',    1, null),
  ('RIV','Veggie Burger',         '2026-06-10','sale',    1, null),
  ('RIV','Apple',                 '2026-06-10','sale',    2, null),
  ('RIV','Fish & Chips',          '2026-06-06','restock',15, 'Weekly restock')
) as v(code, item_name, date, type, quantity, note)
join tenants t on t.code = v.code
join inventory_items i on i.name = v.item_name and i.tenant_id = t.id;

-- Notifications ------------------------------------------------------------
insert into notifications (target_role, target_tenant_id, target_parent_email, type, message, student_id, student_name, is_read, created_at) values
  ('super_admin', null, null, 'card_pending',
    'New student Sophia Brown at Greenwood Academy is awaiting card assignment.',
    (select id from students where student_id='STU-003'), 'Sophia Brown', false, '2026-06-10T09:00:00Z'),
  ('tenant', (select id from tenants where code='GRE'), null, 'card_ready',
    'Oliver Smith''s card has been assigned and is ready for pickup.',
    (select id from students where student_id='STU-002'), 'Oliver Smith', false, '2026-06-09T14:30:00Z'),
  ('parent', (select id from tenants where code='GRE'), 'helen@family.com', 'card_delivered',
    'Emma Johnson''s card has been delivered.',
    (select id from students where student_id='STU-001'), 'Emma Johnson', true, '2026-06-08T11:00:00Z');
