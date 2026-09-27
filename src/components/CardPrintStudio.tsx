import { useState, useMemo, Fragment } from "react";
import { Student, Tenant } from "@/lib/types";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Printer, RefreshCw, Download, ChevronLeft, ChevronRight, Layers, FileCode } from "lucide-react";
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

// Company Logo (LSPay blue logo)
const CompanyLogo = () => (
  <div className="w-7 h-7 rounded-full border border-gray-200 bg-white flex items-center justify-center shadow-sm shrink-0 overflow-hidden">
    <div className="lspay-logo-img" style={{ width: "20px", height: "20px" }} />
  </div>
);

export function CardPrintStudio({ student, students, tenant, isOpen, onClose }: CardPrintStudioProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [printLayout, setPrintLayout] = useState<"pair" | "front_only" | "grid_a4">("pair");
  const { tenants } = useStore();

  const printList = useMemo(() => {
    return students && students.length > 0 ? students : student ? [student] : [];
  }, [students, student]);

  const activeStudent = (printList.length > 0 ? printList[Math.min(previewIndex, printList.length - 1)] : student) || null;

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
      grid-template-columns: repeat(4, 204px) !important;
      grid-template-rows: repeat(2, 324px) !important;
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
    .print-card-box {
      width: 204px !important;
      height: 324px !important;
      border: 1px solid #cbd5e1 !important;
      border-radius: 12px !important;
      background: white !important;
      color: black !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      padding: 12px !important;
      box-sizing: border-box !important;
      position: relative !important;
    }
    .print-card-box.card-back-african {
      padding: 7px !important;
      background-image: url('/african-pattern.jpg') !important;
      background-size: cover !important;
      background-position: center !important;
      background-repeat: no-repeat !important;
    }
    .lspay-logo-img {
      width: 20px !important;
      height: 20px !important;
      background-image: url('/logo-new.png') !important;
      background-size: contain !important;
      background-repeat: no-repeat !important;
      background-position: center !important;
      display: inline-block !important;
    }
  </style>
</head>
<body>
  ${printArea.innerHTML.replace(/<style[\s\S]*?<\/style>/gi, "")}
</body>
</html>`;

    doc.open();
    doc.write(contentHtml);
    doc.close();

    // Trigger print once iframe content is parsed
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        iframe.remove();
      }, 3000);
    }, 400);
  };

  const activeStudentTenant = (activeStudent?.tenantId ? tenants.find(t => t.id === activeStudent.tenantId) : null) || tenant || (tenants.length === 1 ? tenants[0] : undefined);
  const schoolName = activeStudentTenant?.name || tenant?.name || "Demonstration Schools Kaduna";
  const schoolAddress = activeStudentTenant?.address || tenant?.address || "5-7 Alor Close U/Pama Kaduna";
  const schoolPhone = "+234 805 201 8753, +234 907 051 8961";
  const schoolLogo = activeStudentTenant?.logoUrl || tenant?.logoUrl;

  const handleExportHTML = async () => {
    const printArea = document.getElementById("lspay-print-area");
    if (!printArea) return;
    const cleanSchoolName = schoolName.replace(/[^a-zA-Z0-9_-]/g, "_");
    const fileName = `${cleanSchoolName}_${printList.length}_Student_Cards.html`;

    let htmlContent = printArea.innerHTML.replace(/<style[\s\S]*?<\/style>/gi, "");

    // Pre-scale assets to compact Base64 so the HTML file is 100% self-contained offline
    let logoBase64 = "/logo-new.png";
    let patternBase64 = "/african-pattern.jpg";
    try {
      const [lB64, pB64] = await Promise.all([
        getScaledDataUrl("/logo-new.png", 120, 120, "image/png"),
        getScaledDataUrl("/african-pattern.jpg", 408, 648, "image/jpeg", 0.88),
      ]);
      if (lB64) logoBase64 = lB64;
      if (pB64) patternBase64 = pB64;
    } catch (e) {
      console.warn("Could not pre-encode assets to base64", e);
    }

    // Replace any img src occurrences in HTML markup as well
    htmlContent = htmlContent.replace(/src=["'][^"']*logo-new\.png["']/g, `src="${logoBase64}"`);
    htmlContent = htmlContent.replace(/src=["'][^"']*african-pattern\.jpg["']/g, `src="${patternBase64}"`);

    const isLandscape = printLayout === "grid_a4";
    const pageOrientation = isLandscape ? "landscape" : "portrait";

    const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
      padding: 12px;
      position: relative;
    }
    .print-card-box.card-back-african {
      padding: 7px !important;
      background-image: url('${patternBase64}') !important;
      background-size: cover !important;
      background-position: center !important;
      background-repeat: no-repeat !important;
    }
    .lspay-logo-img {
      width: 20px;
      height: 20px;
      background-image: url('${logoBase64}') !important;
      background-size: contain !important;
      background-repeat: no-repeat !important;
      background-position: center !important;
      display: inline-block !important;
    }
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
        background-image: url('${patternBase64}') !important;
        background-size: cover !important;
        background-position: center !important;
        background-repeat: no-repeat !important;
      }
      .lspay-logo-img {
        width: 20px !important;
        height: 20px !important;
        background-image: url('${logoBase64}') !important;
        background-size: contain !important;
        background-repeat: no-repeat !important;
        background-position: center !important;
        display: inline-block !important;
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

  // Format today's date to match template format: "14 July 2026"
  const formattedDate = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const chunkedGrid = useMemo(() => {
    const chunks: Student[][] = [];
    for (let i = 0; i < printList.length; i += 8) {
      chunks.push(printList.slice(i, i + 8));
    }
    return chunks;
  }, [printList]);

  const renderFrontCard = (stud: Student) => {
    const studTenant = (stud.tenantId ? tenants.find(t => t.id === stud.tenantId) : null) || tenant || (tenants.length === 1 ? tenants[0] : undefined);
    const studSchoolName = studTenant?.name || schoolName;
    const studSchoolLogo = studTenant?.logoUrl || schoolLogo;

    return (
      // Outer: full African pattern frame
      <div
        className="print-card-box"
        style={{
          width: "204px", height: "324px", borderRadius: "12px",
          boxSizing: "border-box", padding: "7px",
          backgroundImage: "url('/african-pattern.jpg')",
          backgroundSize: "cover", backgroundPosition: "center",
          border: "none", overflow: "hidden", position: "relative",
          fontFamily: "sans-serif", color: "black",
          WebkitPrintColorAdjust: "exact",
        }}
      >
        {/* Inner white content plate */}
        <div style={{
          width: "100%", height: "100%", borderRadius: "8px",
          background: "white",
          border: "1px solid #f1f5f9",
          boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
          display: "flex", flexDirection: "column", alignItems: "center",
          overflow: "hidden", boxSizing: "border-box",
        }}>

          {/* Header: School Logo & Name */}
          <div style={{ width: "100%", display: "flex", alignItems: "center", gap: "7px", padding: "8px 8px 6px", borderBottom: "1px solid #f1f5f9" }}>
            <div style={{ width: "28px", height: "28px", borderRadius: "50%", border: "1px solid #e2e8f0", background: "white", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
              {studSchoolLogo ? (
                <img src={studSchoolLogo} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", padding: "1px" }} />
              ) : (
                <svg style={{ width: "16px", height: "16px" }} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="#1e3a8a" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="#1e3a8a" strokeWidth="1.5" />
                  <circle cx="12" cy="9" r="2.5" fill="#ef4444"/>
                  <path d="M8 15c0-2.5 1.8-4 4-4s4 1.5 4 4" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: "#0f172a", fontWeight: "800", fontSize: "8.5px", lineHeight: "1.2", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{studSchoolName}</div>
              <span style={{ fontSize: "6.5px", color: "#94a3b8", fontFamily: "monospace", display: "block", marginTop: "1px" }}>Student Identification</span>
            </div>
          </div>

          {/* Avatar */}
          <div style={{ margin: "6px 0 4px" }}>
            <div style={{ width: "70px", height: "70px", borderRadius: "50%", border: "2px solid #e2e8f0", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 6px rgba(0,0,0,0.08)" }}>
              <img
                src={stud.imageUrl} alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(stud.name)}`; }}
              />
            </div>
          </div>

          {/* Details */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", flexGrow: 1, justifyContent: "center", gap: "3px", width: "100%", padding: "0 8px" }}>
            <span style={{ color: "#2563eb", fontWeight: "700", fontSize: "9px", fontFamily: "monospace", letterSpacing: "0.04em" }}>{stud.studentId}</span>
            <span style={{ color: "#0f172a", fontWeight: "800", fontSize: "10px", lineHeight: "1.25", width: "164px", textAlign: "center", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{stud.name}</span>

            {/* QR Code */}
            <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", padding: "4px", background: "white", display: "flex", alignItems: "center", justifyContent: "center", width: "74px", height: "74px", marginTop: "2px" }}>
              <QRCodeSVG value={stud.cardHardwareId || stud.studentId} size={66} />
            </div>
          </div>

          {/* Footer */}
          <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #f1f5f9", padding: "5px 8px", marginTop: "2px" }}>
            <div style={{ width: "22px", height: "22px", borderRadius: "50%", border: "1px solid #e2e8f0", background: "white", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
              <div className="lspay-logo-img" style={{ width: "14px", height: "14px" }} />
            </div>
            {studSchoolLogo ? (
              <div style={{ width: "22px", height: "22px", borderRadius: "50%", border: "1px solid #e2e8f0", background: "white", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                <img src={studSchoolLogo} alt="" style={{ width: "16px", height: "16px", objectFit: "contain" }} />
              </div>
            ) : null}
          </div>

        </div>
      </div>
    );
  };

  const renderBackCard = (stud: Student) => {
    const studTenant = (stud.tenantId ? tenants.find(t => t.id === stud.tenantId) : null) || tenant || (tenants.length === 1 ? tenants[0] : undefined);
    const studSchoolName = studTenant?.name || schoolName;
    const studSchoolAddress = studTenant?.address || schoolAddress;
    const studSchoolPhone = "+234 805 201 8753, +234 907 051 8961";
    const studSchoolLogo = studTenant?.logoUrl || schoolLogo;

    return (
      <div
        className="print-card-box card-back-african"
        style={{
          width: "204px",
          height: "324px",
          borderRadius: "12px",
          border: "1px solid #cbd5e1",
          background: "white",
          color: "black",
          padding: "7px",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* White / Frosted Inner Credential Container */}
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "9px",
            background: "rgba(255, 255, 255, 0.94)",
            border: "1px solid rgba(255, 255, 255, 0.7)",
            boxShadow: "0 2px 6px rgba(0, 0, 0, 0.12)",
            padding: "10px 8px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-between",
            boxSizing: "border-box",
            textAlign: "center",
          }}
        >
          {/* School Crest & Name */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "5px", width: "100%", marginTop: "2px" }}>
            <div style={{ width: "80px", height: "80px", borderRadius: "50%", border: "1.5px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", background: "white", overflow: "hidden", boxShadow: "0 2px 4px rgba(0,0,0,0.06)" }}>
              {studSchoolLogo ? (
                <img src={studSchoolLogo} alt="" style={{ width: "66px", height: "66px", objectFit: "contain", padding: "2px" }} />
              ) : (
                <svg style={{ width: "52px", height: "52px" }} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="#1e3a8a" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="#1e3a8a" strokeWidth="1.5" />
                  <circle cx="12" cy="9" r="2.5" fill="#ef4444"/>
                  <path d="M8 15c0-2.5 1.8-4 4-4s4 1.5 4 4" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              )}
            </div>
            <span style={{ fontSize: "9.5px", fontWeight: "900", color: "#0f172a", marginTop: "4px", textAlign: "center", width: "168px", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", lineHeight: "1.25", letterSpacing: "0.01em" }}>
              {studSchoolName}
            </span>
            <span style={{ fontSize: "6.5px", color: "#64748b", fontFamily: "monospace", letterSpacing: "0.06em", fontWeight: "600" }}>
              Student Identification Card
            </span>
          </div>

          {/* Details */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "4px", width: "100%", margin: "auto 0" }}>
            <span style={{ color: "#334155", fontSize: "8px", lineHeight: "1.35", maxWidth: "155px", fontWeight: "500" }}>
              {studSchoolAddress}
            </span>
            <span style={{ color: "#1e293b", fontSize: "8px", fontFamily: "monospace", fontWeight: "700", marginTop: "2px" }}>
              {studSchoolPhone}
            </span>
          </div>

          {/* Footer Brand */}
          <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #e2e8f0", paddingTop: "5px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <div style={{ width: "22px", height: "22px", borderRadius: "50%", border: "1px solid #e2e8f0", background: "white", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                <div className="lspay-logo-img" style={{ width: "16px", height: "16px" }} />
              </div>
              <span style={{ fontSize: "7.5px", color: "#475569", fontFamily: "monospace", fontWeight: "600" }}>umusa.cloud</span>
            </div>
            <span style={{ fontSize: "7px", color: "#94a3b8", fontFamily: "monospace" }}>VERIFIED</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[620px] w-full bg-card border-border text-foreground overflow-hidden p-6">
        <DialogHeader className="border-b border-border pb-4 pr-10">
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="text-xl font-bold flex items-center gap-2.5">
              <Printer className="text-primary w-5 h-5" />
              <span>Card Printing Studio</span>
            </DialogTitle>
            {printList.length > 1 && (
              <Badge variant="outline" className="text-xs font-semibold px-2.5 py-0.5 bg-primary/10 text-primary border-primary/30 shrink-0">
                {printList.length} Cards Total
              </Badge>
            )}
          </div>
        </DialogHeader>

        <div className="flex flex-col items-center pt-2 pb-2 space-y-4">
          <div className="text-center max-w-sm">
            <p className="text-xs text-muted-foreground">
              Verify credentials. Layout formatted for standard CR80 cards (85.6mm × 54mm).
            </p>
          </div>

          {printList.length > 1 && (
            <div className="flex items-center justify-between w-full max-w-[280px] px-2 py-1 bg-muted/40 rounded-lg border border-border/50 text-xs">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPreviewIndex(i => Math.max(0, i - 1))}
                disabled={previewIndex === 0}
                className="h-7 px-2 text-xs"
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Prev
              </Button>
              <span className="font-semibold text-foreground">
                Card {previewIndex + 1} of {printList.length}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPreviewIndex(i => Math.min(printList.length - 1, i + 1))}
                disabled={previewIndex >= printList.length - 1}
                className="h-7 px-2 text-xs"
              >
                Next <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          )}

          {/* Interactive 3D Card Preview Container */}
          <div className="perspective-1000 w-[220px] h-[348px] cursor-pointer" onClick={() => setIsFlipped(!isFlipped)}>
            <div
              className={`relative w-full h-full transition-transform duration-700 transform-style-3d ${
                isFlipped ? "rotate-y-180" : ""
              }`}
            >
              {/* CARD FRONT */}
              <div
                className="absolute inset-0 w-full h-full rounded-2xl backface-hidden shadow-xl text-black overflow-hidden select-none"
                style={{
                  padding: "7px",
                  backgroundImage: "url('/african-pattern.jpg')",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              >
                {/* Inner white content plate */}
                <div className="w-full h-full rounded-xl flex flex-col items-center overflow-hidden" style={{ background: "rgba(255,255,255,0.97)", border: "1px solid rgba(255,255,255,0.8)", boxShadow: "0 2px 8px rgba(0,0,0,0.10)" }}>

                  {/* Header */}
                  <div className="w-full flex items-center gap-2 px-2.5 pt-2 pb-1.5 border-b border-gray-100">
                    <div className="w-7 h-7 rounded-full border border-gray-200 bg-white flex items-center justify-center shrink-0 overflow-hidden">
                      {schoolLogo ? (
                        <img src={schoolLogo} alt={schoolName} className="w-full h-full object-contain p-0.5" />
                      ) : (
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="#1e3a8a" strokeWidth="1.5" strokeLinecap="round"/>
                          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="#1e3a8a" strokeWidth="1.5" />
                          <circle cx="12" cy="9" r="2.5" fill="#ef4444"/>
                          <path d="M8 15c0-2.5 1.8-4 4-4s4 1.5 4 4" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[9px] font-extrabold text-slate-900 leading-tight" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {schoolName}
                      </div>
                      <span className="text-[6.5px] text-slate-400 font-mono block mt-0.5">Student Identification</span>
                    </div>
                  </div>

                  {/* Avatar */}
                  <div className="flex justify-center mt-2 mb-1 shrink-0">
                    <div className="w-[70px] h-[70px] rounded-full border-2 border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.10)" }}>
                      <img
                        src={activeStudent.imageUrl}
                        alt={activeStudent.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(activeStudent.name)}`;
                        }}
                      />
                    </div>
                  </div>

                  {/* Details */}
                  <div className="flex flex-col items-center text-center flex-1 justify-center px-2" style={{ gap: "3px" }}>
                    <span className="text-blue-600 font-bold text-[10px] tracking-widest font-mono leading-none">
                      {activeStudent.studentId}
                    </span>
                    <span className="text-slate-900 font-extrabold text-[11px] leading-snug text-center" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", width: "164px" }}>
                      {activeStudent.name}
                    </span>

                    {/* QR Code */}
                    <div className="border border-gray-200 rounded-lg p-1.5 bg-white flex items-center justify-center w-[76px] h-[76px] shrink-0 mt-1" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                      <QRCodeSVG value={activeStudent.cardHardwareId || activeStudent.studentId} size={66} />
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="w-full flex items-center justify-between border-t border-gray-100 px-2.5 py-1.5 mt-auto">
                    <CompanyLogo />
                    {schoolLogo ? (
                      <div className="w-5 h-5 rounded-full border border-gray-200 bg-white flex items-center justify-center shrink-0 overflow-hidden">
                        <img src={schoolLogo} alt={schoolName} className="w-3.5 h-3.5 object-contain" />
                      </div>
                    ) : null}
                  </div>

                </div>
              </div>

              {/* CARD BACK */}
              <div
                className="absolute inset-0 w-full h-full rounded-2xl backface-hidden rotate-y-180 border border-gray-200 shadow-xl text-black overflow-hidden select-none"
                style={{
                  padding: "7px",
                  backgroundImage: "url('/african-pattern.jpg')",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              >
                {/* Frosted inner credential plate */}
                <div className="w-full h-full rounded-xl flex flex-col items-center justify-between text-black"
                  style={{
                    background: "white",
                    border: "1px solid #f1f5f9",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                    padding: "10px 8px",
                  }}
                >
                  {/* School Logo & Name */}
                  <div className="flex flex-col items-center gap-1 mt-2 w-full">
                    <div className="w-20 h-20 rounded-full border border-gray-200 flex items-center justify-center bg-white overflow-hidden" style={{ boxShadow: "0 2px 4px rgba(0,0,0,0.06)" }}>
                      {schoolLogo ? (
                        <img src={schoolLogo} alt={schoolName} className="w-[66px] h-[66px] object-contain p-0.5" />
                      ) : (
                        <svg className="w-12 h-12 text-primary" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="#1e3a8a" strokeWidth="1.5" strokeLinecap="round"/>
                          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="#1e3a8a" strokeWidth="1.5" />
                          <circle cx="12" cy="9" r="2.5" fill="#ef4444"/>
                          <path d="M8 15c0-2.5 1.8-4 4-4s4 1.5 4 4" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                      )}
                    </div>
                    <span className="text-[10px] font-black text-slate-900 tracking-wide mt-1.5 px-2 text-center leading-tight" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", width: "168px" }}>
                      {schoolName}
                    </span>
                    <span className="text-[7px] text-slate-500 font-mono tracking-widest font-semibold">
                      Student Identification Card
                    </span>
                  </div>

                  {/* Details */}
                  <div className="flex flex-col items-center text-center my-auto px-2 space-y-1.5">
                    <p className="text-slate-600 text-[9px] font-medium leading-relaxed max-w-[150px]">
                      {schoolAddress}
                    </p>
                    <p className="text-slate-800 text-[9px] font-mono font-bold leading-none">
                      {schoolPhone}
                    </p>
                  </div>

                  {/* Footer Brand */}
                  <div className="w-full flex items-center justify-between border-t border-gray-200 pt-1.5">
                    <div className="flex items-center gap-1.5">
                      <CompanyLogo />
                      <span className="text-[9px] text-slate-500 font-mono font-semibold">umusa.cloud</span>
                    </div>
                    <span className="text-[7px] text-slate-400 font-mono">VERIFIED</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Controls: Flip & Print Layout */}
          <div className="w-full bg-muted/40 border border-border/60 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-medium text-foreground">
              <Layers className="w-4 h-4 text-primary shrink-0" />
              <span className="shrink-0">Layout:</span>
              <Select value={printLayout} onValueChange={(v: any) => setPrintLayout(v)}>
                <SelectTrigger className="bg-card border-border text-foreground text-xs h-8.5 w-[260px] font-medium">
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
              className="border-border hover:bg-muted text-foreground text-xs h-8.5 shrink-0"
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Flip Card View
            </Button>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between w-full gap-2 border-t border-border pt-4 px-1">
            <Button variant="ghost" onClick={onClose} className="border-border text-foreground text-xs sm:text-sm">
              Close
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleExportHTML}
                className="border-border hover:bg-muted text-foreground font-semibold flex items-center justify-center gap-1.5 text-xs sm:text-sm h-10 px-4"
                title="Download single self-contained HTML file ready for printing on any machine"
              >
                <Download className="w-4 h-4 text-primary" /> Export File (.html)
              </Button>
              <Button
                onClick={handlePrint}
                className="bg-primary hover:bg-primary/90 text-white font-bold flex items-center justify-center gap-1.5 text-xs sm:text-sm h-10 px-5 shadow-md shadow-primary/20"
              >
                <Printer className="mr-1.5 h-4 w-4" /> Print / Save PDF ({printList.length})
              </Button>
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
                grid-template-columns: repeat(4, 204px) !important;
                grid-template-rows: repeat(2, 324px) !important;
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
              .print-card-box {
                width: 204px;
                height: 324px;
                border: 1px solid #cbd5e1;
                border-radius: 12px;
                overflow: hidden;
                box-sizing: border-box;
                background: white !important;
                color: black !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
                font-family: sans-serif;
                display: flex;
                flex-direction: column;
                align-items: center;
                padding: 0;
                position: relative;
              }
              .print-card-box.card-back-african {
                padding: 7px !important;
                background-image: url('/african-pattern.jpg') !important;
                background-size: cover !important;
                background-position: center !important;
                background-repeat: no-repeat !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .card-front-header {
                background-image: url('/african-pattern.jpg') !important;
                background-size: cover !important;
                background-position: center top !important;
                background-repeat: no-repeat !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .lspay-logo-img {
                width: 20px;
                height: 20px;
                background-image: url('/logo-new.png');
                background-size: contain;
                background-repeat: no-repeat;
                background-position: center;
                display: inline-block;
              }
            }
          `}</style>

          {printLayout === "grid_a4" ? (
            chunkedGrid.map((group, gIdx) => (
              <div className="print-grid-sheet-8" key={gIdx}>
                {group.map((stud) => (
                  <Fragment key={stud.id}>
                    {renderFrontCard(stud)}
                  </Fragment>
                ))}
              </div>
            ))
          ) : printLayout === "front_only" ? (
            printList.map((stud) => (
              <div className="print-card-page" key={stud.id}>
                {renderFrontCard(stud)}
              </div>
            ))
          ) : (
            printList.map((stud) => (
              <div className="print-card-page" key={stud.id}>
                {renderFrontCard(stud)}
                {renderBackCard(stud)}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
