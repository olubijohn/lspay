import crypto from 'crypto';

// Load from environment: PAYSTACK_SECRET_KEY=sk_live_xxx node scripts/trigger_webhook.mjs
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';
if (!PAYSTACK_SECRET_KEY) { console.error('Set PAYSTACK_SECRET_KEY env var first'); process.exit(1); }
const WEBHOOK_URL = 'https://qesnopqljppejhhfnipz.supabase.co/functions/v1/paystack-webhook';

async function sendWebhookForTx() {
  console.log('Fetching full transaction details for LSPAY-1790590930700 from Paystack...');
  const res = await fetch('https://api.paystack.co/transaction/verify/LSPAY-1790590930700', {
    headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
  });
  const txData = await res.json();
  if (!txData.status || txData.data?.status !== 'success') {
    console.error('Failed to fetch/verify from Paystack:', txData);
    return;
  }

  console.log('Paystack verified. Building charge.success webhook payload...');
  const payload = {
    event: 'charge.success',
    data: txData.data,
  };

  const rawBody = JSON.stringify(payload);
  const signature = crypto.createHmac('sha512', PAYSTACK_SECRET_KEY).update(rawBody).digest('hex');

  console.log('Sending webhook to Supabase edge function...');
  const hookRes = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-paystack-signature': signature,
    },
    body: rawBody,
  });

  const hookResult = await hookRes.json();
  console.log('Webhook response status:', hookRes.status);
  console.log('Webhook response body:', JSON.stringify(hookResult, null, 2));
}

sendWebhookForTx();
