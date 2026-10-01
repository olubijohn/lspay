import { ListScroll, Paged, PaginationBar } from "@/components/ui/paginated-list";
import { useState, useRef, useMemo, useEffect, ChangeEvent } from "react";
import { Student } from "@/lib/types";
import { useStore } from "@/store";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CameraCaptureButton } from "@/components/CameraCapture";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { matchPhotosToStudents, PhotoMatchItem } from "@/lib/nameMatcher";
import { processStudentPhoto } from "@/lib/imageProcessor";
import { loadPortraitEngine, makeStudioPortrait, portraitEngineError, type PortraitResult } from "@/lib/portraitStudio";
import { Switch } from "@/components/ui/switch";
import { Loader2, Wand2 } from "lucide-react";

type PortraitEntry = { key: string; status: "working" | "done" | "error"; result?: PortraitResult };
const PORTRAIT_SIZE = 512;
import {
  UploadCloud,
  FolderOpen,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  RefreshCw,
  Printer,
  X,
  Sliders,
  Eye,
  Check,
  Search,
} from "lucide-react";

interface ClassPhotoImporterProps {
  isOpen: boolean;
  onClose: () => void;
  tenantStudents: Student[];
  initialClass?: string;
  onOpenCardPrintStudio?: (students: Student[]) => void;
}

export function ClassPhotoImporter({
  isOpen,
  onClose,
  tenantStudents,
  initialClass,
  onOpenCardPrintStudio,
}: ClassPhotoImporterProps) {
  const { bulkUpdateStudentAvatars } = useStore();

  const [selectedClass, setSelectedClass] = useState<string>(initialClass && initialClass !== "all" ? initialClass : "all");
  const [items, setItems] = useState<PhotoMatchItem[]>([]);
  const [filterTab, setFilterTab] = useState<"all" | "matched" | "unmatched">("all");
  const [searchFilter, setSearchFilter] = useState("");

  // Framing & Headroom options
  const [headroomPercent, setHeadroomPercent] = useState<number>(14);
  const [backgroundColor, setBackgroundColor] = useState<string>("white");

  // AI studio portrait: background → pure white + face-centred headshot (see lib/portraitStudio)
  const [aiPortrait, setAiPortrait] = useState(true);
  const [aiState, setAiState] = useState<"idle" | "loading" | "ready" | "failed">("idle");
  const [portraits, setPortraits] = useState<Record<string, PortraitEntry>>({});
  const portraitsRef = useRef(portraits);
  portraitsRef.current = portraits;
  const runRef = useRef(0);
  const portraitKey = `${headroomPercent}|${backgroundColor}`;
  const portraitOptions = { size: PORTRAIT_SIZE, headroomPercent, background: backgroundColor === "transparent" ? "transparent" as const : "white" as const };

  // Upload state
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [uploadResult, setUploadResult] = useState<{ successCount: number; errors: string[] } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Available classes for dropdown
  const availableClasses = useMemo(() => {
    return Array.from(new Set(tenantStudents.map((s) => s.className?.trim()).filter(Boolean))).sort();
  }, [tenantStudents]);

  // Handle file selection (multiple files or folder)
  const handleFiles = (filesList: FileList | null) => {
    if (!filesList || filesList.length === 0) return;

    const validFiles: File[] = [];
    for (let i = 0; i < filesList.length; i++) {
      const file = filesList[i];
      if (file.type.startsWith("image/") || /\.(png|jpe?g|webp|avif|bmp)$/i.test(file.name)) {
        validFiles.push(file);
      }
    }

    if (validFiles.length === 0) {
      alert("No image files detected. Please select PNG, JPG, or WebP files.");
      return;
    }

    // Auto-detect class name from folder name if applicable (e.g. folder named "Jss 1A")
    let targetClass = selectedClass;
    if ((!targetClass || targetClass === "all") && validFiles.length > 0) {
      // Check relative path or webkitRelativePath
      const firstPath = (validFiles[0] as any).webkitRelativePath || "";
      if (firstPath) {
        const parts = firstPath.split("/");
        if (parts.length >= 2) {
          const folderName = parts[parts.length - 2].trim();
          const matchClass = availableClasses.find(
            (c) => c.toLowerCase().replace(/\s+/g, "") === folderName.toLowerCase().replace(/\s+/g, "")
          );
          if (matchClass) {
            targetClass = matchClass;
            setSelectedClass(matchClass);
          }
        }
      }
    }

    // Run matching engine
    const matched = matchPhotosToStudents(validFiles, tenantStudents, targetClass);
    setItems(matched);
    setUploadResult(null);
  };

  // Re-run matching when user changes target class
  const handleClassChange = (newClass: string) => {
    setSelectedClass(newClass);
    if (items.length > 0) {
      const rawFiles = items.map((it) => it.file);
      const reMatched = matchPhotosToStudents(rawFiles, tenantStudents, newClass);
      setItems(reMatched);
    }
  };

  // Manual student assignment override
  const handleAssignStudent = (itemId: string, studentId: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        if (studentId === "skip") {
          return { ...item, ignored: true, matchedStudent: null, status: "unmatched" };
        }
        const st = tenantStudents.find((s) => s.id === studentId);
        return {
          ...item,
          ignored: false,
          matchedStudent: st || null,
          confidence: 100,
          matchReason: "Manually chosen by user",
          status: "manual",
        };
      })
    );
  };

  // Prepare studio portraits in the background as soon as photos are added, so staff can review them
  // before uploading. Restarts (keeping finished results) when the photos or framing options change.
  const itemIds = items.map((it) => it.id).join("|");
  useEffect(() => {
    if (!aiPortrait || items.length === 0) return;
    const run = ++runRef.current;
    (async () => {
      if (aiState !== "ready") setAiState("loading");
      try {
        await loadPortraitEngine();
      } catch (e) {
        console.warn("Portrait engine failed to load", e);
        if (runRef.current === run) setAiState("failed");
        return;
      }
      if (runRef.current !== run) return;
      setAiState("ready");
      for (const item of items) {
        if (runRef.current !== run) return;
        const existing = portraitsRef.current[item.id];
        if (existing && existing.key === portraitKey && existing.status !== "working") continue;
        setPortraits((p) => ({ ...p, [item.id]: { key: portraitKey, status: "working" } }));
        try {
          const result = await makeStudioPortrait(item.file, portraitOptions);
          if (runRef.current !== run) return;
          setPortraits((p) => ({ ...p, [item.id]: { key: portraitKey, status: "done", result } }));
        } catch (e) {
          console.warn("Portrait failed for", item.file.name, e);
          if (runRef.current !== run) return;
          setPortraits((p) => ({ ...p, [item.id]: { key: portraitKey, status: "error" } }));
        }
        await new Promise((r) => setTimeout(r, 0)); // let the UI breathe between photos
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemIds, portraitKey, aiPortrait]);

  const portraitFor = (id: string) => {
    const e = portraits[id];
    return e && e.key === portraitKey ? e : undefined;
  };
  const portraitsDone = items.filter((it) => portraitFor(it.id)?.status === "done").length;
  const portraitsNoFace = items.filter((it) => { const e = portraitFor(it.id); return e?.status === "done" && !e.result?.faceFound; }).length;
  const aiActive = aiPortrait && aiState !== "failed";

  // Class vs photos: who in the class still has no photo, and which photos match no one in the class
  const coverage = useMemo(() => {
    const classStudents = selectedClass && selectedClass !== "all"
      ? tenantStudents.filter((s) => s.className?.trim() === selectedClass)
      : tenantStudents;
    const photosPerStudent = new Map<string, number>();
    for (const it of items) {
      if (it.matchedStudent && !it.ignored) photosPerStudent.set(it.matchedStudent.id, (photosPerStudent.get(it.matchedStudent.id) ?? 0) + 1);
    }
    const inClass = new Set(classStudents.map((s) => s.id));
    const withPhoto = classStudents.filter((s) => photosPerStudent.has(s.id));
    const withoutPhoto = classStudents.filter((s) => !photosPerStudent.has(s.id)).sort((a, b) => a.name.localeCompare(b.name));
    const orphanPhotos = items.filter((it) => !it.matchedStudent || it.ignored || !inClass.has(it.matchedStudent.id));
    const duplicates = [...photosPerStudent.entries()].filter(([, n]) => n > 1).map(([id]) => tenantStudents.find((s) => s.id === id)?.name ?? id);
    return { classStudents, withPhoto, withoutPhoto, orphanPhotos, duplicates };
  }, [items, tenantStudents, selectedClass]);
  const [coverageOpen, setCoverageOpen] = useState<"none" | "students" | "photos">("none");
  const copyList = (lines: string[]) => { navigator.clipboard?.writeText(lines.join("\n")).catch(() => undefined); };

  // Count stats
  const totalCount = items.length;
  const matchedCount = items.filter((it) => it.matchedStudent && !it.ignored).length;
  const unmatchedCount = items.filter((it) => !it.matchedStudent && !it.ignored).length;

  // Filtered view items
  const displayItems = useMemo(() => {
    return items.filter((it) => {
      if (filterTab === "matched" && (!it.matchedStudent || it.ignored)) return false;
      if (filterTab === "unmatched" && (it.matchedStudent && !it.ignored)) return false;

      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase();
        const matchesName = it.cleanedName.toLowerCase().includes(q);
        const matchesFile = it.file.name.toLowerCase().includes(q);
        const matchesStudent = it.matchedStudent?.name.toLowerCase().includes(q);
        const matchesReg = it.matchedStudent?.studentId.toLowerCase().includes(q);
        if (!matchesName && !matchesFile && !matchesStudent && !matchesReg) return false;
      }
      return true;
    });
  }, [items, filterTab, searchFilter]);

  // Execute processing and bulk update
  const handleUploadAndSync = async () => {
    const toUpload = items.filter((it) => it.matchedStudent && !it.ignored);
    if (toUpload.length === 0) {
      alert("No matched students to upload. Please review matches before uploading.");
      return;
    }

    setIsProcessing(true);
    setProgressPercent(0);
    setStatusMessage("Preparing images with head-safe framing...");

    const updates: { studentId: string; imageUrl: string }[] = [];
    const total = toUpload.length;

    try {
      for (let i = 0; i < total; i++) {
        const item = toUpload[i];
        setStatusMessage(`${aiActive ? "Studio portrait" : "Smart-framing"} (${i + 1}/${total}): ${item.matchedStudent!.name}`);

        // AI studio portrait (white background + headshot) when available; head-safe framing otherwise
        let processedDataUrl: string | null = null;
        if (aiActive) {
          const cached = portraitFor(item.id);
          if (cached?.status === "done" && cached.result) {
            processedDataUrl = cached.result.dataUrl;
          } else {
            try { processedDataUrl = (await makeStudioPortrait(item.file, portraitOptions)).dataUrl; }
            catch (e) { console.warn("Portrait failed; falling back to framing", e); }
          }
        }
        if (!processedDataUrl) {
          processedDataUrl = await processStudentPhoto(item.file, {
            targetWidth: 520,
            targetHeight: 520,
            headroomPercent,
            backgroundColor,
            quality: 0.86,
            format: "image/jpeg",
          });
        }

        updates.push({
          studentId: item.matchedStudent!.id,
          imageUrl: processedDataUrl,
        });

        setProgressPercent(Math.round(((i + 1) / total) * 60));
      }

      setStatusMessage("Saving photos to Supabase database (reflects in LSPay & LSA)...");
      setProgressPercent(75);

      const res = await bulkUpdateStudentAvatars(updates);
      setProgressPercent(100);
      setStatusMessage("Complete!");
      setUploadResult(res);
    } catch (err: any) {
      console.error("Bulk upload error:", err);
      alert(`Upload error: ${err?.message || "Unknown error"}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const resetAll = () => {
    runRef.current++;
    setPortraits({});
    setItems([]);
    setUploadResult(null);
    setProgressPercent(0);
    setStatusMessage("");
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (open || isProcessing) return;
        // don't lose a half-finished import to a stray ✕ / Escape
        if (items.length > 0 && !uploadResult && !window.confirm("Close the importer? The photos you added and the prepared portraits will be discarded.")) return;
        onClose();
      }}
    >
      <DialogContent className="sm:max-w-[950px] w-full max-h-[92vh] flex flex-col bg-card border-border text-foreground p-0 overflow-hidden shadow-2xl">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b border-border bg-card">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <DialogTitle className="text-2xl font-bold flex items-center gap-2.5">
                <Sparkles className="w-6 h-6 text-emerald-500" />
                <span>Class Photo Bulk Importer</span>
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-sm mt-1">
                Import and auto-match student photos directly to student profiles. Saves to shared database for{" "}
                <span className="text-foreground font-semibold">LSPay</span> and{" "}
                <span className="text-emerald-500 font-semibold">LSA</span>.
              </DialogDescription>
            </div>

            {/* Target Class Filter */}
            <div className="flex items-center gap-2 self-stretch sm:self-auto">
              <Label className="text-xs font-semibold whitespace-nowrap text-muted-foreground">Target Class:</Label>
              <Select value={selectedClass} onValueChange={handleClassChange} disabled={isProcessing}>
                <SelectTrigger className="w-[160px] h-9 text-xs bg-background border-border font-semibold">
                  <SelectValue placeholder="All Classes" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border text-foreground max-h-60">
                  <SelectItem value="all">All Classes ({availableClasses.length})</SelectItem>
                  {availableClasses.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </DialogHeader>

        {/* Body content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* STEP 1: Upload / Drop Zone when no items */}
          {items.length === 0 && (
            <div className="space-y-6">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleFiles(e.dataTransfer.files);
                }}
                className="border-2 border-dashed border-primary/30 hover:border-primary/60 bg-primary/5 hover:bg-primary/10 transition-all rounded-2xl p-10 text-center flex flex-col items-center justify-center cursor-pointer group"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <UploadCloud className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-1">
                  Drag and drop class photos here
                </h3>
                <p className="text-xs text-muted-foreground max-w-md mb-6">
                  Supports multiple photos named by student (e.g.{" "}
                  <code className="bg-muted px-1.5 py-0.5 rounded text-primary font-mono text-[11px]">
                    Ahtin Lehwot Samuel-removebackgrounds-ai.png
                  </code>
                  ). AI tags and background removal suffixes are automatically cleaned!
                </p>

                <div className="flex flex-wrap items-center justify-center gap-3">
                  <Button
                    type="button"
                    variant="default"
                    className="bg-primary hover:bg-primary-hover text-primary-foreground font-semibold h-10 px-5"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                  >
                    <ImageIcon className="w-4 h-4 mr-2" /> Select Images (Multiple)
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-border bg-background hover:bg-accent font-semibold h-10 px-5"
                    onClick={(e) => {
                      e.stopPropagation();
                      folderInputRef.current?.click();
                    }}
                  >
                    <FolderOpen className="w-4 h-4 mr-2" /> Select Entire Class Folder
                  </Button>
                  {/* stop clicks (including inside the camera dialog) from reaching the drop zone's file picker */}
                  <span onClick={(e) => e.stopPropagation()}>
                    <CameraCaptureButton
                      label="Take photo"
                      facing="user"
                      className="h-10 px-5 font-semibold"
                      onCapture={(f) => handleFiles([f] as unknown as FileList)}
                    />
                  </span>
                </div>
              </div>

              {/* Instructions banner */}
              <div className="bg-muted/40 rounded-xl p-4 border border-border/60 text-xs text-muted-foreground space-y-2">
                <div className="font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-primary" />
                  How Intelligent Matching Works:
                </div>
                <ul className="list-disc list-inside space-y-1 pl-1">
                  <li>
                    <strong>Automatic Name Cleaning:</strong> Removes{" "}
                    <code>-removebackgrounds-ai</code>, copy numbers, and file extensions cleanly.
                  </li>
                  <li>
                    <strong>Smart Headroom Framing:</strong> Automatically adds top headroom padding so
                    student heads and hair are <em>never cut off</em> when displayed inside circular ID cards or profiles.
                  </li>
                  <li>
                    <strong>West African & International Name Order:</strong> Matches First/Last/Middle names in any order.
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* Hidden file inputs */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e: ChangeEvent<HTMLInputElement>) => handleFiles(e.target.files)}
          />
          <input
            ref={folderInputRef}
            type="file"
            multiple
            // @ts-ignore
            webkitdirectory=""
            directory=""
            className="hidden"
            onChange={(e: ChangeEvent<HTMLInputElement>) => handleFiles(e.target.files)}
          />

          {/* STEP 2: Review & Framing Settings when items are loaded */}
          {items.length > 0 && !uploadResult && (
            <div className="space-y-5">
              {/* Summary Stats & Action Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/40 p-4 rounded-xl border border-border">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="bg-background text-foreground font-bold px-3 py-1 text-xs">
                    Total: {totalCount}
                  </Badge>
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-0 font-bold px-3 py-1 text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1 inline" /> Matched: {matchedCount}
                  </Badge>
                  {unmatchedCount > 0 && (
                    <Badge className="bg-amber-500/20 text-amber-400 border-0 font-bold px-3 py-1 text-xs">
                      <AlertCircle className="w-3.5 h-3.5 mr-1 inline" /> Needs Review: {unmatchedCount}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetAll}
                    disabled={isProcessing}
                    className="text-muted-foreground hover:text-foreground text-xs h-8"
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-1" /> Reset / Re-upload
                  </Button>
                </div>
              </div>

              {/* Class vs photos coverage */}
              <div className="rounded-2xl border border-border bg-card p-4" data-testid="coverage-panel">
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <div className="text-sm font-extrabold text-foreground">
                    Class vs photos {selectedClass && selectedClass !== "all" ? <span className="font-bold text-muted-foreground">· {selectedClass}</span> : <span className="font-bold text-muted-foreground">· all classes</span>}
                  </div>
                  {coverage.duplicates.length > 0 && (
                    <span className="text-xs font-bold text-amber-700" title={coverage.duplicates.join(", ")}>
                      {coverage.duplicates.length} student{coverage.duplicates.length > 1 ? "s have" : " has"} more than one photo
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="rounded-xl bg-muted/60 p-3">
                    <div className="text-[11px] font-extrabold text-muted-foreground">Students in class</div>
                    <div className="font-display text-2xl text-foreground">{coverage.classStudents.length}</div>
                  </div>
                  <div className="rounded-xl bg-muted/60 p-3">
                    <div className="text-[11px] font-extrabold text-muted-foreground">Photos uploaded</div>
                    <div className="font-display text-2xl text-foreground">{totalCount}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCoverageOpen((v) => (v === "students" ? "none" : "students"))}
                    className={`rounded-xl p-3 text-left transition-colors ${coverage.withoutPhoto.length ? "bg-peach hover:bg-peach/70" : "bg-mint"} ${coverageOpen === "students" ? "ring-2 ring-amber-500/50" : ""}`}
                    data-testid="btn-students-without-photo"
                  >
                    <div className="text-[11px] font-extrabold text-muted-foreground">Students without photo</div>
                    <div className={`font-display text-2xl ${coverage.withoutPhoto.length ? "text-amber-700" : "text-green-700"}`}>{coverage.withoutPhoto.length}</div>
                    <div className="text-[10px] font-bold text-muted-foreground">{coverage.withPhoto.length} of {coverage.classStudents.length} covered{coverage.withoutPhoto.length ? " · tap to see" : ""}</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCoverageOpen((v) => (v === "photos" ? "none" : "photos"))}
                    className={`rounded-xl p-3 text-left transition-colors ${coverage.orphanPhotos.length ? "bg-blush hover:bg-blush/70" : "bg-mint"} ${coverageOpen === "photos" ? "ring-2 ring-red-500/40" : ""}`}
                    data-testid="btn-photos-without-student"
                  >
                    <div className="text-[11px] font-extrabold text-muted-foreground">Photos without student</div>
                    <div className={`font-display text-2xl ${coverage.orphanPhotos.length ? "text-red-700" : "text-green-700"}`}>{coverage.orphanPhotos.length}</div>
                    <div className="text-[10px] font-bold text-muted-foreground">{coverage.orphanPhotos.length ? "not matched to this class · tap to see" : "every photo matched"}</div>
                  </button>
                </div>

                {coverageOpen === "students" && (
                  <div className="mt-3 rounded-xl border border-border p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold">Students in {selectedClass !== "all" ? selectedClass : "the school"} with no photo in this upload</span>
                      {coverage.withoutPhoto.length > 0 && (
                        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => copyList(coverage.withoutPhoto.map((s) => `${s.name} (${s.studentId})`))}>Copy list</Button>
                      )}
                    </div>
                    {coverage.withoutPhoto.length === 0 ? (
                      <p className="text-xs text-green-700 font-bold">Every student has a photo.</p>
                    ) : (
                      <ul className="grid max-h-48 grid-cols-1 gap-x-4 gap-y-1 overflow-y-auto text-xs sm:grid-cols-2">
                        {coverage.withoutPhoto.map((s) => (
                          <li key={s.id} className="flex items-center justify-between gap-2 border-b border-border/50 py-1">
                            <span className="truncate font-semibold text-foreground">{s.name}</span>
                            <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{s.studentId}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {coverageOpen === "photos" && (
                  <div className="mt-3 rounded-xl border border-border p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold">Photos that don't match a student in {selectedClass !== "all" ? selectedClass : "the school"}</span>
                      {coverage.orphanPhotos.length > 0 && (
                        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => copyList(coverage.orphanPhotos.map((it) => it.file.name))}>Copy list</Button>
                      )}
                    </div>
                    {coverage.orphanPhotos.length === 0 ? (
                      <p className="text-xs text-green-700 font-bold">Every photo is matched to a student.</p>
                    ) : (
                      <>
                        <ul className="grid max-h-48 grid-cols-1 gap-x-4 gap-y-1 overflow-y-auto text-xs sm:grid-cols-2">
                          {coverage.orphanPhotos.map((it) => (
                            <li key={it.id} className="flex items-center gap-2 border-b border-border/50 py-1">
                              <img src={it.previewUrl} alt="" className="h-7 w-7 shrink-0 rounded-full bg-muted object-cover object-top" />
                              <span className="min-w-0 flex-1 truncate font-semibold text-foreground" title={it.file.name}>{it.cleanedName || it.file.name}</span>
                              {it.ignored && <span className="shrink-0 text-[10px] text-muted-foreground">skipped</span>}
                            </li>
                          ))}
                        </ul>
                        <p className="mt-2 text-[11px] text-muted-foreground">Use "Manual Assignment" in the list below to match these, or pick another class.</p>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* AI studio portrait: white background + headshot */}
              <div className="rounded-2xl border border-border bg-card p-4" data-testid="ai-portrait-panel">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lilac text-ink-2"><Wand2 className="h-5 w-5" /></span>
                    <div>
                      <div className="text-sm font-extrabold text-foreground">Studio portrait (AI)</div>
                      <div className="text-xs text-muted-foreground">
                        Removes the background to pure white and crops a head-and-shoulders shot for the ID card. Runs on this device — photos are never uploaded for processing.
                      </div>
                    </div>
                  </div>
                  <label className="flex shrink-0 items-center gap-2 text-xs font-bold">
                    <Switch checked={aiPortrait} onCheckedChange={setAiPortrait} disabled={isProcessing} data-testid="toggle-ai-portrait" />
                    {aiPortrait ? "On" : "Off"}
                  </label>
                </div>
                {aiPortrait && (
                  <div className="mt-3 text-xs font-semibold">
                    {aiState === "loading" && (
                      <span className="flex items-center gap-1.5 text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading the AI model (first time only, ~27 MB)…</span>
                    )}
                    {aiState === "failed" && (
                      <div className="space-y-1.5 text-amber-700">
                        <div>The AI model couldn't load, so photos will use head-safe framing without background removal.</div>
                        {portraitEngineError() && <div className="break-words font-mono text-[10px] text-muted-foreground">Details: {portraitEngineError()}</div>}
                        <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => { setAiState("idle"); setAiPortrait(false); setTimeout(() => setAiPortrait(true), 0); }}>
                          <RefreshCw className="h-3.5 w-3.5" /> Try again
                        </Button>
                      </div>
                    )}
                    {aiState === "ready" && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2 text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            {portraitsDone < totalCount ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}
                            {portraitsDone < totalCount ? `Preparing portraits ${portraitsDone}/${totalCount}…` : `All ${totalCount} portraits ready — check them below before uploading.`}
                          </span>
                          {portraitsNoFace > 0 && <span className="text-amber-700">{portraitsNoFace} without a clear face — review</span>}
                        </div>
                        <Progress value={totalCount ? (portraitsDone / totalCount) * 100 : 0} className="h-1.5" />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Headroom / Anti-Head-Cutting Framing Controls */}
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white border-2 border-primary flex items-center justify-center overflow-hidden shrink-0 shadow-sm p-0.5">
                    {items[0] && (() => {
                      const pe = aiActive ? portraitFor(items[0].id) : undefined;
                      const url = pe?.status === "done" && pe.result ? pe.result.dataUrl : items[0].previewUrl;
                      return <img src={url} alt="Sample" className={pe?.status === "done" ? "w-full h-full object-cover rounded-full" : "w-full h-full object-contain object-top"} />;
                    })()}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-primary" />
                      Face & Headroom Spacing:
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Keeps full head and hair complete without clipping.
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                  <div className="flex items-center gap-1 bg-background p-1 rounded-lg border border-border text-xs">
                    <button
                      type="button"
                      onClick={() => setHeadroomPercent(10)}
                      className={`px-2.5 py-1 rounded-md font-medium text-xs transition-all ${
                        headroomPercent === 10 ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Snug (10%)
                    </button>
                    <button
                      type="button"
                      onClick={() => setHeadroomPercent(14)}
                      className={`px-2.5 py-1 rounded-md font-medium text-xs transition-all ${
                        headroomPercent === 14 ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Balanced (14%) ★
                    </button>
                    <button
                      type="button"
                      onClick={() => setHeadroomPercent(18)}
                      className={`px-2.5 py-1 rounded-md font-medium text-xs transition-all ${
                        headroomPercent === 18 ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Spacious (18%)
                    </button>
                  </div>

                  <Select value={backgroundColor} onValueChange={setBackgroundColor}>
                    <SelectTrigger className="w-[120px] h-8 text-xs bg-background border-border">
                      <SelectValue placeholder="Background" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border text-foreground">
                      <SelectItem value="white">White Backdrop</SelectItem>
                      <SelectItem value="transparent">Transparent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Filter Tabs and Search Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setFilterTab("all")}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                      filterTab === "all" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    All ({totalCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterTab("matched")}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                      filterTab === "matched" ? "bg-card text-emerald-500 shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Matched ({matchedCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterTab("unmatched")}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                      filterTab === "unmatched" ? "bg-card text-amber-500 shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Needs Review ({unmatchedCount})
                  </button>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Search name or ID..."
                    className="pl-8 h-8 text-xs bg-background border-border text-foreground"
                  />
                  {searchFilter && (
                    <button
                      type="button"
                      onClick={() => setSearchFilter("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Matching Table / List */}
              <Paged items={displayItems}>{(pg) => (
              <div className="border border-border rounded-xl overflow-hidden bg-card shadow-inner">
                <ListScroll page={pg.page} offset="30rem">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/70 text-muted-foreground font-semibold border-b border-border">
                    <tr>
                      <th className="py-2.5 px-3">Photo Preview</th>
                      <th className="py-2.5 px-3">Detected Name (from file)</th>
                      <th className="py-2.5 px-3">Matched Student Record</th>
                      <th className="py-2.5 px-3">Match Confidence</th>
                      <th className="py-2.5 px-3 text-right">Manual Assignment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {displayItems.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-muted-foreground">
                          No images match the current filter.
                        </td>
                      </tr>
                    ) : (
                      pg.pageItems.map((item) => (
                        <tr
                          key={item.id}
                          className={`hover:bg-muted/30 transition-colors ${
                            item.ignored ? "opacity-40" : ""
                          }`}
                        >
                          {/* Image preview in circle badge format */}
                          <td className="py-2.5 px-3">
                            {(() => {
                              const pe = aiActive ? portraitFor(item.id) : undefined;
                              const done = pe?.status === "done" && pe.result;
                              return (
                                <div className="flex flex-col items-center gap-1">
                                  <div className={`relative w-16 h-16 rounded-full border-2 bg-white flex items-center justify-center overflow-hidden shadow-sm shrink-0 ${done && !pe!.result!.faceFound ? "border-amber-500" : "border-border"}`}>
                                    <img
                                      src={done ? pe!.result!.dataUrl : item.previewUrl}
                                      alt={item.cleanedName}
                                      className={done ? "w-full h-full object-cover" : "w-full h-full object-contain object-top p-0.5"}
                                      data-testid={done ? `portrait-${item.id}` : undefined}
                                    />
                                    {aiActive && pe?.status === "working" && (
                                      <span className="absolute inset-0 flex items-center justify-center bg-white/60"><Loader2 className="h-4 w-4 animate-spin text-ink-2" /></span>
                                    )}
                                  </div>
                                  {done && !pe!.result!.faceFound && <span className="text-[9px] font-bold text-amber-700">No face found</span>}
                                  {aiActive && pe?.status === "error" && <span className="text-[9px] font-bold text-amber-700">Framing only</span>}
                                </div>
                              );
                            })()}
                          </td>

                          {/* Detected Name */}
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-foreground text-sm">{item.cleanedName}</div>
                            <div className="text-[10px] text-muted-foreground truncate max-w-[180px]" title={item.file.name}>
                              {item.file.name}
                            </div>
                          </td>

                          {/* Matched Student */}
                          <td className="py-2.5 px-3">
                            {item.matchedStudent ? (
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-muted border border-border flex items-center justify-center overflow-hidden shrink-0">
                                  <img
                                    src={item.matchedStudent.imageUrl}
                                    alt=""
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                                        item.matchedStudent!.name
                                      )}`;
                                    }}
                                  />
                                </div>
                                <div className="min-w-0">
                                  <div className="font-bold text-foreground truncate max-w-[160px]">
                                    {item.matchedStudent.name}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground font-mono">
                                    {item.matchedStudent.studentId} • {item.matchedStudent.className || "No class"}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <span className="text-amber-500 font-semibold italic">Unmatched</span>
                            )}
                          </td>

                          {/* Confidence */}
                          <td className="py-2.5 px-3">
                            {item.status === "exact" && (
                              <Badge className="bg-emerald-500/20 text-emerald-400 border-0 font-bold text-[10px]">
                                100% Exact Match
                              </Badge>
                            )}
                            {item.status === "high" && (
                              <Badge className="bg-blue-500/20 text-blue-400 border-0 font-bold text-[10px]">
                                {item.confidence}% Reordered
                              </Badge>
                            )}
                            {item.status === "fuzzy" && (
                              <Badge className="bg-cyan-500/20 text-cyan-400 border-0 font-bold text-[10px]">
                                {item.confidence}% Partial
                              </Badge>
                            )}
                            {item.status === "manual" && (
                              <Badge className="bg-purple-500/20 text-purple-400 border-0 font-bold text-[10px]">
                                Manual Choice
                              </Badge>
                            )}
                            {item.status === "unmatched" && (
                              <Badge className="bg-amber-500/20 text-amber-400 border-0 font-bold text-[10px]">
                                Review Needed
                              </Badge>
                            )}
                            <div className="text-[10px] text-muted-foreground mt-0.5">{item.matchReason}</div>
                          </td>

                          {/* Manual Student Override Dropdown */}
                          <td className="py-2.5 px-3 text-right">
                            <Select
                              value={item.matchedStudent?.id || "unmatched"}
                              onValueChange={(val) => handleAssignStudent(item.id, val)}
                            >
                              <SelectTrigger className="w-[180px] h-8 text-[11px] bg-background border-border text-foreground ml-auto">
                                <SelectValue placeholder="Assign student..." />
                              </SelectTrigger>
                              <SelectContent className="bg-card border-border text-foreground max-h-56">
                                <SelectItem value="unmatched">
                                  <span className="text-amber-400">-- None (Unmatched) --</span>
                                </SelectItem>
                                <SelectItem value="skip">
                                  <span className="text-muted-foreground">Skip this photo</span>
                                </SelectItem>
                                {tenantStudents.map((st) => (
                                  <SelectItem key={st.id} value={st.id}>
                                    {st.name} ({st.studentId})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                </ListScroll>
                <PaginationBar p={pg} label="photos" />
              </div>
              )}</Paged>

              {/* Progress bar during upload */}
              {isProcessing && (
                <div className="space-y-2 p-4 bg-primary/10 rounded-xl border border-primary/20 animate-in fade-in">
                  <div className="flex justify-between text-xs font-semibold text-foreground">
                    <span>{statusMessage}</span>
                    <span>{progressPercent}%</span>
                  </div>
                  <Progress value={progressPercent} className="h-2 bg-muted" />
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Success Screen */}
          {uploadResult && (
            <div className="text-center py-8 space-y-4 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto">
                <Check className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold text-foreground">
                Successfully Uploaded & Synced {uploadResult.successCount} Photos!
              </h3>
              <p className="text-muted-foreground text-sm max-w-md mx-auto">
                All photos have been smart-framed with complete headroom and saved to the database. They are now live
                in <span className="font-semibold text-foreground">LSPay</span> and will reflect across{" "}
                <span className="font-semibold text-emerald-500">LSA</span> immediately.
              </p>

              {uploadResult.errors.length > 0 && (
                <div className="text-left bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl max-w-lg mx-auto text-xs text-amber-400">
                  <div className="font-bold mb-1">Warnings ({uploadResult.errors.length}):</div>
                  <ul className="list-disc list-inside space-y-0.5">
                    {uploadResult.errors.map((e, idx) => (
                      <li key={idx}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
                {onOpenCardPrintStudio && (
                  <Button
                    onClick={() => {
                      const updated = tenantStudents.filter((s) =>
                        items.some((it) => it.matchedStudent?.id === s.id && !it.ignored)
                      );
                      onClose();
                      onOpenCardPrintStudio(updated.length > 0 ? updated : tenantStudents);
                    }}
                    className="bg-primary hover:bg-primary-hover text-primary-foreground font-bold h-11 px-6 shadow-lg shadow-primary/20"
                  >
                    <Printer className="w-4 h-4 mr-2" /> Open in Card Print Studio
                  </Button>
                )}
                <Button variant="outline" onClick={onClose} className="h-11 px-6 font-semibold">
                  Done / Close
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {items.length > 0 && !uploadResult && (
          <div className="p-4 border-t border-border bg-card flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              Ready to sync <strong className="text-foreground">{matchedCount}</strong> student photos
              {aiActive ? " as white-background studio portraits." : " with anti-head-cut framing."}
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Button
                variant="ghost"
                onClick={() => {
                  if (items.length > 0 && !window.confirm("Cancel the import? The photos you added and the prepared portraits will be discarded.")) return;
                  onClose();
                }}
                disabled={isProcessing}
                className="text-muted-foreground hover:text-foreground"
              >
                Cancel
              </Button>
              <Button
                onClick={handleUploadAndSync}
                disabled={isProcessing || matchedCount === 0}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 px-6 shadow-lg shadow-emerald-600/20 flex-1 sm:flex-none"
              >
                <UploadCloud className="w-4 h-4 mr-2" />
                Upload & Sync All ({matchedCount} Photos)
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
