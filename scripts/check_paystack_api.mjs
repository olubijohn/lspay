// Load from environment: PAYSTACK_SECRET_KEY=sk_live_xxx node scripts/check_paystack_api.mjs
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';
if (!PAYSTACK_SECRET_KEY) { console.error('Set PAYSTACK_SECRET_KEY env var first'); process.exit(1); }

async function fetchRecentPaystackTxns() {
  console.log('Fetching recent transactions from Paystack API...');
  try {
    const res = await fetch('https://api.paystack.co/transaction?perPage=20', {
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      },
    });
    const json = await res.json();
    if (!json.status) {
      console.error('Paystack error:', json);
      return;
    }

    console.log(`Found ${json.data.length} transactions:`);
    for (const tx of json.data) {
      console.log('----------------------------------------------------');
      console.log(`ID: ${tx.id}`);
      console.log(`Status: ${tx.status}`);
      console.log(`Reference: ${tx.reference}`);
      console.log(`Amount: ₦${tx.amount / 100} (requested: ₦${(tx.requested_amount || tx.amount) / 100})`);
      console.log(`Customer: ${tx.customer?.email} (${tx.customer?.first_name || ''} ${tx.customer?.last_name || ''})`);
      console.log(`Paid At: ${tx.paid_at}`);
      console.log(`Channel: ${tx.channel}`);
      console.log(`Metadata:`, JSON.stringify(tx.metadata, null, 2));
    }
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

fetchRecentPaystackTxns();
