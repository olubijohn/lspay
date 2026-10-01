import type { GuardianRelationship, LspayGuardian, ParentUser, Student } from "@/lib/types";

/** Most guardians a student can have in LSPay, counting the guardian on the student record. */
export const MAX_GUARDIANS = 3;

export type GuardianLoginStatus = "not_connected" | "awaiting" | "connected";

export interface StudentGuardian {
  /** null for the guardian on the student record; otherwise the lspay_student_guardians id. */
  guardianId: string | null;
  name: string;
  email: string;
  phone: string;
  relationship: GuardianRelationship | null;
  status: GuardianLoginStatus;
  account?: ParentUser;
}

export const relationshipLabel = (r: GuardianRelationship | null) =>
  r === "father" ? "Father" : r === "mother" ? "Mother" : r === "guardian" ? "Guardian" : "Main guardian";

export const loginStatusLabel = (s: GuardianLoginStatus) =>
  s === "connected" ? "Connected" : s === "awaiting" ? "Awaiting first sign-in" : "Not connected";

export function emailLooksValid(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(email.trim()) && !/[A-Z]/.test(email.split("@")[1] ?? "");
}

/**
 * All LSPay guardians of a student: the guardian on the student record first, then the extra LSPay guardians,
 * each with the status of their LSPay parent login (an account linked to this student with the same email).
 */
export function guardiansOf(student: Student, extras: LspayGuardian[], parentUsers: ParentUser[]): StudentGuardian[] {
  const linked = parentUsers.filter((p) => p.linkedStudentIds.includes(student.id));
  const statusFor = (email: string): Pick<StudentGuardian, "status" | "account"> => {
    const account = linked.find((p) => p.email.toLowerCase() === email.toLowerCase());
    return { account, status: !account ? "not_connected" : account.mustChangePassword ? "awaiting" : "connected" };
  };
  const out: StudentGuardian[] = [];
  const seen = new Set<string>();
  const primary = student.parentEmail?.trim().toLowerCase();
  if (primary) {
    seen.add(primary);
    out.push({ guardianId: null, name: student.parentName || "Parent", email: primary, phone: "", relationship: null, ...statusFor(primary) });
  }
  for (const g of extras) {
    if (g.studentId !== student.id) continue;
    const e = g.email.toLowerCase();
    if (seen.has(e)) continue;
    seen.add(e);
    out.push({ guardianId: g.id, name: g.name, email: e, phone: g.phone, relationship: g.relationship, ...statusFor(e) });
  }
  return out;
}

/** Index extras by student once, for lists of hundreds of students. */
export function guardiansByStudent(students: Student[], extras: LspayGuardian[], parentUsers: ParentUser[]) {
  const byStudent = new Map<string, LspayGuardian[]>();
  for (const g of extras) {
    const list = byStudent.get(g.studentId);
    if (list) list.push(g); else byStudent.set(g.studentId, [g]);
  }
  const accountsByStudent = new Map<string, ParentUser[]>();
  for (const p of parentUsers) for (const id of p.linkedStudentIds) {
    const list = accountsByStudent.get(id);
    if (list) list.push(p); else accountsByStudent.set(id, [p]);
  }
  const map = new Map<string, StudentGuardian[]>();
  for (const s of students) map.set(s.id, guardiansOf(s, byStudent.get(s.id) ?? [], accountsByStudent.get(s.id) ?? []));
  return map;
}

// ------------------------------ guardian filters ------------------------------
/** Shared "guardians" filter for student lists. */
export type GuardianFilter = "all" | "has" | "multi" | "none" | "connected" | "not_connected";

export const GUARDIAN_FILTER_OPTIONS: { value: GuardianFilter; label: string }[] = [
  { value: "all", label: "All guardian statuses" },
  { value: "has", label: "Has a guardian" },
  { value: "multi", label: "More than one guardian" },
  { value: "none", label: "No guardian" },
  { value: "connected", label: "LSPay parent connected" },
  { value: "not_connected", label: "Guardian not connected yet" },
];

export function matchesGuardianFilter(gs: StudentGuardian[], f: GuardianFilter): boolean {
  switch (f) {
    case "has": return gs.length > 0;
    case "multi": return gs.length > 1;
    case "none": return gs.length === 0;
    case "connected": return gs.some((g) => g.status !== "not_connected");
    case "not_connected": return gs.length > 0 && gs.every((g) => g.status === "not_connected");
    default: return true;
  }
}

/** One row per student, up to 3 guardians across the columns — what every "Export (Excel)" button downloads. */
export function exportStudentsWithGuardians(
  filename: string,
  students: Student[],
  guardianMap: Map<string, StudentGuardian[]>,
  extra?: { header: string; value: (s: Student) => unknown }[],
) {
  const header = ["Student", "Reg no", "Class", ...(extra ?? []).map((e) => e.header), "Guardians", "Parents connected"];
  for (let i = 1; i <= MAX_GUARDIANS; i++) header.push(`Guardian ${i} name`, `Guardian ${i} relationship`, `Guardian ${i} email`, `Guardian ${i} phone`, `Guardian ${i} LSPay`);
  const rows = students.map((s) => {
    const gs = guardianMap.get(s.id) ?? [];
    const r: unknown[] = [s.name, s.studentId, s.className?.trim() || "", ...(extra ?? []).map((e) => e.value(s)), gs.length, gs.filter((g) => g.status !== "not_connected").length];
    for (let i = 0; i < MAX_GUARDIANS; i++) {
      const g = gs[i];
      r.push(g?.name ?? "", g ? relationshipLabel(g.relationship) : "", g?.email ?? "", g?.phone ?? "", g ? loginStatusLabel(g.status) : "");
    }
    return r;
  });
  downloadCsv(`${filename}-${new Date().toISOString().slice(0, 10)}`, header, rows);
}

// ------------------------------ CSV (opens in Excel) ------------------------------
const cell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  // Excel would run a leading = + - @ as a formula; phone numbers like +234… also need protecting
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function downloadCsv(filename: string, header: string[], rows: unknown[][]) {
  const text = "﻿" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const fileSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "school";
