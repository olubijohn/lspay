import { useState, Fragment } from "react";
import { Student, Tenant } from "@/lib/types";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Printer, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useStore } from "@/store";

interface CardPrintStudioProps {
  student?: Student;
  students?: Student[];
  tenant?: Tenant;
  isOpen: boolean;
  onClose: () => void;
}

// Company Logo (LSPay blue logo)
const CompanyLogo = () => (
  <div className="w-7 h-7 rounded-full border border-gray-200 bg-white flex items-center justify-center shadow-sm shrink-0 overflow-hidden">
    <img src="/logo-new.png" alt="LSPay Logo" className="w-5 h-5 object-contain" />
  </div>
);

// Demonstration School Logo SVG
const DemonstrationSchoolLogo = () => (
  <div className="w-7 h-7 rounded-full border border-gray-200 bg-white flex items-center justify-center shadow-sm shrink-0">
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="#1e3a8a" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="#1e3a8a" strokeWidth="1.5" />
      <circle cx="12" cy="9" r="2.5" fill="#ef4444"/>
      <path d="M8 15c0-2.5 1.8-4 4-4s4 1.5 4 4" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  </div>
);

export function CardPrintStudio({ student, students, tenant, isOpen, onClose }: CardPrintStudioProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const { tenants } = useStore();

  const handlePrint = () => {
    window.print();
  };

  const printList = students && students.length > 0 ? students : student ? [student] : [];
  const activeStudent = student || (students && students[0]);

  if (!activeStudent) return null;

  const activeStudentTenant = activeStudent ? tenants.find(t => t.id === activeStudent.tenantId) : tenant;
  const schoolName = activeStudentTenant?.name || "Demonstration Schools Kaduna";
  const schoolAddress = activeStudentTenant?.address || "5-7 Alor Close U/Pama Kaduna";
  const schoolPhone = "+234 805 201 8753, +234 907 051 8961";


  // Format today's date to match template format: "14 July 2026"
  const formattedDate = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md bg-card border-border text-foreground overflow-hidden">
        <DialogHeader className="border-b border-border pb-4">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Printer className="text-primary w-5 h-5" />
            Card Printing Studio
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center pt-2 pb-6 space-y-4">
          <div className="text-center max-w-sm">
            <p className="text-xs text-muted-foreground">
              Verify credentials. Layout formatted for standard CR80 portrait cards.
            </p>
          </div>

          {/* Interactive 3D Card Preview Container */}
          <div className="perspective-1000 w-[220px] h-[348px] cursor-pointer" onClick={() => setIsFlipped(!isFlipped)}>
            <div
              className={`relative w-full h-full transition-transform duration-700 transform-style-3d ${
                isFlipped ? "rotate-y-180" : ""
              }`}
            >
              {/* CARD FRONT */}
              <div className="absolute inset-0 w-full h-full rounded-2xl p-4 backface-hidden bg-white border border-gray-200 shadow-xl flex flex-col items-center justify-between text-black overflow-hidden select-none">
                {/* Header: School Logo & School Name */}
                <div className="w-full flex items-center gap-2 border-b border-gray-100 pb-2 mb-1 mt-0.5">
                  <div className="w-8 h-8 rounded-full border border-gray-200 bg-white flex items-center justify-center shadow-xs shrink-0 overflow-hidden bg-white">
                    {tenant?.logoUrl ? (
                      <img src={tenant.logoUrl} alt="School Logo" className="w-full h-full object-cover" />
                    ) : (
                      <svg className="w-6 h-6 text-primary" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="#1e3a8a" strokeWidth="1.5" strokeLinecap="round"/>
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="#1e3a8a" strokeWidth="1.5" />
                        <circle cx="12" cy="9" r="2.5" fill="#ef4444"/>
                        <path d="M8 15c0-2.5 1.8-4 4-4s4 1.5 4 4" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="text-[10px] font-bold text-gray-900 uppercase tracking-tight truncate">
                      {schoolName}
                    </div>
                    <span className="text-[7px] text-gray-400 font-mono tracking-tight block">
                      STUDENT IDENTIFICATION
                    </span>
                  </div>
                </div>

                {/* Avatar */}
                <div className="flex justify-center my-1 shrink-0">
                  <div className="w-20 h-20 rounded-full border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center shadow-xs">
                    <img
                      src={activeStudent.imageUrl}
                      alt={activeStudent.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                          activeStudent.name
                        )}`;
                      }}
                    />
                  </div>
                </div>

                {/* Details */}
                <div className="flex flex-col items-center text-center flex-1 justify-center space-y-1.5 my-1 w-full">
                  <span className="text-blue-600 font-semibold text-[10px] tracking-wider font-mono leading-none">
                    {activeStudent.studentId}
                  </span>
                  <span className="text-black font-extrabold text-xs uppercase tracking-wide px-1 leading-tight truncate max-w-full">
                    {activeStudent.name}
                  </span>

                  {/* QR Code Frame */}
                  <div className="border border-gray-200 rounded-lg p-1.5 bg-white shadow-3xs flex items-center justify-center w-[84px] h-[84px] shrink-0 my-0.5">
                    <QRCodeSVG
                      value={activeStudent.cardHardwareId || activeStudent.studentId}
                      size={72}
                    />
                  </div>
                </div>

                {/* Footer */}
                <div className="w-full flex items-center justify-between border-t border-gray-100 pt-2 mt-auto">
                  <div className="flex items-center gap-1.5">
                    <CompanyLogo />
                    <span className="text-[8px] text-gray-500 font-mono font-medium">LSPay</span>
                  </div>
                </div>
              </div>

              {/* CARD BACK */}
              <div className="absolute inset-0 w-full h-full rounded-2xl p-4 backface-hidden rotate-y-180 bg-white border border-gray-200 shadow-xl flex flex-col items-center justify-between text-black overflow-hidden select-none">
                 {/* School Logo */}
                 <div className="flex flex-col items-center gap-1 mt-6 w-full">
                   <div className="w-24 h-24 rounded-full border border-gray-100 flex items-center justify-center shadow-2xs bg-white overflow-hidden">
                     {tenant?.logoUrl ? (
                       <img src={tenant.logoUrl} alt="School Logo" className="w-full h-full object-cover" />
                     ) : (
                       <svg className="w-16 h-16 text-primary" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                         <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="#1e3a8a" strokeWidth="1.5" strokeLinecap="round"/>
                         <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="#1e3a8a" strokeWidth="1.5" />
                         <circle cx="12" cy="9" r="2.5" fill="#ef4444"/>
                         <path d="M8 15c0-2.5 1.8-4 4-4s4 1.5 4 4" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round"/>
                       </svg>
                     )}
                   </div>
                   <span className="text-[10px] font-extrabold text-gray-900 uppercase tracking-wider mt-2 px-3 text-center leading-tight max-w-full truncate">
                     {schoolName}
                   </span>
                 </div>

                 {/* Details */}
                 <div className="flex flex-col items-center text-center my-auto px-2 space-y-2">
                   <p className="text-gray-500 text-[9px] font-medium leading-relaxed max-w-[150px]">
                     {schoolAddress}
                   </p>
                   <p className="text-gray-500 text-[9px] font-mono leading-none">
                     {schoolPhone}
                   </p>
                 </div>

                 {/* Footer Brand */}
                <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
                  <CompanyLogo />
                  <span className="text-[9px] text-gray-600 font-mono font-medium">umusa.cloud</span>
                </div>
              </div>
            </div>
          </div>

          {/* Flip Toggle Button */}
          <Button
            variant="outline"
            onClick={() => setIsFlipped(!isFlipped)}
            className="border-border hover:bg-muted text-foreground text-xs"
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Flip Card View
          </Button>

          {/* Actions */}
          <div className="flex w-full gap-2 border-t border-border pt-4 px-1">
            <Button variant="ghost" onClick={onClose} className="flex-1 border-border text-foreground">
              Close
            </Button>
            <Button onClick={handlePrint} className="flex-1 bg-primary hover:bg-primary/90 text-white font-bold">
              <Printer className="mr-2 h-4 w-4" /> Print Card
            </Button>
          </div>
        </div>

        {/* PRINT WRAPPER FOR WINDOW PRINTING */}
        <div id="lspay-print-area" className="hidden">
          <style>{`
            @media print {
              body * {
                visibility: hidden;
              }
              #lspay-print-area, #lspay-print-area * {
                visibility: visible;
              }
              /* Reset dialog portal structures so they don't lock viewport heights or clip content */
              div[role="dialog"],
              div[data-radix-portal],
              [data-state="open"] {
                position: static !important;
                transform: none !important;
                width: auto !important;
                height: auto !important;
                min-height: 0 !important;
                max-height: none !important;
                margin: 0 !important;
                padding: 0 !important;
                box-shadow: none !important;
                border: none !important;
                background: transparent !important;
                overflow: visible !important;
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
                height: 99vh;
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
              .print-card-box {
                width: 204px;
                height: 324px;
                border: 1px solid #e2e8f0;
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
                padding: 12px;
              }
            }
          `}</style>

          {printList.map((stud) => {
            const studTenant = tenants.find(t => t.id === stud.tenantId) || tenant;
            const studSchoolName = studTenant?.name || "Demonstration Schools Kaduna";
            const studSchoolAddress = studTenant?.address || "5-7 Alor Close U/Pama Kaduna";
            const studSchoolPhone = "+234 805 201 8753, +234 907 051 8961";

            return (
              <div className="print-card-page" key={stud.id}>
                {/* Front Print Card */}
                <div className="print-card-box" style={{ width: "204px", height: "324px", borderRadius: "12px", border: "1px solid #e2e8f0", background: "white", color: "black", padding: "12px", boxSizing: "border-box", display: "flex", flexDirection: "column", alignItems: "center", fontFamily: "sans-serif", position: "relative" }}>
                  {/* Header: School Logo & School Name */}
                  <div style={{ width: "100%", display: "flex", alignItems: "center", gap: "8px", borderBottom: "1px solid #f1f5f9", paddingBottom: "6px", marginBottom: "6px", textAlign: "left" }}>
                    {/* School Circle */}
                    <div style={{ width: "28px", height: "28px", borderRadius: "50%", border: "1px solid #e2e8f0", background: "white", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                      {studTenant?.logoUrl ? (
                        <img src={studTenant.logoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <svg style={{ width: "18px", height: "18px" }} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="#1e3a8a" strokeWidth="1.5" strokeLinecap="round"/>
                          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="#1e3a8a" strokeWidth="1.5" />
                          <circle cx="12" cy="9" r="2.5" fill="#ef4444"/>
                          <path d="M8 15c0-2.5 1.8-4 4-4s4 1.5 4 4" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: "#111827", fontWeight: "bold", fontSize: "9px", textTransform: "uppercase", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{studSchoolName}</div>
                      <span style={{ fontSize: "7px", color: "#9ca3af", fontFamily: "monospace", display: "block" }}>STUDENT IDENTIFICATION</span>
                    </div>
                  </div>

                  {/* Avatar */}
                  <div style={{ margin: "4px 0" }}>
                    <div style={{ width: "76px", height: "76px", borderRadius: "50%", border: "1px solid #e2e8f0", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 2px 0 rgba(0,0,0,0.05)" }}>
                      <img
                        src={stud.imageUrl}
                        alt=""
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                            stud.name
                          )}`;
                        }}
                      />
                    </div>
                  </div>

                  {/* Details */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", flexGrow: 1, justifyContent: "center", gap: "4px", width: "100%" }}>
                    <span style={{ color: "#2563eb", fontWeight: "600", fontSize: "9px", fontFamily: "monospace" }}>{stud.studentId}</span>
                    <span style={{ color: "#000000", fontWeight: "800", fontSize: "10px", textTransform: "uppercase", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "180px" }}>{stud.name}</span>

                    {/* QR Code Frame */}
                    <div style={{ border: "1px solid #e2e8f0", borderRadius: "6px", padding: "4px", background: "white", display: "flex", alignItems: "center", justifyContent: "center", width: "78px", height: "78px" }}>
                      <QRCodeSVG
                        value={stud.cardHardwareId || stud.studentId}
                        size={70}
                      />
                    </div>
                  </div>

                  {/* Footer */}
                  <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #f1f5f9", paddingTop: "6px", marginTop: "auto" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <div style={{ width: "20px", height: "20px", borderRadius: "50%", border: "1px solid #e2e8f0", background: "white", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                        <img src="/logo-new.png" alt="" style={{ width: "12px", height: "12px", objectFit: "contain" }} />
                      </div>
                      <span style={{ fontSize: "7px", color: "#9ca3af", fontFamily: "monospace" }}>LSPay</span>
                    </div>
                  </div>
                </div>

                {/* Back Print Card */}
                <div className="print-card-box" style={{ width: "204px", height: "324px", borderRadius: "12px", border: "1px solid #e2e8f0", background: "white", color: "black", padding: "12px", boxSizing: "border-box", display: "flex", flexDirection: "column", alignItems: "center", fontFamily: "sans-serif" }}>
                  {/* School Logo */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", marginTop: "16px", width: "100%" }}>
                    <div style={{ width: "86px", height: "86px", borderRadius: "50%", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", background: "white", overflow: "hidden" }}>
                      {studTenant?.logoUrl ? (
                        <img src={studTenant.logoUrl} alt="" style={{ width: "72px", height: "72px", objectFit: "cover" }} />
                      ) : (
                        <svg style={{ width: "56px", height: "56px" }} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="#1e3a8a" strokeWidth="1.5" strokeLinecap="round"/>
                          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="#1e3a8a" strokeWidth="1.5" />
                          <circle cx="12" cy="9" r="2.5" fill="#ef4444"/>
                          <path d="M8 15c0-2.5 1.8-4 4-4s4 1.5 4 4" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                      )}
                    </div>
                    <span style={{ fontSize: "9px", fontWeight: "800", color: "#111827", textTransform: "uppercase", marginTop: "6px", textAlign: "center", width: "180px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{studSchoolName}</span>
                  </div>

                  {/* Details */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "4px", flexGrow: 1, justifyContent: "center", width: "100%" }}>
                    <span style={{ color: "#4b5563", fontSize: "8px", lineHeight: "1.3", maxWidth: "150px" }}>{studSchoolAddress}</span>
                    <span style={{ color: "#4b5563", fontSize: "8px", fontFamily: "monospace" }}>{studSchoolPhone}</span>
                  </div>

                  {/* Footer Brand */}
                  <div style={{ width: "100%", display: "flex", alignItems: "center", gap: "4px", borderTop: "1px solid #f1f5f9", paddingTop: "6px", marginTop: "auto" }}>
                    {/* Company Logo */}
                    <div style={{ width: "20px", height: "20px", borderRadius: "50%", border: "1px solid #e2e8f0", background: "white", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                      <img src="/logo-new.png" alt="" style={{ width: "12px", height: "12px", objectFit: "contain" }} />
                    </div>
                    <span style={{ fontSize: "7px", color: "#4b5563", fontFamily: "monospace" }}>umusa.cloud</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
