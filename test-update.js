import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function testUpdate() {
  console.log("Fetching Sophia Brown...");
  const { data, error: fetchError } = await supabase.from('students').select('*').eq('student_id', 'STU-003').single();
  
  if (fetchError) {
    console.error("Fetch Error:", fetchError);
    return;
  }
  
  console.log("Found student:", data);
  
  console.log("Updating...");
  const { data: updateData, error: updateError } = await supabase.from('students').update({
    card_status: 'Issued',
    card_lifecycle_status: 'assigned',
    card_type: 'QR',
    card_hardware_id: 'TEST-123',
    parent_notification_sent: true
  }).eq('id', data.id).select();
  
  if (updateError) {
    console.error("Update Error:", updateError);
  } else {
    console.log("Update Success! Returned data:", updateData);
  }
}

testUpdate();
