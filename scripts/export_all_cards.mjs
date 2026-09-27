#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QRCodeSVG } from 'qrcode.react';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Parse CLI args
const args = process.argv.slice(2);
function getArg(flag, defaultValue) {
  const idx = args.indexOf(flag);
  if (idx !== -1 && args[idx + 1]) {
    return args[idx + 1];
  }
  return defaultValue;
}

const email = getArg('--email', 'support+23@nova-ec.internal');
const password = getArg('--password', '23pass');
const layout = getArg('--layout', 'pair'); // 'pair', 'front_only', 'grid_a4'
const outputFile = getArg('--output', path.join(projectRoot, 'Progress_Dynamic_Student_Cards.html'));

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://qesnopqljppejhhfnipz.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFlc25vcHFsanBwZWpoaGZuaXB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5MjQ0MzcsImV4cCI6MjEwNTUwMDQzN30.UHyK24MsGhTDpL6yxlZgliyjkg2nXhjWeSinFwKJ0MM';

console.log('----------------------------------------------------');
console.log('🎓 LSPay Student Card Bulk Exporter');
console.log('----------------------------------------------------');
console.log(`Connecting to Supabase at: ${SUPABASE_URL}`);

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log(`Signing in as: ${email}...`);
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError) {
    console.error('❌ Authentication failed:', authError.message);
    process.exit(1);
  }
  console.log('✅ Authenticated successfully.');

  // Fetch tenant info
  const { data: tenants, error: tenantError } = await supabase
    .from('tenants')
    .select('*')
    .limit(1);

  if (tenantError || !tenants || tenants.length === 0) {
    console.error('❌ Failed to fetch school tenant info:', tenantError?.message);
    process.exit(1);
  }

  const tenant = tenants[0];
  const schoolName = tenant.name || 'Demonstration Schools Kaduna';
  const schoolAddress = tenant.address || '5-7 Alor Close U/Pama Kaduna';
  const schoolPhone = '+234 805 201 8753, +234 907 051 8961';
  const schoolLogo = tenant.logo_url || tenant.logoUrl || '';

  console.log(`🏫 School: ${schoolName}`);

  // Fetch all students (with pagination if > 1000)
  let allStudents = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data: batch, error: batchErr } = await supabase
      .from('students')
      .select('*, lspay_student_wallets(*), levels!students_level_id_fkey(name)')
      .order('full_name', { ascending: true })
      .range(from, to);

    if (batchErr) {
      console.error('❌ Error fetching students:', batchErr.message);
      process.exit(1);
    }

    if (!batch || batch.length === 0) break;
    allStudents = allStudents.concat(batch);
    if (batch.length < pageSize) break;
    page++;
  }

  console.log(`👥 Found ${allStudents.length} students to generate cards for.`);

  // Load and Base64 encode the company logo (/logo-new.png)
  let companyLogoBase64 = '';
  const localLogoPath = path.join(projectRoot, 'public', 'logo-new.png');
  if (fs.existsSync(localLogoPath)) {
    const logoBuffer = fs.readFileSync(localLogoPath);
    companyLogoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
    console.log('✅ Embedded company logo (logo-new.png) as Base64.');
  } else {
    companyLogoBase64 = '/logo-new.png';
  }

  // Load and Base64 encode the African pattern background
  let africanPatternBase64 = '';
  const localPatternPath = path.join(projectRoot, 'public', 'african-pattern.jpg');
  if (fs.existsSync(localPatternPath)) {
    const patternBuffer = fs.readFileSync(localPatternPath);
    africanPatternBase64 = `data:image/jpeg;base64,${patternBuffer.toString('base64')}`;
    console.log('✅ Embedded African pattern (african-pattern.jpg) as Base64.');
  } else {
    africanPatternBase64 = '/african-pattern.jpg';
  }

  // Render a front card
  function renderFrontCardHtml(r) {
    const w = r.lspay_student_wallets || {};
    const cardId = w.card_hardware_id || r.reg_no;
    const studentName = r.full_name || '';
    const studentId = r.reg_no || '';
    const rawPhoto = r.avatar_path;
    const photoUrl = rawPhoto && !rawPhoto.includes('dicebear')
      ? rawPhoto
      : `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(studentName)}`;

    const qrSvg = renderToStaticMarkup(
      React.createElement(QRCodeSVG, {
        value: cardId,
        size: 70,
        level: 'M',
      })
    );

    return `
      <!-- Outer: full African pattern frame (inline style for guaranteed rendering) -->
      <div class="print-card-box" style="padding: 7px; background-image: url('${africanPatternBase64}'); background-size: cover; background-position: center; background-repeat: no-repeat; background-color: transparent; border: none; -webkit-print-color-adjust: exact; print-color-adjust: exact;">

        <!-- Inner white content plate -->
        <div style="width: 100%; height: 100%; border-radius: 8px; background: white; border: 1px solid #f1f5f9; box-shadow: 0 2px 8px rgba(0,0,0,0.10); display: flex; flex-direction: column; align-items: center; overflow: hidden; box-sizing: border-box;">

          <!-- Header: School Logo & Name -->
          <div style="width: 100%; display: flex; align-items: center; gap: 7px; padding: 8px 8px 6px; border-bottom: 1px solid #f1f5f9;">
            <div style="width: 28px; height: 28px; border-radius: 50%; border: 1px solid #e2e8f0; background: white; display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0;">
              ${
                schoolLogo
                  ? `<div class="school-logo-badge" style="width: 22px; height: 22px;"></div>`
                  : `<svg style="width: 16px; height: 16px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="#1e3a8a" stroke-width="1.5" stroke-linecap="round"/>
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="#1e3a8a" stroke-width="1.5" />
                      <circle cx="12" cy="9" r="2.5" fill="#ef4444"/>
                      <path d="M8 15c0-2.5 1.8-4 4-4s4 1.5 4 4" stroke="#ef4444" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>`
              }
            </div>
            <div style="flex: 1; min-width: 0; overflow: hidden;">
              <div style="color: #0f172a; font-weight: 800; font-size: 8.5px; line-height: 1.2; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
                ${schoolName}
              </div>
              <span style="font-size: 6.5px; color: #94a3b8; font-family: monospace; display: block; margin-top: 1px;">Student Identification</span>
            </div>
          </div>

          <!-- Photo -->
          <div style="margin: 6px 0 4px;">
            <div style="width: 70px; height: 70px; border-radius: 50%; border: 2px solid #e2e8f0; overflow: hidden; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(0,0,0,0.08);">
              <img src="${photoUrl}" alt="" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(studentName)}';" />
            </div>
          </div>

          <!-- Details -->
          <div style="display: flex; flex-direction: column; align-items: center; text-align: center; flex-grow: 1; justify-content: center; gap: 3px; width: 100%; padding: 0 8px;">
            <span style="color: #2563eb; font-weight: 700; font-size: 9px; font-family: monospace; letter-spacing: 0.04em;">${studentId}</span>
            <span style="color: #0f172a; font-weight: 800; font-size: 10px; line-height: 1.25; width: 164px; text-align: center; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${studentName}</span>

            <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 4px; background: white; display: flex; align-items: center; justify-content: center; width: 74px; height: 74px; margin-top: 2px;">
              ${qrSvg}
            </div>
          </div>

          <!-- Footer -->
          <div style="width: 100%; display: flex; align-items: center; justify-content: space-between; border-top: 1px solid #f1f5f9; padding: 5px 8px; margin-top: 2px;">
            <div style="width: 22px; height: 22px; border-radius: 50%; border: 1px solid #e2e8f0; background: white; display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0;">
              <div class="lspay-brand-logo" style="width: 14px; height: 14px;"></div>
            </div>
            ${
              schoolLogo
                ? `<div style="width: 22px; height: 22px; border-radius: 50%; border: 1px solid #e2e8f0; background: white; display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0;">
                    <div class="school-logo-badge" style="width: 16px; height: 16px;"></div>
                  </div>`
                : ''
            }
          </div>

        </div>
      </div>
    `;
  }

  // Render a back card (African pattern design)
  function renderBackCardHtml(r) {
    return `
      <div class="print-card-box card-back-african">
        <!-- Frosted Inner Container -->
        <div style="width: 100%; height: 100%; border-radius: 9px; background: white; border: 1px solid #f1f5f9; box-shadow: 0 2px 6px rgba(0,0,0,0.12); padding: 10px 8px; display: flex; flex-direction: column; align-items: center; justify-content: space-between; box-sizing: border-box; text-align: center;">

          <!-- School Crest & Name -->
          <div style="display: flex; flex-direction: column; align-items: center; gap: 5px; width: 100%; margin-top: 2px;">
            <div style="width: 80px; height: 80px; border-radius: 50%; border: 1.5px solid #e2e8f0; display: flex; align-items: center; justify-content: center; background: white; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.06);">
              ${
                schoolLogo
                  ? `<div class="school-logo-badge" style="width: 66px; height: 66px;"></div>`
                  : `<svg style="width: 52px; height: 52px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="#1e3a8a" stroke-width="1.5" stroke-linecap="round"/>
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="#1e3a8a" stroke-width="1.5" />
                      <circle cx="12" cy="9" r="2.5" fill="#ef4444"/>
                      <path d="M8 15c0-2.5 1.8-4 4-4s4 1.5 4 4" stroke="#ef4444" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>`
              }
            </div>
            <span style="font-size: 9.5px; font-weight: 900; color: #0f172a; margin-top: 4px; text-align: center; width: 168px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; line-height: 1.25; letter-spacing: 0.01em;">
              ${schoolName}
            </span>
            <span style="font-size: 6.5px; color: #64748b; font-family: monospace; letter-spacing: 0.06em; font-weight: 600;">
              Student Identification Card
            </span>
          </div>

          <!-- Details -->
          <div style="display: flex; flex-direction: column; align-items: center; text-align: center; gap: 4px; width: 100%; margin: auto 0;">
            <span style="color: #334155; font-size: 8px; line-height: 1.35; max-width: 155px; font-weight: 500;">${schoolAddress}</span>
            <span style="color: #1e293b; font-size: 8px; font-family: monospace; font-weight: 700; margin-top: 2px;">${schoolPhone}</span>
          </div>

          <!-- Footer Brand -->
          <div style="width: 100%; display: flex; align-items: center; justify-content: space-between; border-top: 1px solid #e2e8f0; padding-top: 5px;">
            <div style="display: flex; align-items: center; gap: 5px;">
              <div style="width: 22px; height: 22px; border-radius: 50%; border: 1px solid #e2e8f0; background: white; display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0;">
                <div class="lspay-brand-logo" style="width: 16px; height: 16px;"></div>
              </div>
              <span style="font-size: 7.5px; color: #475569; font-family: monospace; font-weight: 600;">umusa.cloud</span>
            </div>
            <span style="font-size: 7px; color: #94a3b8; font-family: monospace;">VERIFIED</span>
          </div>

        </div>
      </div>
    `;
  }

  // Generate cards layout markup
  let cardsMarkup = '';
  if (layout === 'grid_a4') {
    // 8 per A4 page (4 columns x 2 rows in Landscape)
    for (let i = 0; i < allStudents.length; i += 8) {
      const chunk = allStudents.slice(i, i + 8);
      cardsMarkup += `
        <div class="print-grid-sheet-8">
          ${chunk.map(s => renderFrontCardHtml(s)).join('\n')}
        </div>
      `;
    }
  } else if (layout === 'front_only') {
    cardsMarkup = allStudents.map(s => `
      <div class="print-card-page">
        ${renderFrontCardHtml(s)}
      </div>
    `).join('\n');
  } else {
    // Standard CR80 Pair (Front & Back)
    cardsMarkup = allStudents.map(s => `
      <div class="print-card-page">
        ${renderFrontCardHtml(s)}
        ${renderBackCardHtml(s)}
      </div>
    `).join('\n');
  }

  const finalHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${schoolName} — ${allStudents.length} Student ID Cards</title>
  <style>
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .lspay-brand-logo {
      width: 20px;
      height: 20px;
      background-image: url('${companyLogoBase64}');
      background-size: contain;
      background-repeat: no-repeat;
      background-position: center;
      display: inline-block;
    }
    .school-logo-badge {
      background-image: url('${schoolLogo}');
      background-size: contain;
      background-repeat: no-repeat;
      background-position: center;
      display: inline-block;
    }
    body {
      margin: 0;
      padding: 0;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0f172a;
      color: #f8fafc;
    }
    .no-print {
      display: block;
    }
    .export-header {
      position: sticky;
      top: 0;
      left: 0;
      right: 0;
      background: #1e293b;
      border-bottom: 2px solid #334155;
      padding: 16px 28px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      z-index: 9999;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5);
    }
    .export-title {
      font-size: 18px;
      font-weight: 800;
      color: #ffffff;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .export-subtitle {
      font-size: 13px;
      color: #94a3b8;
      margin-top: 4px;
    }
    .btn-print {
      background: #10b981;
      color: #ffffff;
      border: none;
      padding: 12px 24px;
      font-size: 15px;
      font-weight: 700;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: background 0.2s, transform 0.1s;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.35);
    }
    .btn-print:hover {
      background: #059669;
      transform: translateY(-1px);
    }
    .btn-print:active {
      transform: translateY(0);
    }
    .print-workspace {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 36px 12px;
      background: #0f172a;
      min-height: 100vh;
      gap: 28px;
    }
    .print-card-page {
      display: flex;
      flex-direction: row;
      gap: 24px;
      align-items: center;
      justify-content: center;
      background: #ffffff;
      padding: 24px;
      border-radius: 16px;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.4);
    }
    .print-grid-sheet-8 {
      display: grid;
      grid-template-columns: repeat(4, 204px);
      grid-template-rows: repeat(2, 324px);
      gap: 12px 18px;
      justify-content: center;
      background: #ffffff;
      padding: 24px;
      border-radius: 16px;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.4);
    }
    .print-card-box {
      width: 204px;
      height: 324px;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      overflow: hidden;
      box-sizing: border-box;
      background: white !important;
      color: black !important;
      font-family: sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 0;
      position: relative;
    }
    .print-card-box.card-back-african,
    .print-card-box.card-front-frame {
      padding: 7px !important;
      background-image: url('${africanPatternBase64}') !important;
      background-size: cover !important;
      background-position: center !important;
      background-repeat: no-repeat !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      background-color: transparent !important;
    }
    @page {
      margin: 6mm;
      size: ${layout === 'grid_a4' ? 'landscape' : 'portrait'};
    }
    @media print {
      body {
        background: white !important;
        color: black !important;
      }
      .no-print {
        display: none !important;
      }
      .print-workspace {
        padding: 0 !important;
        background: transparent !important;
        gap: 0 !important;
      }
      .print-card-page {
        margin: 0 !important;
        padding: 0 !important;
        box-shadow: none !important;
        background: transparent !important;
        min-height: 98vh !important;
        display: flex !important;
        flex-direction: row !important;
        gap: 24px !important;
        align-items: center !important;
        justify-content: center !important;
        page-break-after: always !important;
        break-after: page !important;
      }
      .print-card-page:last-child {
        page-break-after: avoid !important;
        break-after: avoid !important;
      }
      .print-grid-sheet-8 {
        margin: 0 !important;
        padding: 4mm 0 !important;
        box-shadow: none !important;
        background: transparent !important;
        min-height: 98vh !important;
        display: grid !important;
        grid-template-columns: repeat(4, 204px) !important;
        grid-template-rows: repeat(2, 324px) !important;
        gap: 12px 18px !important;
        justify-content: center !important;
        align-content: center !important;
        page-break-after: always !important;
        break-after: page !important;
      }
      .print-grid-sheet-8:last-child {
        page-break-after: avoid !important;
        break-after: avoid !important;
      }
      .print-card-box {
        width: 204px !important;
        height: 324px !important;
        border: 1px solid #cbd5e1 !important;
        border-radius: 12px !important;
        background: white !important;
        color: black !important;
      }
      .print-card-box.card-back-african {
        padding: 7px !important;
        background-image: url('${africanPatternBase64}') !important;
        background-size: cover !important;
        background-position: center !important;
        background-repeat: no-repeat !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .print-card-box.card-front-frame {
        background-image: url('${africanPatternBase64}') !important;
        background-size: cover !important;
        background-position: center !important;
        background-repeat: no-repeat !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        background-color: transparent !important;
      }
      .lspay-brand-logo {
        background-image: url('${companyLogoBase64}') !important;
        background-size: contain !important;
        background-repeat: no-repeat !important;
        background-position: center !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }
  </style>
</head>
<body>
  <div class="no-print export-header">
    <div>
      <div class="export-title">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/><path d="M6 8V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4"/></svg>
        <span>${schoolName} — Ready for Printing</span>
      </div>
      <div class="export-subtitle">${allStudents.length} Student ID Cards • Layout: ${layout.replace('_', ' ').toUpperCase()} • CR80 Portrait (85.6mm × 54mm)</div>
    </div>
    <button class="btn-print" onclick="window.print()">
      🖨️ Print / Save as PDF (${allStudents.length} Cards)
    </button>
  </div>
  <div class="print-workspace">
    ${cardsMarkup}
  </div>
</body>
</html>`;

  fs.writeFileSync(outputFile, finalHtml, 'utf8');
  const stats = fs.statSync(outputFile);
  const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);

  console.log('----------------------------------------------------');
  console.log('🎉 Export Completed Successfully!');
  console.log(`📁 File Saved: ${outputFile}`);
  console.log(`📊 File Size: ${sizeMb} MB`);
  console.log(`🎴 Cards Exported: ${allStudents.length}`);
  console.log('----------------------------------------------------');
  console.log('💡 How to Print or Save as PDF:');
  console.log('1. Double click or open the .html file in Google Chrome, Microsoft Edge, or Firefox.');
  console.log('2. Click the green "🖨️ Print / Save as PDF" button at the top (or press Ctrl+P).');
  console.log('3. In the printer destination, select "Save as PDF" (or select your card/badge printer).');
  console.log('4. Ensure "Background graphics" is CHECKED, and Margins are set to "None" or "Default".');
  console.log('5. Click Save/Print. All cards will cleanly generate in a single multi-page file!');
}

main().catch(err => {
  console.error('Fatal error during export:', err);
  process.exit(1);
});
