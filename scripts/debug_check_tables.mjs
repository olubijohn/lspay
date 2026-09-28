import { createClient } from '../node_modules/@supabase/supabase-js/dist/index.mjs';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://qesnopqljppejhhfnipz.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFlc25vcHFsanBwZWpoaGZuaXB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5MjQ0MzcsImV4cCI6MjEwNTUwMDQzN30.UHyK24MsGhTDpL6yxlZgliyjkg2nXhjWeSinFwKJ0MM';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspectTables() {
  await supabase.auth.signInWithPassword({
    email: 'support+23@nova-ec.internal',
    password: '23pass',
  });

  const checkTables = [
    'payments', 'student_payments', 'transactions', 'gateway_transactions',
    'lspay_wallet_ledger', 'lspay_transactions', 'lspay_student_wallets',
    'portal_accounts', 'portal_account_students', 'tenant_secrets', 'tenant_settings'
  ];

  for (const t of checkTables) {
    const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
    console.log(`Table ${t}: count=${count}, err=${error?.message}`);
  }

  // Also check wallet balances of all students linked to sammyjay
  const { data: wallets } = await supabase.from('lspay_student_wallets').select('*, students(full_name, reg_no)').order('updated_at', { ascending: false }).limit(10);
  console.log('\nTop 10 student wallets:');
  console.log(JSON.stringify(wallets, null, 2));
}

inspectTables();
