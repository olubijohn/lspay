import type { StudentGuardian } from "@/lib/guardians";
import { loginStatusLabel, relationshipLabel } from "@/lib/guardians";
import { cn } from "@/lib/utils";

/** "Parent details" cell for student lists: first guardian, "+N more", and how many are connected to LSPay. */
export function GuardianCell({ guardians, className }: { guardians: StudentGuardian[]; className?: string }) {
  if (guardians.length === 0) {
    return <span className={cn("text-xs italic text-muted-foreground/70", className)}>No guardian</span>;
  }
  const [first, ...rest] = guardians;
  const connected = guardians.filter((g) => g.status !== "not_connected");
  const awaiting = connected.length > 0 && connected.every((g) => g.status === "awaiting");
  const title = guardians.map((g) => `${g.name} (${relationshipLabel(g.relationship)}) · ${g.email} · ${loginStatusLabel(g.status)}`).join("\n");
  return (
    <div className={cn("min-w-0 max-w-[15rem]", className)} title={title}>
      <div className="truncate font-medium text-foreground">{first.name}</div>
      <div className="truncate text-xs text-muted-foreground">{first.email}</div>
      <div className="mt-1 flex flex-wrap items-center gap-1">
        {rest.length > 0 && (
          <span className="whitespace-nowrap rounded-full bg-lilac px-2 py-0.5 text-[10px] font-extrabold text-ink-2">+{rest.length} more</span>
        )}
        <span className={cn(
          "whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-extrabold",
          connected.length === 0 ? "bg-muted text-muted-foreground" : awaiting ? "bg-peach text-amber-700" : "bg-mint text-green-700",
        )}>
          {connected.length === 0 ? "LSPay not connected" : `${connected.length} of ${guardians.length} connected`}
        </span>
      </div>
    </div>
  );
}
