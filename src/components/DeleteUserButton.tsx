import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { useStore } from "@/store";
import type { SystemUser } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** "Delete" for a staff account, with a confirmation. Deleting removes the login itself, so the person can no
 * longer sign in to LSPay, LSA or any other app (deactivating only pauses access). */
export function DeleteUserButton({ user }: { user: SystemUser }) {
  const { deleteSystemUser, session } = useStore();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (session.user?.id === user.id) return null; // nobody deletes their own account

  const confirm = async () => {
    setBusy(true); setError("");
    const r = await deleteSystemUser(user.id);
    setBusy(false);
    if (r.success) setOpen(false); else setError(r.message ?? "Could not delete this user.");
  };

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} className="text-red-600 hover:bg-blush hover:text-red-700" data-testid={`btn-delete-user-${user.id}`}>
        <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
      </Button>
      <Dialog open={open} onOpenChange={(o) => { if (!busy) { setOpen(o); setError(""); } }}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader className="text-left">
            <DialogTitle className="font-display text-xl">Delete {user.name}?</DialogTitle>
            <DialogDescription>
              {user.email} will lose access straight away and can no longer sign in to LSPay or any other {user.role === "super_admin" ? "console" : "school app"}. This cannot be undone. Their past sales and records are kept.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="rounded-xl bg-blush px-3 py-2 text-sm font-semibold text-red-700" role="alert">{error}</p>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy} className="h-10">Cancel</Button>
            <Button onClick={confirm} disabled={busy} className="h-10 bg-red-600 text-white hover:bg-red-700">
              {busy ? <Loader2 className="animate-spin" /> : <Trash2 />} Delete user
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
