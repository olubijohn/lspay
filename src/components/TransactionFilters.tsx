import { Package, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface Props {
  studentQuery: string;
  onStudentQueryChange: (v: string) => void;
  item: string;
  onItemChange: (v: string) => void;
  itemOptions: string[];
  /** Shown after the filters, e.g. "12 of 40 transactions". */
  resultLabel?: string;
}

/** Student search + item filter for the transactions screens. */
export function TransactionFilters({ studentQuery, onStudentQueryChange, item, onItemChange, itemOptions, resultLabel }: Props) {
  const active = studentQuery.trim() !== "" || item !== "all";
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-2 sm:flex-row sm:items-center" data-testid="tx-filters">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={studentQuery}
          onChange={e => onStudentQueryChange(e.target.value)}
          placeholder="Search student or reg. no."
          className="h-10 bg-background pl-10 pr-9"
          data-testid="input-tx-student"
          aria-label="Search transactions by student"
        />
        {studentQuery && (
          <button
            type="button"
            onClick={() => onStudentQueryChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Clear student search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <Select value={item} onValueChange={onItemChange}>
        <div className="relative w-full sm:w-56">
          <Package className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <SelectTrigger className="h-10 w-full bg-background pl-10" data-testid="select-tx-item" aria-label="Filter by item">
            <SelectValue placeholder="All items" />
          </SelectTrigger>
        </div>
        <SelectContent className="max-h-72">
          <SelectItem value="all">All items</SelectItem>
          {itemOptions.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}
        </SelectContent>
      </Select>
      {(active || resultLabel) && (
        <div className="flex items-center justify-between gap-2 px-1 sm:justify-end">
          {resultLabel && <span className="whitespace-nowrap text-xs font-bold text-muted-foreground">{resultLabel}</span>}
          {active && (
            <Button type="button" variant="ghost" size="sm" onClick={() => { onStudentQueryChange(""); onItemChange("all"); }} className="h-9 rounded-xl text-xs">
              <X /> Clear
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
