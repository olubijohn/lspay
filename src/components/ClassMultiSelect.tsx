import { useMemo, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export interface ClassOption {
  value: string;
  count: number;
}

interface ClassMultiSelectProps {
  options: ClassOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  className?: string;
  "data-testid"?: string;
}

/** Pick any number of classes. An empty selection means "all classes". */
export function ClassMultiSelect({ options, selected, onChange, className, ...rest }: ClassMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter(o => o.value.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const toggle = (value: string) =>
    onChange(selected.includes(value) ? selected.filter(v => v !== value) : [...selected, value]);

  const label =
    selected.length === 0 ? "All classes"
    : selected.length === 1 ? selected[0]
    : `${selected.length} classes`;

  return (
    <Popover open={open} onOpenChange={o => { setOpen(o); if (!o) setQuery(""); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-9 w-full items-center justify-between gap-2 rounded-full border border-border bg-background px-3 text-sm text-foreground",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
          data-testid={rest["data-testid"]}
        >
          <span className="truncate">{label}</span>
          <span className="flex items-center gap-1 shrink-0">
            {selected.length > 0 && (
              <span
                role="button"
                tabIndex={0}
                aria-label="Clear class filter"
                onClick={e => { e.stopPropagation(); onChange([]); }}
                onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onChange([]); } }}
                className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
            <ChevronDown className="h-4 w-4 opacity-50" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0 bg-card border-border">
        {options.length > 6 && (
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Find a class…"
              className="h-7 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              autoFocus
            />
          </div>
        )}
        <div className="max-h-64 overflow-y-auto p-1">
          {visible.map(o => (
            <label
              key={o.value}
              className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-muted font-normal"
            >
              <Checkbox checked={selected.includes(o.value)} onCheckedChange={() => toggle(o.value)} />
              <span className="flex-1 truncate">{o.value}</span>
              <span className="text-xs text-muted-foreground">{o.count}</span>
            </label>
          ))}
          {visible.length === 0 && (
            <p className="px-2 py-4 text-center text-sm text-muted-foreground">
              {options.length === 0 ? "No classes yet." : "No class matches."}
            </p>
          )}
        </div>
        {options.length > 0 && (
          <div className="flex items-center justify-between border-t border-border px-2 py-1.5">
            <button
              type="button"
              onClick={() => onChange(Array.from(new Set([...selected, ...visible.map(o => o.value)])))}
              className="rounded-md px-2 py-1 text-xs font-bold text-primary hover:bg-muted"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={() => onChange([])}
              disabled={selected.length === 0}
              className="rounded-md px-2 py-1 text-xs font-bold text-muted-foreground hover:bg-muted disabled:opacity-40"
            >
              Clear
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
