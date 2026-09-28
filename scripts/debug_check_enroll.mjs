import { createClient } from '../node_modules/@supabase/supabase-js/dist/index.mjs';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://qesnopqljppejhhfnipz.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFlc25vcHFsanBwZWpoaGZuaXB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5MjQ0MzcsImV4cCI6MjEwNTUwMDQzN30.UHyK24MsGhTDpL6yxlZgliyjkg2nXhjWeSinFwKJ0MM';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkEnrollmentAndPayments() {
  await supabase.auth.signInWithPassword({
    email: 'support+23@nova-ec.internal',
    password: '23pass',
  });

  const { data: enrolls, error: eErr } = await supabase
    .from('lspay_enrollment_payments')
    .select('*, students(full_name, reg_no)')
    .order('created_at', { ascending: false });
  console.log('lspay_enrollment_payments:', enrolls?.length, eErr?.message);
  if (enrolls) console.log(JSON.stringify(enrolls, null, 2));

  const { data: txs, error: tErr } = await supabase
    .from('payment_transactions')
    .select('*, students(full_name, reg_no)')
    .order('paid_at', { ascending: false })
    .limit(10);
  console.log('\npayment_transactions:', txs?.length, tErr?.message);
  if (txs) console.log(JSON.stringify(txs, null, 2));
}

checkEnrollmentAndPayments();
