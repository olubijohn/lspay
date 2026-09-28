// Load from environment: PAYSTACK_SECRET_KEY=sk_live_xxx node scripts/check_sammy_all.mjs
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';
if (!PAYSTACK_SECRET_KEY) { console.error('Set PAYSTACK_SECRET_KEY env var first'); process.exit(1); }

async function checkAllForSammy() {
  const res = await fetch('https://api.paystack.co/transaction?customer=403528122', {
    headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
  });
  const json = await res.json();
  console.log(`Found ${json.data?.length} transactions for sammyjay@gmail.com:`);
  for (const t of (json.data || [])) {
    console.log(`[${t.status.toUpperCase()}] Ref: ${t.reference} | Paid: ₦${t.amount / 100} (Req: ₦${(t.requested_amount || t.amount)/100}) | Channel: ${t.channel} | PaidAt: ${t.paid_at} | Student: ${t.metadata?.custom_fields?.[0]?.value || t.metadata?.student_id}`);
  }
}

checkAllForSammy();
