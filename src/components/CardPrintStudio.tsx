import { useState, useMemo, Fragment } from "react";
import { Student, Tenant } from "@/lib/types";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Printer, RefreshCw, Download, ChevronLeft, ChevronRight, Layers } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/store";

interface CardPrintStudioProps {
  student?: Student;
  students?: Student[];
  tenant?: Tenant;
  isOpen: boolean;
  onClose: () => void;
}

// Helper to scale down an image to a compact Base64 data URL so exported files are 100% self-contained offline
const getScaledDataUrl = (
  src: string,
  targetWidth: number,
  targetHeight: number,
  format: "image/png" | "image/jpeg" = "image/png",
  quality = 0.9
): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
          resolve(canvas.toDataURL(format, quality));
          return;
        }
      } catch (err) {
        console.warn("Canvas export error:", err);
      }
      resolve(src);
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
};

// Capitalise the first letter of each word in the school name on the card
const titleCase = (s: string) => s.replace(/\b([a-z])/g, (c) => c.toUpperCase());

// ─── Card artwork ────────────────────────────────────────────────────────────
// The cards are drawn with inline styles only (no Tailwind classes) because the same markup is copied into
// the print iframe and the exported HTML file, where the app's stylesheet isn't available.
// Physical size: CR80 portrait, drawn at 204 × 324 px.
// Design: white card. Front: a light grey photo panel with blue, green and red circles behind a round photo
// with a grey ring; the student ID, the name, a few coloured dots and balls, and a grey footer with the school
// crest and name. Back: the QR code on a white tile (the kiosk scans it), school name, address and phone, and
// a footer with the Nova mark and umusa.cloud.
const CARD_W = 204;
const CARD_H = 324;
const PANEL = { left: 15, top: 16, width: 174, height: 150 };   // front photo panel
const PHOTO = { cx: 102, cy: 96, r: 50 };                        // centre of the round photo, card coordinates

const INK = "#111111";
const LINE = "#D9DCE3";
const BLUE = "#0EA5E9";
const GREEN = "#22B14C";
const RED = "#ED1C24";

// Montserrat for the card. Loaded by the print window / exported file via CARD_FONTS_LINK.
const DISPLAY = "'Montserrat', 'Nunito', Arial, sans-serif";
const BODY = "'Montserrat', 'Nunito', Arial, Helvetica, sans-serif";
const CARD_FONTS_LINK = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700;800&family=Nunito:wght@600;700;800&display=swap" rel="stylesheet">`;

/** Current school session: a new one starts in September (e.g. October 2026 -> "2026/2027"). */
const currentSession = (d = new Date()) => { const y = d.getFullYear(); return d.getMonth() >= 8 ? `${y}/${y + 1}` : `${y - 1}/${y}`; };

/** A flat circle (dot) or a shiny ball, placed by its centre in card coordinates. */
const blob = (cx: number, cy: number, r: number, color: string, ball = false): React.CSSProperties => ({
  position: "absolute", left: `${cx - r}px`, top: `${cy - r}px`, width: `${r * 2}px`, height: `${r * 2}px`, borderRadius: "50%",
  background: ball ? `radial-gradient(circle at 32% 30%, rgba(255,255,255,0.85) 0, rgba(255,255,255,0) 22%), radial-gradient(circle at 50% 50%, ${color} 55%, rgba(0,0,0,0.28) 100%)` : color,
});

const cardShell = (extra: React.CSSProperties = {}): React.CSSProperties => ({
  width: `${CARD_W}px`,
  height: `${CARD_H}px`,
  position: "relative",
  overflow: "hidden",
  borderRadius: "12px",
  boxSizing: "border-box",
  background: "#FFFFFF",
  color: "#111111",
  fontFamily: BODY,
  WebkitPrintColorAdjust: "exact",
  printColorAdjust: "exact",
  ...extra,
});

const initialsAvatar = (name: string) => `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`;

export function CardPrintStudio({ student, students, tenant, isOpen, onClose }: CardPrintStudioProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [printLayout, setPrintLayout] = useState<"pair" | "front_only" | "grid_a4">("pair");
  const { tenants, setPrintStatus } = useStore();
  const [marked, setMarked] = useState<"idle" | "busy" | "done" | "error">("idle");

  // Bulk printing never includes students marked "Not ready" (left the school / wrong class) or cards already
  // printed (no second card by mistake). Printing one student on purpose still works, with a warning.
  const skippedNotReady = useMemo(() => (students ?? []).filter((s) => s.printStatus === "not_ready"), [students]);
  const skippedPrinted = useMemo(() => (students ?? []).filter((s) => s.printStatus === "printed"), [students]);
  const printList = useMemo(() => {
    if (students && students.length > 0) return students.filter((s) => s.printStatus !== "not_ready" && s.printStatus !== "printed");
    return student ? [student] : [];
  }, [students, student]);
  // after printing: record these cards as printed, so the school always knows which ones are done
  const markPrinted = async () => {
    setMarked("busy");
    const r = await setPrintStatus(printList.map((s) => s.id), "printed");
    setMarked(r.success ? "done" : "error");
  };

  const chunkedGrid = useMemo(() => {
    const chunks: Student[][] = [];
    for (let i = 0; i < printList.length; i += 8) {
      chunks.push(printList.slice(i, i + 8));
    }
    return chunks;
  }, [printList]);

  const activeStudent = (printList.length > 0 ? printList[Math.min(previewIndex, printList.length - 1)] : student) || null;

  const activeStudentTenant = (activeStudent?.tenantId ? tenants.find(t => t.id === activeStudent.tenantId) : null) || tenant || (tenants.length === 1 ? tenants[0] : undefined);
  const schoolName = titleCase(activeStudentTenant?.name || tenant?.name || "Demonstration Schools Kaduna");
  const schoolAddress = activeStudentTenant?.address || tenant?.address || "5-7 Alor Close U/Pama Kaduna";
  const schoolLogo = activeStudentTenant?.logoUrl || tenant?.logoUrl;

  const cardCss = `
    .id-card {
      width: ${CARD_W}px !important;
      height: ${CARD_H}px !important;
      border: 1px solid #d1d5db !important;
      border-radius: 12px !important;
      overflow: hidden !important;
      position: relative !important;
      box-sizing: border-box !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }`;

  const handlePrint = () => {
    const printArea = document.getElementById("lspay-print-area");
    if (!printArea) return;

    // Use an isolated print iframe to bypass Radix Dialog transforms, viewport constraints, and dark-mode styles
    const existingFrame = document.getElementById("lspay-print-iframe");
    if (existingFrame) existingFrame.remove();

    const iframe = document.createElement("iframe");
    iframe.id = "lspay-print-iframe";
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.zIndex = "-9999";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    const isLandscape = printLayout === "grid_a4";
    const pageOrientation = isLandscape ? "landscape" : "portrait";

    const contentHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  ${CARD_FONTS_LINK}
  <title>${schoolName} — ID Cards</title>
  <style>
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    @page {
      size: ${pageOrientation};
      margin: 6mm;
    }
    body {
      margin: 0;
      padding: 0;
      background: white !important;
      color: black !important;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .print-card-page {
      width: 100%;
      min-height: 98vh;
      display: flex !important;
      flex-direction: row !important;
      gap: 24px !important;
      align-items: center !important;
      justify-content: center !important;
      page-break-after: always !important;
      break-after: page !important;
      box-sizing: border-box !important;
    }
    .print-card-page:last-child {
      page-break-after: avoid !important;
      break-after: avoid !important;
    }
    .print-grid-sheet-8 {
      width: 100%;
      min-height: 98vh;
      display: grid !important;
      grid-template-columns: repeat(4, ${CARD_W}px) !important;
      grid-template-rows: repeat(2, ${CARD_H}px) !important;
      gap: 12px 18px !important;
      justify-content: center !important;
      align-content: center !important;
      page-break-after: always !important;
      break-after: page !important;
      padding: 4mm 0 !important;
      box-sizing: border-box !important;
    }
    .print-grid-sheet-8:last-child {
      page-break-after: avoid !important;
      break-after: avoid !important;
    }
    ${cardCss}
  </style>
</head>
<body>
  ${printArea.innerHTML.replace(/<style[\s\S]*?<\/style>/gi, "")}
</body>
</html>`;

    doc.open();
    doc.write(contentHtml);
    doc.close();

    // Print once the card fonts (Montserrat / Nunito) have loaded, so the printout matches the preview;
    // give up waiting after 4 s so printing still works offline (fallback fonts).
    const printNow = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        iframe.remove();
      }, 3000);
    };
    setTimeout(() => {
      const fonts = iframe.contentWindow?.document.fonts;
      if (!fonts) { printNow(); return; }
      Promise.race([
        Promise.all([fonts.load("800 12px Montserrat"), fonts.load("500 12px Montserrat")]).then(() => fonts.ready),
        new Promise((r) => setTimeout(r, 4000)),
      ]).then(printNow, printNow);
    }, 200);
  };

  const handleExportHTML = async () => {
    const printArea = document.getElementById("lspay-print-area");
    if (!printArea) return;
    const cleanSchoolName = schoolName.replace(/[^a-zA-Z0-9_-]/g, "_");
    const fileName = `${cleanSchoolName}_${printList.length}_Student_Cards.html`;

    let htmlContent = printArea.innerHTML.replace(/<style[\s\S]*?<\/style>/gi, "");

    // Pre-scale assets to compact Base64 so the HTML file is 100% self-contained offline
    let logoBase64 = "/logo-new.png";
    try {
      const lB64 = await getScaledDataUrl("/logo-new.png", 120, 120, "image/png");
      if (lB64) logoBase64 = lB64;
    } catch (e) {
      console.warn("Could not pre-encode assets to base64", e);
    }

    // Replace img src occurrences so the file works offline
    htmlContent = htmlContent.replace(/src=["'][^"']*logo-new\.png["']/g, `src="${logoBase64}"`);

    const isLandscape = printLayout === "grid_a4";
    const pageOrientation = isLandscape ? "landscape" : "portrait";

    const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${CARD_FONTS_LINK}
  <title>${schoolName} — ${printList.length} Student ID Cards</title>
  <style>
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      margin: 0;
      padding: 0;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #1B1942;
      color: #F7F5FD;
    }
    .no-print {
      display: block;
    }
    .export-header {
      position: sticky;
      top: 0;
      left: 0;
      right: 0;
      background: #2B2863;
      border-bottom: 1px solid #3D3990;
      padding: 16px 28px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      z-index: 9999;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.4);
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
      color: #C9C4EC;
      margin-top: 4px;
    }
    .btn-print {
      background: #F2B33D;
      color: #2B2863;
      border: none;
      padding: 12px 24px;
      font-size: 15px;
      font-weight: 800;
      border-radius: 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: filter 0.2s, transform 0.1s;
      box-shadow: 0 6px 16px rgba(242, 179, 61, 0.35);
    }
    .btn-print:hover {
      filter: brightness(1.05);
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
      background: #1B1942;
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
      grid-template-columns: repeat(4, ${CARD_W}px);
      grid-template-rows: repeat(2, ${CARD_H}px);
      gap: 12px 18px;
      justify-content: center;
      background: #ffffff;
      padding: 24px;
      border-radius: 16px;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.4);
    }
    ${cardCss}
    @page {
      margin: 6mm;
      size: ${pageOrientation};
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
        grid-template-columns: repeat(4, ${CARD_W}px) !important;
        grid-template-rows: repeat(2, ${CARD_H}px) !important;
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
    }
  </style>
</head>
<body>
  <div class="no-print export-header">
    <div>
      <div class="export-title">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F2B33D" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/><path d="M6 8V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4"/></svg>
        <span>${schoolName} — Ready for Printing</span>
      </div>
      <div class="export-subtitle">${printList.length} Student ID Cards • Layout: ${printLayout === 'grid_a4' ? 'A4 Sheet (8 per Page — Landscape 4×2)' : printLayout === 'pair' ? 'CR80 Pair (Front & Back)' : 'Front Cards Only'}</div>
    </div>
    <button class="btn-print" onclick="window.print()">
      🖨️ Print / Save as PDF (${printList.length} Cards)
    </button>
  </div>
  <div class="print-workspace">
    ${htmlContent}
  </div>
</body>
</html>`;

    const blob = new Blob([fullHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!activeStudent) return null;

  const tenantFor = (stud: Student) =>
    (stud.tenantId ? tenants.find(t => t.id === stud.tenantId) : null) || tenant || (tenants.length === 1 ? tenants[0] : undefined);

  // FRONT — photo panel (no background) with coloured circles and the round photo, student ID, name, footer with the school.
  // (uid is kept for callers; the design no longer needs per-card SVG ids.)
  const renderFrontCard = (stud: Student, _uid: string) => {
    const studTenant = tenantFor(stud);
    const studSchoolName = titleCase(studTenant?.name || schoolName);
    const studSchoolLogo = studTenant?.logoUrl || schoolLogo;
    const P = PANEL;

    return (
      <div className="id-card" style={cardShell({ background: "#FFFFFF", border: `1px solid ${LINE}` })}>
        {/* Photo panel: the circles are clipped to the panel */}
        <div style={{ position: "absolute", left: `${P.left}px`, top: `${P.top}px`, width: `${P.width}px`, height: `${P.height}px`, overflow: "hidden" }}>
          <div style={blob(56 - P.left, 58 - P.top, 34, BLUE)} />
          <div style={blob(158 - P.left, 92 - P.top, 17, GREEN)} />
          <div style={blob(148 - P.left, 146 - P.top, 16, RED)} />
        </div>

        {/* Round photo with a grey ring */}
        <div style={{ position: "absolute", left: `${PHOTO.cx - PHOTO.r}px`, top: `${PHOTO.cy - PHOTO.r}px`, width: `${PHOTO.r * 2}px`, height: `${PHOTO.r * 2}px`, borderRadius: "50%", background: "#FFFFFF", border: "4px solid #BDBDBD", boxSizing: "border-box", overflow: "hidden" }}>
          {/* Headshot only: studio portraits (lib/portraitStudio) put the head top at 14% and the head at ~52% of
              the square, so zooming 1.6× and shifting up centres the head and fills the circle edge to edge. */}
          <img
            src={stud.imageUrl || initialsAvatar(stud.name)}
            alt=""
            style={stud.imageUrl
              ? { position: "absolute", width: "160%", height: "160%", left: "-30%", top: "-14%", maxWidth: "none", objectFit: "cover", objectPosition: "center top", display: "block" }
              : { width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            onError={(e) => {
              const img = e.target as HTMLImageElement;
              img.src = initialsAvatar(stud.name);
              img.style.cssText = "width:100%;height:100%;object-fit:cover;display:block";
            }}
          />
        </div>

        {/* Dots and balls around the name */}
        <div style={blob(10, 214, 3, "#9B59D0")} />
        <div style={blob(24, 236, 2.6, "#E8B91E")} />
        <div style={blob(4, 270, 19, "#2F6FE4", true)} />
        <div style={blob(180, 252, 6.5, "#2E9E4F", true)} />
        <div style={blob(203, 262, 17, "#F05A4F", true)} />
        <div style={blob(190, 280, 3, "#2F6FE4", true)} />

        {/* Student ID and name */}
        <div style={{ position: "absolute", left: "26px", right: "26px", top: `${P.top + P.height + 18}px`, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "4px" }}>
          <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: "10.5px", letterSpacing: "0.03em", color: "#555555" }}>{stud.studentId}</span>
          <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: stud.name.length > 26 ? "12.5px" : "14px", lineHeight: 1.22, color: INK, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{stud.name}</span>
        </div>

        {/* Footer: school crest and name */}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "42px", background: "#F4F5F8", borderTop: `1px solid ${LINE}`, display: "flex", alignItems: "center", gap: "8px", padding: "0 10px", boxSizing: "border-box" }}>
          {studSchoolLogo ? (
            <div style={{ width: "26px", height: "26px", borderRadius: "50%", background: "#FFFFFF", border: `1px solid ${LINE}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
              <img src={studSchoolLogo} alt="" style={{ width: "21px", height: "21px", objectFit: "contain" }} />
            </div>
          ) : null}
          <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: studSchoolName.length > 34 ? "7.5px" : "8.5px", lineHeight: 1.25, color: INK, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
            {studSchoolName}
          </span>
        </div>
      </div>
    );
  };

  // BACK — QR code on a white tile, school name, address and phone, footer with the Nova mark and umusa.cloud.
  const renderBackCard = (stud: Student) => {
    const studTenant = tenantFor(stud);
    const studSchoolName = titleCase(studTenant?.name || schoolName);
    const studSchoolAddress = studTenant?.address || schoolAddress;
    const studSchoolPhone = studTenant?.phone || "";
    const small: React.CSSProperties = { fontFamily: DISPLAY, fontWeight: 700, fontSize: "8.5px", lineHeight: 1.35, color: INK, maxWidth: "176px", overflowWrap: "anywhere" };

    return (
      <div className="id-card" style={cardShell({ background: "#FFFFFF", border: `1px solid ${LINE}` })}>
        {/* QR code on a white tile: high contrast and a clear margin so the kiosk scanner reads it reliably */}
        <div style={{ position: "absolute", left: "50%", top: "18px", transform: "translateX(-50%)", width: "134px", height: "134px", borderRadius: "16px", background: "#FFFFFF", border: "1px solid #E3E5EA", boxShadow: "0 4px 12px rgba(17,17,17,0.10)", display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box" }}>
          <QRCodeSVG value={stud.cardHardwareId || stud.studentId} size={112} level="M" fgColor="#000000" bgColor="#FFFFFF" />
        </div>

        {/* School name, address, phone */}
        <div style={{ position: "absolute", left: "12px", right: "12px", top: "176px", bottom: "46px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "6px" }}>
          <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: studSchoolName.length > 34 ? "12px" : "13.5px", lineHeight: 1.25, color: INK, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", marginBottom: "4px" }}>{studSchoolName}</span>
          {studSchoolAddress ? <span style={{ ...small, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{studSchoolAddress}</span> : null}
          {studSchoolPhone ? <span style={small}>{studSchoolPhone}</span> : null}
        </div>

        {/* Footer: Nova mark + umusa.cloud */}
        <div style={{ position: "absolute", left: "10px", right: "10px", bottom: 0, height: "40px", borderTop: `1px solid ${LINE}`, display: "flex", alignItems: "center", gap: "8px", padding: "0 2px", boxSizing: "border-box" }}>
          <div style={{ width: "22px", height: "22px", borderRadius: "50%", background: "#FFFFFF", border: `1px solid ${LINE}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20 L9 4 H12 L15 13 L17 4 H20 L15 20 H12 L9 11 L7 20 Z" fill="#1E3A8A" /></svg>
          </div>
          <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: "9px", color: INK }}>umusa.cloud</span>
        </div>
      </div>
    );
  };

  // Preview is drawn at 220 px wide
  const previewScale = 220 / CARD_W;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[620px] w-full bg-card border-border text-foreground p-5 sm:p-6">
        <DialogHeader className="border-b border-border pb-4 pr-10 text-left">
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="text-xl flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-lilac text-ink-2"><Printer className="w-4 h-4" /></span>
              <span className="font-display">Card Printing Studio</span>
            </DialogTitle>
            {printList.length > 1 && (
              <Badge variant="outline" className="text-xs px-2.5 py-0.5 bg-lilac text-ink-2 border-transparent shrink-0">
                {printList.length} cards
              </Badge>
            )}
          </div>
        </DialogHeader>

        <div className="flex flex-col items-center pt-1 pb-1 space-y-4">
          {skippedNotReady.length > 0 && (
            <p className="w-full max-w-md rounded-xl bg-peach px-3 py-2 text-center text-xs font-bold text-amber-700" role="status" data-testid="print-skipped-not-ready">
              {skippedNotReady.length} student{skippedNotReady.length === 1 ? " is" : "s are"} marked Not ready and {skippedNotReady.length === 1 ? "was" : "were"} left out: {skippedNotReady.slice(0, 5).map((s) => s.name).join(", ")}{skippedNotReady.length > 5 ? ` and ${skippedNotReady.length - 5} more` : ""}.
            </p>
          )}
          {skippedPrinted.length > 0 && (
            <p className="w-full max-w-md rounded-xl bg-lilac px-3 py-2 text-center text-xs font-bold text-primary" role="status" data-testid="print-skipped-printed">
              {skippedPrinted.length} card{skippedPrinted.length === 1 ? " was" : "s were"} already printed and {skippedPrinted.length === 1 ? "is" : "are"} left out. To reprint one, open that student and print it on its own.
            </p>
          )}
          {!students?.length && student?.printStatus === "printed" && (
            <p className="w-full max-w-md rounded-xl bg-peach px-3 py-2 text-center text-xs font-bold text-amber-700" role="alert">
              {student.name}'s card was already printed{student.printStatusAt ? ` on ${new Date(student.printStatusAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : ""}. Printing again makes a second card.
            </p>
          )}
          {!students?.length && student?.printStatus === "not_ready" && (
            <p className="w-full max-w-md rounded-xl bg-blush px-3 py-2 text-center text-xs font-bold text-red-700" role="alert">
              {student.name} is marked Not ready for card printing. Check they are still in this class before printing.
            </p>
          )}
          <p className="text-center text-xs text-muted-foreground max-w-sm">
            Standard CR80 card (85.6mm × 54mm). Tap the card to see the back — the QR code is printed on the back.
          </p>

          {printList.length > 1 && (
            <div className="flex items-center justify-between w-full max-w-[300px] px-1.5 py-1 bg-muted rounded-xl text-xs">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPreviewIndex(i => Math.max(0, i - 1))}
                disabled={previewIndex === 0}
                className="h-8 px-2 text-xs"
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Prev
              </Button>
              <span className="font-bold text-foreground">
                Card {previewIndex + 1} of {printList.length}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPreviewIndex(i => Math.min(printList.length - 1, i + 1))}
                disabled={previewIndex >= printList.length - 1}
                className="h-8 px-2 text-xs"
              >
                Next <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          )}

          {/* Interactive 3D card preview */}
          <div
            className="perspective-1000 cursor-pointer"
            style={{ width: `${CARD_W * previewScale}px`, height: `${CARD_H * previewScale}px` }}
            onClick={() => setIsFlipped(!isFlipped)}
            title="Tap to flip"
            data-testid="card-preview"
          >
            <div className={`relative w-full h-full transition-transform duration-700 transform-style-3d ${isFlipped ? "rotate-y-180" : ""}`}>
              <div className="absolute inset-0 backface-hidden rounded-[13px] shadow-xl select-none">
                <div style={{ transform: `scale(${previewScale})`, transformOrigin: "top left" }}>
                  {renderFrontCard(activeStudent, `pv-${activeStudent.id}`)}
                </div>
              </div>
              <div className="absolute inset-0 backface-hidden rotate-y-180 rounded-[13px] shadow-xl select-none">
                <div style={{ transform: `scale(${previewScale})`, transformOrigin: "top left" }}>
                  {renderBackCard(activeStudent)}
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
            <span className={`h-1.5 w-1.5 rounded-full ${!isFlipped ? "bg-primary" : "bg-border"}`} /> Front
            <span className={`ml-2 h-1.5 w-1.5 rounded-full ${isFlipped ? "bg-primary" : "bg-border"}`} /> Back
          </div>

          {/* Controls: Flip & Print Layout */}
          <div className="w-full bg-muted/50 border border-border rounded-2xl p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-foreground min-w-0">
              <Layers className="w-4 h-4 text-primary shrink-0" />
              <span className="shrink-0">Layout</span>
              <Select value={printLayout} onValueChange={(v: any) => setPrintLayout(v)}>
                <SelectTrigger className="bg-card border-border text-foreground text-xs h-9 w-full sm:w-[250px] font-semibold">
                  <SelectValue placeholder="Print Layout" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border text-foreground">
                  <SelectItem value="grid_a4">A4 Sheet (8 per Page — Landscape 4×2)</SelectItem>
                  <SelectItem value="pair">Standard CR80 (Front & Back Pair)</SelectItem>
                  <SelectItem value="front_only">Front Cards Only (1 per Page)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsFlipped(!isFlipped)}
              className="text-xs h-9 shrink-0"
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Flip card
            </Button>
          </div>

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between w-full gap-2 border-t border-border pt-4">
            <Button variant="ghost" onClick={onClose} className="text-xs sm:text-sm">
              Close
            </Button>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <Button
                variant="outline"
                onClick={handleExportHTML}
                className="font-bold flex items-center justify-center gap-1.5 text-xs sm:text-sm h-10 px-4"
                title="Download single self-contained HTML file ready for printing on any machine"
              >
                <Download className="w-4 h-4 text-primary" /> Export File (.html)
              </Button>
              <Button
                onClick={handlePrint}
                variant="highlight"
                className="flex items-center justify-center gap-1.5 text-xs sm:text-sm h-10 px-5"
              >
                <Printer className="mr-1 h-4 w-4" /> Print / Save PDF ({printList.length})
              </Button>
              {printList.length > 0 && (
                <Button
                  onClick={markPrinted}
                  variant="outline"
                  disabled={marked === "busy" || marked === "done"}
                  className="flex items-center justify-center gap-1.5 text-xs sm:text-sm h-10 px-4 font-bold"
                  title="After the cards come out of the printer, record them as printed"
                  data-testid="btn-mark-printed"
                >
                  {marked === "done" ? <>✓ Marked as printed</> : marked === "busy" ? <>Saving…</> : marked === "error" ? <>Not saved, try again</> : <>Mark these {printList.length} as printed</>}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* PRINT WRAPPER FOR WINDOW PRINTING */}
        <div id="lspay-print-area" className="hidden">
          <style>{`
            @media print {
              body * {
                visibility: hidden !important;
              }
              #lspay-print-area, #lspay-print-area * {
                visibility: visible !important;
              }
              #lspay-print-area {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                height: auto !important;
                display: block !important;
                background: white !important;
              }
              .print-card-page {
                width: 100%;
                min-height: 98vh;
                display: flex !important;
                flex-direction: row !important;
                gap: 24px !important;
                align-items: center;
                justify-content: center;
                page-break-after: always;
                break-after: page;
                box-sizing: border-box;
              }
              .print-card-page:last-child {
                page-break-after: avoid;
                break-after: avoid;
              }
              .print-grid-sheet-8 {
                width: 100%;
                min-height: 98vh;
                display: grid !important;
                grid-template-columns: repeat(4, ${CARD_W}px) !important;
                grid-template-rows: repeat(2, ${CARD_H}px) !important;
                gap: 12px 18px !important;
                justify-content: center !important;
                align-content: center !important;
                page-break-after: always !important;
                break-after: page !important;
                box-sizing: border-box !important;
                padding: 4mm 0 !important;
              }
              .print-grid-sheet-8:last-child {
                page-break-after: avoid;
                break-after: avoid;
              }
              ${cardCss}
            }
          `}</style>

          {printLayout === "grid_a4" ? (
            chunkedGrid.map((group, gIdx) => (
              <div className="print-grid-sheet-8" key={gIdx}>
                {group.map((stud) => (
                  <Fragment key={stud.id}>
                    {renderFrontCard(stud, `pr-${stud.id}`)}
                  </Fragment>
                ))}
              </div>
            ))
          ) : printLayout === "front_only" ? (
            printList.map((stud) => (
              <div className="print-card-page" key={stud.id}>
                {renderFrontCard(stud, `pr-${stud.id}`)}
              </div>
            ))
          ) : (
            printList.map((stud) => (
              <div className="print-card-page" key={stud.id}>
                {renderFrontCard(stud, `pr-${stud.id}`)}
                {renderBackCard(stud)}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
