// Parent list import: turns a school's parent list (Excel/CSV export, or rows pasted from Excel) into
// guardian ↔ student pairs. Matching is done here so the school can review it before anything is saved.
import type { GuardianRelationship, Student } from "@/lib/types";
import { emailLooksValid } from "@/lib/guardians";

// ------------------------------ reading the file ------------------------------
/** CSV / TSV / semicolon-separated text → rows of cells (quoted cells may contain commas and line breaks). */
export function parseDelimited(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const delim = firstLine.includes("\t") ? "\t" : (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (quoted) {
      if (c === '"' && clean[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"' && cell === "") quoted = true;
    else if (c === delim) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && clean[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.map((r) => r.map((x) => x.trim())).filter((r) => r.some((x) => x !== ""));
}

export interface ColumnMap { name: number; email: number; phone: number; gender: number; relationship: number; children: number }

const COLUMN_PATTERNS: Record<keyof ColumnMap, RegExp> = {
  name: /(parent|guardian).*name|^name$|full ?name/i,
  email: /e-?mail/i,
  phone: /phone|mobile|tel|gsm/i,
  gender: /gender|^sex$/i,
  relationship: /relation/i,
  children: /child|ward|student|pupil|linked/i,
};

/** Find the header row (within the first 10 rows) and which column holds what. */
export function detectColumns(rows: string[][]): { headerRow: number; map: ColumnMap } | null {
  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    const map = { name: -1, email: -1, phone: -1, gender: -1, relationship: -1, children: -1 } as ColumnMap;
    rows[r].forEach((h, i) => {
      for (const key of Object.keys(COLUMN_PATTERNS) as (keyof ColumnMap)[]) {
        if (map[key] === -1 && COLUMN_PATTERNS[key].test(h)) { map[key] = i; break; }
      }
    });
    if (map.email !== -1 && map.children !== -1) return { headerRow: r, map };
  }
  return null;
}

/** "1 BAKARE KHALEED IREOLUWA 2 BAKARE NADINE OREOLUWA" / one per line / "; " separated → names. */
export function splitChildren(cell: string): string[] {
  return cell
    .split(/\r?\n|;|\|/)
    .flatMap((part) => part.split(/(?:^|\s)\d{1,2}\s*[.)]?\s+(?=[A-Za-z])/))
    .map((x) => x.replace(/^\s*\d{1,2}\s*[.)]?\s*/, "").replace(/\s+/g, " ").trim())
    .filter((x) => /[A-Za-z]{2,}/.test(x));
}

// ------------------------------ matching ------------------------------
const tokens = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z\s]/g, " ").split(/\s+/).filter((t) => t.length > 1);

function lev(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const d = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0]; d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return d[b.length];
}

/** How alike two names are (word order ignored, one-letter typos tolerated in longer words): 0..1. */
function nameScore(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const used = new Set<number>();
  let score = 0;
  for (const t of a) {
    let best = -1, bestVal = 0;
    b.forEach((u, i) => {
      if (used.has(i)) return;
      const v = t === u ? 1 : t.length >= 5 && lev(t, u) <= 1 ? 0.8 : 0;
      if (v > bestVal) { bestVal = v; best = i; }
    });
    if (best >= 0) { used.add(best); score += bestVal; }
  }
  return score / Math.max(a.length, b.length);
}

export type ChildMatchStatus = "exact" | "close" | "ambiguous" | "none";

export interface ChildMatch {
  key: string;
  raw: string;
  status: ChildMatchStatus;
  /** Chosen student (exact match, or the school's pick for close/ambiguous). null = not linked. */
  studentId: string | null;
  candidates: { student: Student; score: number }[];
}

export interface StudentIndex { list: { s: Student; t: string[]; key: string }[]; byReg: Map<string, Student> }

export function indexStudents(students: Student[]): StudentIndex {
  return {
    list: students.map((s) => { const t = tokens(s.name); return { s, t, key: [...t].sort().join(" ") }; }),
    byReg: new Map(students.map((s) => [s.studentId.trim().toLowerCase(), s])),
  };
}

export function matchChild(raw: string, idx: StudentIndex, key: string): ChildMatch {
  // a registration number anywhere in the text wins ("BAKARE NADINE – PG0612")
  const reg = raw.match(/\b[A-Z]{0,4}\/?\d{2,}[A-Z0-9/-]*\b/i)?.[0]?.toLowerCase();
  const byReg = reg ? idx.byReg.get(reg) : undefined;
  if (byReg) return { key, raw, status: "exact", studentId: byReg.id, candidates: [{ student: byReg, score: 1 }] };

  const t = tokens(raw);
  const sorted = [...t].sort().join(" ");
  const exact = idx.list.filter((x) => x.key === sorted);
  if (exact.length === 1) return { key, raw, status: "exact", studentId: exact[0].s.id, candidates: [{ student: exact[0].s, score: 1 }] };
  if (exact.length > 1) return { key, raw, status: "ambiguous", studentId: null, candidates: exact.map((x) => ({ student: x.s, score: 1 })) };

  const scored = idx.list
    .map((x) => ({ student: x.s, score: nameScore(t, x.t) }))
    .filter((x) => x.score >= 0.6)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
  if (!scored.length) return { key, raw, status: "none", studentId: null, candidates: [] };
  return { key, raw, status: "close", studentId: null, candidates: scored };
}

// ------------------------------ building the plan ------------------------------
export interface ParentEntry {
  key: string;
  rows: number[];
  name: string;
  email: string;
  originalEmail: string;
  phone: string;
  relationship: GuardianRelationship;
  children: ChildMatch[];
}

export interface ImportWarning { kind: "same_phone" | "similar_email" | "too_many_guardians"; message: string }

function relationshipFrom(gender: string, rel: string): GuardianRelationship {
  const r = `${rel} ${gender}`.toLowerCase();
  if (/father|dad|\bmale\b|^m$|\bm\b/.test(r) && !/female|mother/.test(r)) return "father";
  if (/mother|mum|mom|female|^f$|\bf\b/.test(r)) return "mother";
  return "guardian";
}

const cleanEmail = (e: string) => e.trim().replace(/^mailto:/i, "").replace(/\s+/g, "");

export function buildPlan(rows: string[][], map: ColumnMap, headerRow: number, students: Student[]): ParentEntry[] {
  const idx = indexStudents(students);
  const byEmail = new Map<string, ParentEntry>();
  const out: ParentEntry[] = [];
  const get = (r: string[], i: number) => (i >= 0 ? r[i] ?? "" : "");
  rows.slice(headerRow + 1).forEach((r, i) => {
    const rowNo = headerRow + i + 2; // 1-based, as in Excel
    const originalEmail = cleanEmail(get(r, map.email));
    const kids = splitChildren(get(r, map.children));
    const name = get(r, map.name).replace(/\s+/g, " ").trim();
    if (!originalEmail && !kids.length && !name) return;
    const emailKey = originalEmail.toLowerCase();
    let entry = emailKey ? byEmail.get(emailKey) : undefined;
    if (!entry) {
      entry = {
        key: `row-${rowNo}`, rows: [], name: name || "Parent", email: originalEmail.toLowerCase(), originalEmail,
        phone: get(r, map.phone).trim(), relationship: relationshipFrom(get(r, map.gender), get(r, map.relationship)), children: [],
      };
      if (emailKey) byEmail.set(emailKey, entry);
      out.push(entry);
    }
    entry.rows.push(rowNo);
    for (const k of kids) {
      const m = matchChild(k, idx, `${entry.key}-${entry.children.length}`);
      if (m.studentId && entry.children.some((c) => c.studentId === m.studentId)) continue;
      entry.children.push(m);
    }
  });
  return out;
}

export const emailProblem = (email: string, original: string): string | null => {
  if (!email) return "No email address";
  if (!emailLooksValid(email)) return "Invalid email address";
  if (/[A-Z]/.test(original.split("@")[1] ?? "")) return "Check the email (capital letter in the domain)";
  if (/^(gmail|yahoo|hotmail|outlook|icloud|ymail)\.com./i.test(email.split("@")[1] ?? "")) return "Check the email (extra characters after .com)";
  return null;
};

/** Things a person should look at; nothing here is changed automatically. */
export function findWarnings(entries: ParentEntry[], existingEmails: (studentId: string) => string[], students: Student[]): ImportWarning[] {
  const warnings: ImportWarning[] = [];
  const byPhone = new Map<string, ParentEntry[]>();
  for (const e of entries) {
    const p = e.phone.replace(/\D/g, "").replace(/^234/, "0");
    if (p.length >= 7) byPhone.set(p, [...(byPhone.get(p) ?? []), e]);
  }
  for (const list of byPhone.values()) {
    if (list.length > 1) warnings.push({ kind: "same_phone", message: `Same phone number for ${list.map((e) => `${e.name} (${e.email || "no email"})`).join(" and ")}.` });
  }
  const valid = entries.filter((e) => emailLooksValid(e.email));
  for (let i = 0; i < valid.length; i++) for (let j = i + 1; j < valid.length; j++) {
    const a = valid[i].email, b = valid[j].email;
    if (a !== b && lev(a, b) <= 2) warnings.push({ kind: "similar_email", message: `Very similar emails: ${a} (${valid[i].name}) and ${b} (${valid[j].name}). Possibly the same person.` });
  }
  const perStudent = new Map<string, Set<string>>();
  for (const e of valid) for (const c of e.children) if (c.studentId) {
    perStudent.set(c.studentId, (perStudent.get(c.studentId) ?? new Set()).add(e.email));
  }
  const nameOf = new Map(students.map((s) => [s.id, s.name]));
  for (const [sid, emails] of perStudent) {
    const total = new Set([...existingEmails(sid), ...emails]).size;
    if (total > 3) warnings.push({ kind: "too_many_guardians", message: `${nameOf.get(sid)} would have ${total} guardians; only the first 3 are kept.` });
  }
  return warnings;
}
