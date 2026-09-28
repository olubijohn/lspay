import { createClient } from '../node_modules/@supabase/supabase-js/dist/index.mjs';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://qesnopqljppejhhfnipz.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFlc25vcHFsanBwZWpoaGZuaXB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5MjQ0MzcsImV4cCI6MjEwNTUwMDQzN30.UHyK24MsGhTDpL6yxlZgliyjkg2nXhjWeSinFwKJ0MM';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkRecentPayments() {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'support+23@nova-ec.internal',
    password: '23pass',
  });
  if (authError) {
    console.error('Auth error:', authError);
    return;
  }
  console.log('Authenticated.');

  // Check recent lspay_wallet_ledger entries
  const { data: ledger, error: ledgerError } = await supabase
    .from('lspay_wallet_ledger')
    .select('*, students(full_name, reg_no)')
    .order('created_at', { ascending: false })
    .limit(15);

  console.log('Recent ledger error:', ledgerError?.message);
  console.log('Recent ledger count:', ledger?.length);
  if (ledger && ledger.length > 0) {
    for (const l of ledger) {
      console.log(`[Ledger] ID: ${l.id} | Kind: ${l.kind} | Mode: ${l.mode} | Amount: ${l.amount} | BalanceAfter: ${l.balance_after} | Ref: ${l.reference} | Date: ${l.created_at} | Student: ${l.students?.full_name} (${l.students?.reg_no})`);
    }
  }

  // Check recent lspay_transactions
  const { data: txns, error: txError } = await supabase
    .from('lspay_transactions')
    .select('*, students(full_name, reg_no)')
    .order('created_at', { ascending: false })
    .limit(10);
  console.log('\nRecent txns error:', txError?.message);
  console.log('Recent txns count:', txns?.length);
  if (txns && txns.length > 0) {
    for (const t of txns) {
      console.log(`[Txn] ID: ${t.id} | Amount: ${t.amount} | Items: ${t.items_string} | Date: ${t.txn_date} | Student: ${t.students?.full_name}`);
    }
  }

  // Check payment_records (school fees)
  const { data: records, error: recError } = await supabase
    .from('payment_records')
    .select('*, students(full_name, reg_no)')
    .order('created_at', { ascending: false })
    .limit(10);
  console.log('\nRecent payment_records error:', recError?.message);
  console.log('Recent payment_records count:', records?.length);
  if (records && records.length > 0) {
    for (const r of records) {
      console.log(`[PaymentRecord] ID: ${r.id} | Amount: ${r.amount} | Provider: ${r.provider} | Ref: ${r.reference} | Depositor: ${r.depositor} | Student: ${r.students?.full_name}`);
    }
  }

  // Check portal_payments or audit logs or webhook logs if any
  const { data: logs, error: lError } = await supabase
    .from('portal_accounts')
    .select('id, full_name, email, phone, portal_account_students(student_id, students(full_name, reg_no))')
    .order('created_at', { ascending: false })
    .limit(10);
  console.log('\nRecent portal_accounts count:', logs?.length, lError?.message);
  if (logs) {
    for (const p of logs) {
      const kids = (p.portal_account_students || []).map(k => `${k.students?.full_name} (${k.students?.reg_no})`).join(', ');
      console.log(`[Parent] ${p.full_name} (${p.email}) -> Children: ${kids}`);
    }
  }
}

checkRecentPayments();
