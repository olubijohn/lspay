import { Student } from "./types";

/**
 * Strips extensions, background-removal artifacts, copy numbers, and noise from filenames.
 * Examples:
 * "Ahtin Lehwot Samuel-removebackgrounds-ai.png" -> "Ahtin Lehwot Samuel"
 * "Alamin Lawal Mohammed-removebackgrounds-ai (1).jpg" -> "Alamin Lawal Mohammed"
 * "Oghogho Ese-Osayande Jewel-removebg-preview.png" -> "Oghogho Ese Osayande Jewel"
 */
export function cleanFilename(filename: string): string {
  if (!filename) return "";

  let cleaned = filename;

  // 1. Remove file extension
  cleaned = cleaned.replace(/\.(jpe?g|png|webp|avif|bmp|tiff?|gif)$/i, "");

  // 2. Remove common AI background removal suffixes & artifacts
  cleaned = cleaned
    .replace(/-removebackgrounds?(-ai)?/gi, "")
    .replace(/_removebackgrounds?(-ai)?/gi, "")
    .replace(/-removebg(-preview)?/gi, "")
    .replace(/_removebg(-preview)?/gi, "")
    .replace(/-bg-removed/gi, "")
    .replace(/_bg_removed/gi, "")
    .replace(/-nobg/gi, "")
    .replace(/_nobg/gi, "")
    .replace(/_preview/gi, "")
    .replace(/-preview/gi, "");

  // 3. Remove copy numbers like (1), (2), _1, -1
  cleaned = cleaned.replace(/\s*\(\d+\)/g, "");
  cleaned = cleaned.replace(/[-_]\d+$/g, "");

  // 4. Normalize separators (replace hyphens, underscores, dots, commas with space)
  cleaned = cleaned.replace(/[-_.,;/]/g, " ");

  // 5. Remove any leftover non-standard symbols but keep letters, numbers, and spaces
  cleaned = cleaned.replace(/[^a-zA-Z0-9\s]/g, " ");

  // 6. Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  return cleaned;
}

/**
 * Normalize a name into an array of lowercase, accent-stripped word tokens.
 */
export function tokenizeName(name: string): string[] {
  if (!name) return [];
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length > 0);
}

/**
 * Standard Levenshtein distance between two strings
 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = i;
    for (let j = 1; j <= b.length; j++) {
      const val = a[i - 1] === b[j - 1] ? row[j - 1] : Math.min(row[j - 1], row[j], prev) + 1;
      row[j - 1] = prev;
      prev = val;
    }
    row[b.length] = prev;
  }
  return row[b.length];
}

/**
 * Computes similarity ratio between 0 and 1
 */
export function wordSimilarity(w1: string, w2: string): number {
  if (w1 === w2) return 1;
  const maxLen = Math.max(w1.length, w2.length);
  if (maxLen === 0) return 1;
  const dist = levenshtein(w1, w2);
  return Math.max(0, 1 - dist / maxLen);
}

export interface MatchScore {
  student: Student;
  score: number; // 0 to 100
  reason: string;
}

/**
 * Compare extracted name tokens with a candidate student record
 */
export function scoreStudentMatch(fileTokens: string[], cleanedFileStr: string, student: Student): MatchScore {
  const studTokens = tokenizeName(student.name);
  const studCleaned = studTokens.join(" ");
  const fileCleaned = fileTokens.join(" ");

  // 1. RegNo match (e.g. filename has the student registration ID)
  if (student.studentId) {
    const regTokens = tokenizeName(student.studentId);
    if (regTokens.length > 0 && regTokens.every(rt => fileTokens.includes(rt))) {
      return { student, score: 100, reason: "Registration ID exact match" };
    }
    const cleanReg = student.studentId.toLowerCase().replace(/[^a-z0-9]/g, "");
    const cleanFileNoSpace = fileCleaned.replace(/\s+/g, "");
    if (cleanReg.length >= 3 && cleanFileNoSpace.includes(cleanReg)) {
      return { student, score: 99, reason: `Matched student ID (${student.studentId})` };
    }
  }

  // 2. Exact string match (ignoring case & spacing)
  if (studCleaned === fileCleaned && studCleaned.length > 0) {
    return { student, score: 100, reason: "Full name exact match" };
  }

  // 3. Exact token multiset match (same words in different order, e.g. "Samuel Ahtin" vs "Ahtin Samuel")
  const sortedStud = [...studTokens].sort().join(" ");
  const sortedFile = [...fileTokens].sort().join(" ");
  if (sortedStud === sortedFile && sortedStud.length > 0) {
    return { student, score: 96, reason: "All name parts matched (reordered)" };
  }

  // 4. Token overlap & subset match
  // Check how many tokens match exactly or fuzzily
  let matchedStudTokens = 0;
  let matchedFileTokens = 0;
  const usedFileIndices = new Set<number>();

  for (const sTok of studTokens) {
    let bestSimilarity = 0;
    let bestIdx = -1;

    for (let fIdx = 0; fIdx < fileTokens.length; fIdx++) {
      if (usedFileIndices.has(fIdx)) continue;
      const sim = wordSimilarity(sTok, fileTokens[fIdx]);
      if (sim > bestSimilarity) {
        bestSimilarity = sim;
        bestIdx = fIdx;
      }
    }

    if (bestSimilarity >= 0.82) {
      matchedStudTokens += bestSimilarity;
      matchedFileTokens++;
      if (bestIdx !== -1) usedFileIndices.add(bestIdx);
    }
  }

  const studRatio = studTokens.length > 0 ? matchedStudTokens / studTokens.length : 0;
  const fileRatio = fileTokens.length > 0 ? matchedFileTokens / fileTokens.length : 0;

  // If all student tokens are present in the filename (e.g. student is "Ahtin Samuel", file has "Ahtin Lehwot Samuel")
  if (studRatio >= 0.95 && studTokens.length >= 2) {
    return {
      student,
      score: Math.round(88 + fileRatio * 7),
      reason: `Matched ${studTokens.length} name components`,
    };
  }

  // If all file tokens are present in student name (e.g. file is "Derrick Agwom", student is "Derrick Sarki Agwom")
  if (fileRatio >= 0.95 && fileTokens.length >= 2) {
    return {
      student,
      score: Math.round(86 + studRatio * 7),
      reason: `Matched ${fileTokens.length} name components`,
    };
  }

  // Two or more strong word matches (e.g. 2 out of 3 tokens matched)
  if (matchedFileTokens >= 2 && (studRatio >= 0.65 || fileRatio >= 0.65)) {
    const combined = (studRatio + fileRatio) / 2;
    return {
      student,
      score: Math.round(72 + combined * 18),
      reason: `Partial name match (${matchedFileTokens} words)`,
    };
  }

  // Single word match for single-word filenames (only if file has 1 token and student name starts with it)
  if (fileTokens.length === 1 && studTokens.length > 0) {
    const sim = wordSimilarity(fileTokens[0], studTokens[0]);
    if (sim >= 0.9) {
      return {
        student,
        score: Math.round(65 * sim),
        reason: "Single name match (needs review)",
      };
    }
  }

  return { student, score: 0, reason: "No confident match" };
}

export interface PhotoMatchItem {
  id: string;
  file: File;
  previewUrl: string;
  cleanedName: string;
  matchedStudent: Student | null;
  confidence: number;
  matchReason: string;
  status: "exact" | "high" | "fuzzy" | "unmatched" | "manual";
  ignored?: boolean;
}

/**
 * Batch match uploaded image files against a list of students.
 * Prioritizes target class students, resolves collisions, and assigns top candidates.
 */
export function matchPhotosToStudents(
  files: File[],
  students: Student[],
  targetClass?: string
): PhotoMatchItem[] {
  // If target class specified, partition students so target class is evaluated first
  const inClassStudents = targetClass && targetClass !== "all"
    ? students.filter(s => s.className?.trim().toLowerCase() === targetClass.trim().toLowerCase())
    : students;
  const otherStudents = targetClass && targetClass !== "all"
    ? students.filter(s => s.className?.trim().toLowerCase() !== targetClass.trim().toLowerCase())
    : [];

  const results: PhotoMatchItem[] = [];
  const assignedStudentIds = new Set<string>();

  // Pass 1: Gather best matches for each file
  const candidateList = files.map((file, idx) => {
    const cleaned = cleanFilename(file.name);
    const tokens = tokenizeName(cleaned);

    // 1. Check in-class students first
    let bestScore: MatchScore = { student: null as any, score: 0, reason: "" };

    for (const stud of inClassStudents) {
      const res = scoreStudentMatch(tokens, cleaned, stud);
      // Give slight bonus to in-class students
      const effectiveScore = res.score > 0 ? Math.min(100, res.score + 2) : 0;
      if (effectiveScore > bestScore.score) {
        bestScore = { student: stud, score: effectiveScore, reason: res.reason };
      }
    }

    // 2. If no strong match in class, check other students in tenant
    if (bestScore.score < 80 && otherStudents.length > 0) {
      for (const stud of otherStudents) {
        const res = scoreStudentMatch(tokens, cleaned, stud);
        if (res.score > bestScore.score) {
          bestScore = { student: stud, score: res.score, reason: `${res.reason} (in ${stud.className || "other class"})` };
        }
      }
    }

    return {
      id: `match-${idx}-${file.name}`,
      file,
      previewUrl: URL.createObjectURL(file),
      cleanedName: cleaned,
      bestScore,
    };
  });

  // Pass 2: Sort candidates by score descending to resolve 1-to-1 assignments greedily
  const sorted = [...candidateList].sort((a, b) => b.bestScore.score - a.bestScore.score);

  for (const item of sorted) {
    const score = item.bestScore.score;
    const stud = item.bestScore.student;

    if (score >= 70 && stud && !assignedStudentIds.has(stud.id)) {
      assignedStudentIds.add(stud.id);
      let status: PhotoMatchItem["status"] = "fuzzy";
      if (score >= 95) status = "exact";
      else if (score >= 82) status = "high";

      results.push({
        id: item.id,
        file: item.file,
        previewUrl: item.previewUrl,
        cleanedName: item.cleanedName,
        matchedStudent: stud,
        confidence: score,
        matchReason: item.bestScore.reason,
        status,
      });
    } else {
      // Unmatched or candidate was already assigned to a higher-confidence photo
      results.push({
        id: item.id,
        file: item.file,
        previewUrl: item.previewUrl,
        cleanedName: item.cleanedName,
        matchedStudent: null,
        confidence: score < 70 ? score : Math.round(score * 0.7),
        matchReason: score >= 70
          ? `Name matched ${stud?.name} but assigned to a closer photo`
          : (score > 0 ? item.bestScore.reason : "No matching student name found"),
        status: "unmatched",
      });
    }
  }

  // Restore original file order
  const orderMap = new Map(files.map((f, i) => [f.name, i]));
  results.sort((a, b) => (orderMap.get(a.file.name) ?? 0) - (orderMap.get(b.file.name) ?? 0));

  return results;
}
