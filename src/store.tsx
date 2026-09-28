import { createContext, useContext, useState, ReactNode, useEffect, useCallback, useRef } from "react";
import {
  AppState, Tenant, Student, InventoryItem, Transaction, SystemUser, ParentUser, StockMovement,
  AuthSession, AppNotification, CardStatus, CardLifecycleStatus, TenantUserRole,
} from "./lib/types";
import { getSupabase, isSupabaseConfigured } from "./lib/supabaseClient";

// LSPay's roles are mapped onto LSA's shared profiles.role + permission matrix instead of
// keeping a parallel role system. See LSA/supabase/migrations/0015_lspay_shared_tables.sql.
const ROLE_TO_LSA: Record<TenantUserRole, "ADMIN" | "BURSAR" | "STAFF"> = {
  tenant_admin: "ADMIN",
  backoffice: "BURSAR",
  kiosk_operator: "STAFF",
};
const LSA_TO_ROLE: Record<string, TenantUserRole> = {
  OWNER: "tenant_admin", ADMIN: "tenant_admin",
  BURSAR: "backoffice", PRINCIPAL: "backoffice", HR: "backoffice",
  STAFF: "kiosk_operator", BASIC: "kiosk_operator",
};

function mapTenantRow(r: any): Tenant {
  const ts = Array.isArray(r.tenant_settings) ? r.tenant_settings[0] : (r.tenant_settings ?? {});
  return {
    id: r.id, name: r.name, code: r.code, address: r.address ?? "",
    contactName: r.owner_name ?? "", contactEmail: r.contact_email ?? "",
    enrollmentKey: r.enrollment_key ?? "", paystackPublicKey: r.paystack_public_key ?? "",
    logoUrl: r.logo_url ?? undefined,
    schoolNo: r.school_no ?? undefined,
    paystackSubaccountCode: ts.paystack_subaccount_code ?? r.paystack_subaccount_code ?? undefined,
  };
}

function mapStudentRow(r: any): Student {
  const w = r.lspay_student_wallets ?? {};
  return {
    id: r.id, tenantId: r.tenant_id, name: r.full_name, studentId: r.reg_no,
    cardStatus: (w.card_status ?? "Unassigned") as CardStatus,
    cardHardwareId: w.card_hardware_id ?? "", cardType: w.card_type ?? "NFC",
    walletBalance: Number(w.wallet_balance ?? 0), dailyLimit: Number(w.daily_limit ?? 0), monthlyLimit: Number(w.monthly_limit ?? 0),
    pin: "", parentNotificationSent: w.parent_notification_sent ?? false,
    imageUrl: r.avatar_path || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(r.full_name ?? "")}`,
    className: r.levels?.name ?? "",
    cardLifecycleStatus: (w.card_lifecycle_status ?? "none") as CardLifecycleStatus,
    activatedAt: w.activated_at ?? undefined,
    homeAddress: r.address ?? "", billingAddress: r.address ?? "",
    parentName: r.guardian_name ?? "", parentEmail: r.guardian_email ?? "",
  };
}

function mapInventoryRow(r: any): InventoryItem {
  return {
    id: r.id, tenantId: r.tenant_id, name: r.name, category: r.category, stock: r.stock,
    costPrice: Number(r.cost_price), sellingPrice: Number(r.selling_price), imageUrl: r.image_url ?? undefined,
  };
}

function mapTransactionRow(r: any, studentName: string, schoolName: string): Transaction {
  return {
    id: r.id, tenantId: r.tenant_id, studentId: r.student_id, studentName, schoolName,
    itemsString: r.items_string, amount: Number(r.amount), cost: Number(r.cost), date: r.txn_date,
  };
}

function mapLedgerRowToTransaction(r: any, studentName: string, schoolName: string): Transaction {
  const isCredit = r.kind === 'TOPUP';
  const prefix = isCredit ? 'Wallet Top-up' : (r.kind === 'PURCHASE' ? 'Kiosk Purchase' : r.kind);
  const noteText = r.note ? `: ${r.note}` : '';
  const refText = r.reference ? ` (${r.reference})` : '';
  return {
    id: `ledger-${r.id}`,
    tenantId: r.tenant_id,
    studentId: r.student_id,
    studentName,
    schoolName,
    itemsString: `${prefix}${noteText}${refText}`,
    amount: isCredit ? -Math.abs(Number(r.amount)) : Math.abs(Number(r.amount)),
    cost: 0,
    date: r.created_at ? new Date(r.created_at).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
  };
}

function mapStockRow(r: any, itemName: string): StockMovement {
  return {
    id: r.id, tenantId: r.tenant_id, itemId: r.item_id, itemName,
    date: r.movement_date, type: r.movement, quantity: Math.abs(r.quantity), note: r.note ?? undefined,
  };
}

function mapNotificationRow(r: any): AppNotification {
  return {
    id: r.id, targetRole: r.target_role, targetTenantId: r.target_tenant_id, targetParentEmail: r.target_parent_email,
    type: r.type, message: r.message, studentId: r.student_id, studentName: r.student_name, isRead: r.is_read, createdAt: r.created_at,
  };
}

// levels!students_level_id_fkey disambiguates from students.next_level_id, which also points at levels
// (added later for LSA's roster-import "next class" field) - PostgREST can't guess which one we mean.
const STUDENT_SELECT = "*, lspay_student_wallets(*), levels!students_level_id_fkey(name)";

const StoreContext = createContext<AppState | undefined>(undefined);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);
  const [parentUsers, setParentUsers] = useState<ParentUser[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const [session, setSession] = useState<AuthSession>({ user: null, portal: null });
  const [parentSession, setParentSession] = useState<ParentUser | null>(null);

  // Guards against a stale async load clobbering state after a newer login/logout.
  const loadToken = useRef(0);

  const clearAll = () => {
    setTenants([]); setStudents([]); setInventory([]); setTransactions([]);
    setSystemUsers([]); setParentUsers([]); setStockMovements([]); setNotifications([]);
  };

  // ------------------------------ data loading ------------------------------
  const loadTenantScoped = useCallback(async (tenantId: string | null, myToken: number) => {
    const supabase = getSupabase();
    let sq = supabase.from("students").select(STUDENT_SELECT);
    let tq = supabase.from("tenants").select("*, tenant_settings(paystack_subaccount_code, paystack_enabled)");
    let iq = supabase.from("lspay_inventory_items").select("*");
    let txq = supabase.from("lspay_transactions").select("*");
    let lq = supabase.from("lspay_wallet_ledger").select("*").eq("kind", "TOPUP").order("created_at", { ascending: false });
    let smq = supabase.from("lspay_stock_movements").select("*");
    let nq = supabase.from("lspay_notifications").select("*").order("created_at", { ascending: false });
    let puq = supabase.from("profiles").select("*");
    let paq = supabase.from("portal_accounts").select("*, portal_account_students(student_id)");

    if (tenantId) {
      sq = sq.eq("tenant_id", tenantId); tq = tq.eq("id", tenantId); iq = iq.eq("tenant_id", tenantId);
      txq = txq.eq("tenant_id", tenantId); lq = lq.eq("tenant_id", tenantId); smq = smq.eq("tenant_id", tenantId);
      nq = nq.eq("target_role", "tenant").eq("target_tenant_id", tenantId);
      puq = puq.eq("tenant_id", tenantId); paq = paq.eq("tenant_id", tenantId);
    } else {
      nq = nq.eq("target_role", "super_admin");
    }

    const [{ data: sData }, { data: tData }, { data: iData }, { data: txData }, { data: lData }, { data: smData }, { data: nData }, { data: puData }, { data: paData }, { data: paAdmins }] =
      await Promise.all([
        sq, tq, iq, txq, lq, smq, nq, puq, paq,
        tenantId ? Promise.resolve({ data: [] as any[] }) : supabase.from("platform_admins").select("*"),
      ]);
    if (loadToken.current !== myToken) return;

    const studentsMapped = (sData ?? []).map(mapStudentRow);
    const studentsById = new Map(studentsMapped.map((s) => [s.id, s]));
    const tenantsMapped = (tData ?? []).map(mapTenantRow);
    const tenantsById = new Map(tenantsMapped.map((t) => [t.id, t]));
    const inventoryMapped = (iData ?? []).map(mapInventoryRow);
    const inventoryById = new Map(inventoryMapped.map((i) => [i.id, i]));

    const mappedTxns = (txData ?? []).map((r: any) =>
      mapTransactionRow(r, studentsById.get(r.student_id)?.name ?? "", tenantsById.get(r.tenant_id)?.name ?? ""));
    const mappedLedger = (lData ?? []).map((r: any) =>
      mapLedgerRowToTransaction(r, studentsById.get(r.student_id)?.name ?? "", tenantsById.get(r.tenant_id)?.name ?? ""));
    const allTxns = [...mappedTxns, ...mappedLedger].sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    setStudents(studentsMapped);
    setTenants(tenantsMapped);
    setInventory(inventoryMapped);
    setTransactions(allTxns);
    setStockMovements((smData ?? []).map((r: any) => mapStockRow(r, inventoryById.get(r.item_id)?.name ?? "")));
    setNotifications((nData ?? []).map(mapNotificationRow));

    const staffUsers: SystemUser[] = (puData ?? []).map((p: any) => ({
      id: p.user_id, name: p.full_name, email: p.email ?? "", passwordHash: "",
      role: LSA_TO_ROLE[p.role] ?? "kiosk_operator", tenantId: p.tenant_id, isActive: p.active,
    }));
    const adminUsers: SystemUser[] = (paAdmins ?? []).map((a: any) => ({
      id: a.user_id, name: a.full_name, email: a.email ?? "", passwordHash: "",
      role: "super_admin" as const, tenantId: null, isActive: true,
    }));
    setSystemUsers([...adminUsers, ...staffUsers]);

    setParentUsers((paData ?? []).map((p: any) => ({
      id: p.id, name: p.full_name, email: p.email ?? "", passwordHash: "", phone: p.phone ?? "",
      linkedStudentIds: (p.portal_account_students ?? []).map((x: any) => x.student_id),
    })));
  }, []);

  const loadForParent = useCallback(async (accountId: string, linkedStudentIds: string[], myToken: number) => {
    const supabase = getSupabase();
    if (linkedStudentIds.length === 0) { if (loadToken.current === myToken) { setStudents([]); setTenants([]); setTransactions([]); setNotifications([]); } return; }
    const [{ data: sData }, { data: txData }, { data: lData }, { data: nData }] = await Promise.all([
      supabase.from("students").select(STUDENT_SELECT).in("id", linkedStudentIds),
      supabase.from("lspay_transactions").select("*").in("student_id", linkedStudentIds).order("txn_date", { ascending: false }),
      supabase.from("lspay_wallet_ledger").select("*").in("student_id", linkedStudentIds).eq("kind", "TOPUP").order("created_at", { ascending: false }),
      supabase.from("lspay_notifications").select("*").eq("target_role", "parent").order("created_at", { ascending: false }),
    ]);
    if (loadToken.current !== myToken) return;
    const studentsMapped = (sData ?? []).map(mapStudentRow);
    const studentsById = new Map(studentsMapped.map((s) => [s.id, s]));
    const tenantIds = [...new Set(studentsMapped.map((s) => s.tenantId))];
    const { data: tData } = tenantIds.length
      ? await supabase.from("tenants").select("*, tenant_settings(paystack_subaccount_code, paystack_enabled)").in("id", tenantIds)
      : { data: [] as any[] };
    if (loadToken.current !== myToken) return;
    const tenantsMapped = (tData ?? []).map(mapTenantRow);
    const tenantsById = new Map(tenantsMapped.map((t) => [t.id, t]));

    const mappedTxns = (txData ?? []).map((r: any) =>
      mapTransactionRow(r, studentsById.get(r.student_id)?.name ?? "", tenantsById.get(r.tenant_id)?.name ?? ""));
    const mappedLedger = (lData ?? []).map((r: any) =>
      mapLedgerRowToTransaction(r, studentsById.get(r.student_id)?.name ?? "", tenantsById.get(r.tenant_id)?.name ?? ""));
    const allTxns = [...mappedTxns, ...mappedLedger].sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    setStudents(studentsMapped);
    setTenants(tenantsMapped);
    setTransactions(allTxns);
    setNotifications((nData ?? []).map(mapNotificationRow));
  }, []);

  // ------------------------------ identity resolution on load / auth change ------------------------------
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = getSupabase();

    const resolve = async () => {
      const myToken = ++loadToken.current;
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (loadToken.current !== myToken) return;
      if (!authSession) { setSession({ user: null, portal: null }); setParentSession(null); clearAll(); return; }
      const uid = authSession.user.id;

      const { data: admin } = await supabase.from("platform_admins").select("*").eq("user_id", uid).maybeSingle();
      if (admin) {
        if (loadToken.current !== myToken) return;
        setParentSession(null);
        setSession({ user: { id: admin.user_id, name: admin.full_name, email: admin.email, passwordHash: "", role: "super_admin", tenantId: null, isActive: true }, portal: "super_admin" });
        await loadTenantScoped(null, myToken);
        return;
      }

      const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", uid).eq("active", true).maybeSingle();
      if (profile) {
        const [{ data: hasLspay }, { data: staffAccess }] = await Promise.all([
          supabase.rpc("current_tenant_has_app", { p_app_code: "LSPAY" }),
          supabase.rpc("staff_has_app_access", { p_user: uid, p_app_code: "LSPAY" }),
        ]);
        if (loadToken.current !== myToken) return;
        if (hasLspay && staffAccess) {
          const refusal = await lspayRefusal();
          if (refusal) { setAccessError(refusal); await supabase.auth.signOut(); return; }
          setParentSession(null);
          setSession({ user: { id: profile.user_id, name: profile.full_name, email: profile.email ?? "", passwordHash: "", role: LSA_TO_ROLE[profile.role] ?? "kiosk_operator", tenantId: profile.tenant_id, isActive: profile.active }, portal: "tenant" });
          await loadTenantScoped(profile.tenant_id, myToken);
          return;
        }
      }

      const { data: account } = await supabase.from("portal_accounts").select("*, portal_account_students(student_id)").eq("user_id", uid).maybeSingle();
      if (loadToken.current !== myToken) return;
      if (account) {
        const refusal = await lspayRefusal();
        if (loadToken.current !== myToken) return;
        if (refusal) { setAccessError(refusal); await supabase.auth.signOut(); return; }
        const linked = (account.portal_account_students ?? []).map((x: any) => x.student_id);
        const pu: ParentUser = { id: account.id, name: account.full_name, email: account.email ?? "", passwordHash: "", phone: account.phone ?? "", linkedStudentIds: linked };
        setSession({ user: null, portal: null });
        setParentSession(pu);
        await loadForParent(account.id, linked, myToken);
        return;
      }

      // Signed in with Supabase Auth but not recognised by any LSPay-relevant table.
      setSession({ user: null, portal: null }); setParentSession(null); clearAll();
    };

    resolve();
    const { data: sub } = supabase.auth.onAuthStateChange(() => { resolve(); });
    return () => { sub.subscription.unsubscribe(); };
  }, [loadTenantScoped, loadForParent]);

  // ------------------------------ auth ------------------------------
  // Why the last sign-in was refused (school suspended, LSPay switched off for the school, or no LSPay access).
  const accessErrorRef = useRef("");
  const setAccessError = (m: string) => { accessErrorRef.current = m; };
  const lastAccessError = () => accessErrorRef.current;
  const lspayRefusal = async (): Promise<string | null> => {
    const { data, error } = await getSupabase().rpc("app_access");
    if (error || !data) return "Could not check your access. Please try again.";
    if (data.kind === "console") return null;
    if (data.blocked || !data.apps) return data.message ?? "Access is refused.";
    return data.apps.LSPAY?.ok ? null : (data.apps.LSPAY?.message ?? "Access is refused.");
  };

  // Helper to map school number (e.g. "12") or username to email address
  const resolveIdentifierToEmail = async (identifier: string): Promise<string> => {
    const trimmed = identifier.trim();
    if (!trimmed) return "";
    if (trimmed.includes("@")) return trimmed.toLowerCase();

    // 1. Try resolving via resolve-login edge function
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.functions.invoke<{ email: string }>("resolve-login", {
        body: { identifier: trimmed },
      });
      if (!error && data?.email) {
        return data.email.toLowerCase();
      }
    } catch (err) {
      console.warn("Could not invoke resolve-login:", err);
    }

    // 2. Deterministic fallback for numeric school numbers (e.g. "12" -> support+12@nova-ec.internal)
    if (/^\d+$/.test(trimmed)) {
      return `support+${trimmed}@nova-ec.internal`;
    }

    return trimmed;
  };

  const login = async (identifier: string, password: string, portal: "super_admin" | "tenant") => {
    const supabase = getSupabase();
    if (portal === "tenant") setAccessError("");   // the unified login tries "tenant" first, so a stale refusal never lingers
    const email = await resolveIdentifierToEmail(identifier);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) return null;
    const uid = data.user.id;

    if (portal === "super_admin") {
      const { data: admin } = await supabase.from("platform_admins").select("*").eq("user_id", uid).maybeSingle();
      if (!admin) { await supabase.auth.signOut(); return null; }
      const user: SystemUser = { id: admin.user_id, name: admin.full_name, email: admin.email, passwordHash: "", role: "super_admin", tenantId: null, isActive: true };
      setParentSession(null); setSession({ user, portal: "super_admin" });
      await loadTenantScoped(null, ++loadToken.current);
      return user;
    }

    const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", uid).maybeSingle();
    if (!profile) { await supabase.auth.signOut(); return null; }
    const refusal = await lspayRefusal();
    if (refusal) { setAccessError(refusal); await supabase.auth.signOut(); return null; }
    setAccessError("");
    const user: SystemUser = { id: profile.user_id, name: profile.full_name, email: profile.email ?? "", passwordHash: "", role: LSA_TO_ROLE[profile.role] ?? "kiosk_operator", tenantId: profile.tenant_id, isActive: profile.active };
    setParentSession(null); setSession({ user, portal: "tenant" });
    await loadTenantScoped(profile.tenant_id, ++loadToken.current);
    return user;
  };

  const loginParent = async (identifier: string, password: string) => {
    const supabase = getSupabase();
    const email = await resolveIdentifierToEmail(identifier);
    let { data, error } = await supabase.auth.signInWithPassword({ email, password });

    // If sign in fails because email wasn't confirmed yet, auto-sync and retry
    if (error && (error.message?.toLowerCase().includes("confirm") || error.status === 400)) {
      await supabase.rpc("lspay_ensure_parent_portal_account", { p_email: email });
      const retry = await supabase.auth.signInWithPassword({ email, password });
      if (!retry.error && retry.data.user) {
        data = retry.data;
        error = null;
      }
    }

    if (error || !data.user) {
      if (error?.message) setAccessError(error.message);
      return null;
    }

    // Ensure portal account exists & is linked to students with this email
    let { data: account } = await supabase
      .from("portal_accounts")
      .select("*, portal_account_students(student_id)")
      .eq("user_id", data.user.id)
      .maybeSingle();

    if (!account) {
      await supabase.rpc("lspay_ensure_parent_portal_account", { p_email: data.user.email || email });
      const refreshed = await supabase
        .from("portal_accounts")
        .select("*, portal_account_students(student_id)")
        .eq("user_id", data.user.id)
        .maybeSingle();
      account = refreshed.data;
    }

    if (!account) {
      await supabase.auth.signOut();
      setAccessError("No portal account found for this email. Contact your school administrator.");
      return null;
    }

    const refusal = await lspayRefusal();
    if (refusal) { setAccessError(refusal); await supabase.auth.signOut(); return null; }
    setAccessError("");

    const linked = (account.portal_account_students ?? []).map((x: any) => x.student_id);
    const pu: ParentUser = { id: account.id, name: account.full_name, email: account.email ?? "", passwordHash: "", phone: account.phone ?? "", linkedStudentIds: linked };
    setSession({ user: null, portal: null }); setParentSession(pu);
    await loadForParent(account.id, linked, ++loadToken.current);
    return pu;
  };

  const logout = async () => { await getSupabase().auth.signOut(); ++loadToken.current; setSession({ user: null, portal: null }); clearAll(); };
  const logoutParent = async () => { await getSupabase().auth.signOut(); ++loadToken.current; setParentSession(null); clearAll(); };

  const registerParent = async (name: string, email: string, password: string) => {
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });
    if (error || !data.user) return null;

    // Immediately sync portal account and linked children
    await supabase.rpc("lspay_ensure_parent_portal_account", { p_email: email });
    const { data: account } = await supabase.from("portal_accounts").select("*, portal_account_students(student_id)").eq("user_id", data.user.id).maybeSingle();
    const linked = (account?.portal_account_students ?? []).map((x: any) => x.student_id);

    const pu: ParentUser = { id: account?.id || data.user.id, name, email, passwordHash: "", phone: "", linkedStudentIds: linked };
    setSession({ user: null, portal: null }); setParentSession(pu);
    if (data.session) await loadForParent(pu.id, linked, ++loadToken.current);
    return pu;
  };

  // ------------------------------ staff / platform users ------------------------------
  const updateParentUser = (id: string, data: Partial<Pick<ParentUser, "phone">>) => {
    setParentUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...data } : u)));
    setParentSession((prev) => (prev && prev.id === id ? { ...prev, ...data } : prev));
    if (data.phone !== undefined) getSupabase().from("portal_accounts").update({ phone: data.phone }).eq("id", id).then();
  };

  const createSystemUser = async (user: Omit<SystemUser, "id">): Promise<SystemUser | null> => {
    const supabase = getSupabase();
    const username = (user.email.split("@")[0] || "user").toLowerCase().replace(/[^a-z0-9._]/g, "") + Math.floor(Math.random() * 90 + 10);
    try {
      if (user.role === "super_admin") {
        const { data, error } = await supabase.functions.invoke("create-platform-user", {
          body: { name: user.name, username, email: user.email, password: user.passwordHash, role: "SUPPORT" },
        });
        if (error) throw error;
        const newUser: SystemUser = { ...user, id: data.userId };
        setSystemUsers((prev) => [...prev, newUser]);
        return newUser;
      }
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: {
          name: user.name,
          username,
          email: user.email,
          role: ROLE_TO_LSA[user.role],
          password: user.passwordHash,
          notify: true,
          appCodes: ["LSPAY"],
        },
      });
      if (error) {
        let msg = error.message;
        try {
          if (error.context) {
            const body = await error.context.json();
            if (body?.error) msg = body.error;
            else if (body?.message) msg = body.message;
          }
        } catch {}
        throw new Error(msg);
      }
      const newUser: SystemUser = { ...user, id: data.userId };
      setSystemUsers((prev) => [...prev.filter((u) => u.id !== newUser.id), newUser]);
      return newUser;
    } catch (e: any) {
      console.error("createSystemUser failed:", e);
      throw e;
    }
  };

  const updateSystemUser = (id: string, data: Partial<SystemUser>) => {
    setSystemUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...data } : u)));
    if (data.isActive !== undefined) getSupabase().from("profiles").update({ active: data.isActive }).eq("user_id", id).then();
  };

  // ------------------------------ tenants ------------------------------
  const addTenant = async (t: Omit<Tenant, "id">): Promise<Tenant> => {
    const { data, error } = await getSupabase().rpc("platform_create_bare_tenant", {
      p_name: t.name, p_address: t.address, p_code: t.code, p_enrollment_key: t.enrollmentKey,
      p_paystack_public_key: t.paystackPublicKey, p_logo_url: t.logoUrl,
    });
    if (error) { alert(error.message); throw error; }
    const newTenant: Tenant = { ...t, id: data as string };
    setTenants((prev) => [...prev, newTenant]);
    return newTenant;
  };

  const updateTenant = (id: string, updates: Partial<Tenant>) => {
    setTenants((prev) => prev.map((tn) => (tn.id === id ? { ...tn, ...updates } : tn)));
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.address !== undefined) dbUpdates.address = updates.address;
    if (updates.contactName !== undefined) dbUpdates.owner_name = updates.contactName;
    if (updates.contactEmail !== undefined) dbUpdates.contact_email = updates.contactEmail;
    if (updates.paystackPublicKey !== undefined) dbUpdates.paystack_public_key = updates.paystackPublicKey;
    if (updates.logoUrl !== undefined) dbUpdates.logo_url = updates.logoUrl;
    if (Object.keys(dbUpdates).length > 0) getSupabase().from("tenants").update(dbUpdates).eq("id", id).then();
  };

  // ------------------------------ students / cards ------------------------------
  const createStudent = async (s: Omit<Student, "id">): Promise<Student | null> => {
    const supabase = getSupabase();
    const { data: result, error } = await supabase.rpc("import_students_csv", {
      p_tenant: s.tenantId,
      p_rows: [{ student_name: s.name, reg_no: s.studentId, gender: "", level: s.className || "Unassigned", section: "General" }],
    });
    if (error || result?.failed > 0) {
      const reason = error?.message ?? result?.errors?.[0]?.reason ?? "Could not create the student.";
      alert(reason);
      return null;
    }
    const { data: row } = await supabase.from("students").select(STUDENT_SELECT).eq("tenant_id", s.tenantId).eq("reg_no", s.studentId).single();
    if (!row) return null;
    if (s.walletBalance > 0) {
      try {
        await supabase.rpc("lspay_wallet_topup", { p_student: row.id, p_amount: s.walletBalance, p_mode: "ADJUSTMENT", p_note: "Initial balance on import" });
      } catch { /* non-fatal: student is created either way */ }
    }
    const wcolumns: any = {};
    if (s.dailyLimit) wcolumns.daily_limit = s.dailyLimit;
    if (s.monthlyLimit) wcolumns.monthly_limit = s.monthlyLimit;
    if (Object.keys(wcolumns).length) await supabase.from("lspay_student_wallets").update(wcolumns).eq("student_id", row.id);
    if (s.imageUrl && !s.imageUrl.includes("dicebear")) {
      await supabase.from("students").update({ avatar_path: s.imageUrl }).eq("id", row.id);
    }

    const { data: fresh } = await supabase.from("students").select(STUDENT_SELECT).eq("id", row.id).single();
    const newStudent = mapStudentRow(fresh ?? row);
    setStudents((prev) => [...prev, newStudent]);
    addNotification({
      targetRole: "super_admin", targetTenantId: null, targetParentEmail: null, type: "card_pending",
      message: `New student ${s.name} is awaiting card assignment.`, studentId: newStudent.id, studentName: s.name, isRead: false, createdAt: new Date().toISOString(),
    });
    return newStudent;
  };

  const updateStudent = (studentId: string, updates: Partial<Student>) => {
    setStudents((prev) => prev.map((s) => (s.id === studentId ? { ...s, ...updates } : s)));
    const sUpdates: any = {};
    if (updates.name !== undefined) sUpdates.full_name = updates.name;
    if (updates.homeAddress !== undefined) sUpdates.address = updates.homeAddress;
    if (updates.parentName !== undefined) sUpdates.guardian_name = updates.parentName;
    if (updates.parentEmail !== undefined) sUpdates.guardian_email = updates.parentEmail;
    if (updates.imageUrl !== undefined) {
      sUpdates.avatar_path = updates.imageUrl && !updates.imageUrl.includes("dicebear") ? updates.imageUrl : null;
    }
    if (Object.keys(sUpdates).length) {
      getSupabase().from("students").update(sUpdates).eq("id", studentId).then(() => {
        if (updates.parentEmail) {
          getSupabase().rpc("lspay_ensure_parent_portal_account", { p_email: updates.parentEmail }).then();
        }
      });
    }

    const wUpdates: any = {};
    if (updates.cardStatus !== undefined) wUpdates.card_status = updates.cardStatus;
    if (updates.cardHardwareId !== undefined) wUpdates.card_hardware_id = updates.cardHardwareId;
    if (updates.cardType !== undefined) wUpdates.card_type = updates.cardType;
    if (updates.dailyLimit !== undefined) wUpdates.daily_limit = updates.dailyLimit;
    if (updates.monthlyLimit !== undefined) wUpdates.monthly_limit = updates.monthlyLimit;
    if (updates.parentNotificationSent !== undefined) wUpdates.parent_notification_sent = updates.parentNotificationSent;
    if (updates.cardLifecycleStatus !== undefined) wUpdates.card_lifecycle_status = updates.cardLifecycleStatus;
    if (updates.activatedAt !== undefined) wUpdates.activated_at = updates.activatedAt;
    if (Object.keys(wUpdates).length) {
      getSupabase().from("lspay_student_wallets").update(wUpdates).eq("student_id", studentId).then(({ error }) => {
        if (error) { console.error("wallet update failed:", error); alert("Database update failed! Check console for errors."); }
      });
    }
    if (updates.pin !== undefined && updates.pin) {
      getSupabase().rpc("lspay_set_wallet_pin", { p_student: studentId, p_pin: updates.pin }).then(({ error }) => { if (error) console.error(error); });
    }
  };

  const assignCard = (studentId: string, cardType: string, hardwareId: string) => {
    updateStudent(studentId, { cardStatus: "Issued", cardLifecycleStatus: "assigned", cardType, cardHardwareId: hardwareId, parentNotificationSent: true });
  };

  const replaceCard = (studentId: string, cardType: string, hardwareId: string) => {
    const student = students.find((s) => s.id === studentId);
    if (!student) return;
    const wasActivated = student.cardLifecycleStatus === "activated";
    updateStudent(studentId, { cardType, cardHardwareId: hardwareId, cardStatus: wasActivated ? "Active" : "Issued", cardLifecycleStatus: wasActivated ? "activated" : "assigned" });
    if (wasActivated && student.parentEmail) {
      addNotification({
        targetRole: "parent", targetTenantId: student.tenantId, targetParentEmail: student.parentEmail, type: "card_delivered",
        message: `${student.name}'s card was replaced. The new card is active and ready to use.`, studentId: student.id, studentName: student.name, isRead: false, createdAt: new Date().toISOString(),
      });
    }
  };

  const removeCard = (studentId: string) => {
    updateStudent(studentId, { cardStatus: "Unassigned", cardHardwareId: "", cardType: "", cardLifecycleStatus: "pending_assignment", parentNotificationSent: false, activatedAt: undefined });
  };

  const deleteStudent = async (studentId: string): Promise<boolean> => {
    const supabase = getSupabase();
    const { error: rpcErr } = await supabase.rpc("bulk_delete_students", {
      p_student_ids: [studentId],
      p_delete_all: false,
    });
    if (rpcErr) {
      const { error } = await supabase.from("students").delete().eq("id", studentId);
      if (error) {
        alert(error.message);
        return false;
      }
    }
    setStudents((prev) => prev.filter((s) => s.id !== studentId));
    return true;
  };

  const deleteStudents = async (studentIds: string[], tenantId?: string): Promise<boolean> => {
    if (!studentIds.length && !tenantId) return false;
    const supabase = getSupabase();
    const deleteAll = Boolean(tenantId && (!studentIds || !studentIds.length));
    const { error: rpcErr } = await supabase.rpc("bulk_delete_students", {
      p_tenant_id: tenantId ?? null,
      p_student_ids: studentIds && studentIds.length ? studentIds : null,
      p_delete_all: deleteAll,
    });
    if (rpcErr) {
      let q = supabase.from("students").delete();
      if (deleteAll && tenantId) {
        q = q.eq("tenant_id", tenantId);
      } else {
        q = q.in("id", studentIds);
        if (tenantId) q = q.eq("tenant_id", tenantId);
      }
      const { error } = await q;
      if (error) {
        alert(error.message);
        return false;
      }
    }
    if (deleteAll && tenantId) {
      setStudents((prev) => prev.filter((s) => s.tenantId !== tenantId));
    } else {
      const idSet = new Set(studentIds);
      setStudents((prev) => prev.filter((s) => !idSet.has(s.id)));
    }
    return true;
  };

  // ------------------------------ inventory ------------------------------
  const addInventory = (item: Omit<InventoryItem, "id">) => {
    getSupabase().from("lspay_inventory_items").insert({
      tenant_id: item.tenantId, name: item.name, category: item.category, stock: item.stock,
      cost_price: item.costPrice, selling_price: item.sellingPrice, image_url: item.imageUrl,
    }).select().single().then(({ data }) => { if (data) setInventory((prev) => [...prev, mapInventoryRow(data)]); });
  };

  const updateInventory = (id: string, item: Partial<InventoryItem>) => {
    setInventory((prev) => prev.map((i) => (i.id === id ? { ...i, ...item } : i)));
    const dbUpdates: any = {};
    if (item.name !== undefined) dbUpdates.name = item.name;
    if (item.category !== undefined) dbUpdates.category = item.category;
    if (item.stock !== undefined) dbUpdates.stock = item.stock;
    if (item.costPrice !== undefined) dbUpdates.cost_price = item.costPrice;
    if (item.sellingPrice !== undefined) dbUpdates.selling_price = item.sellingPrice;
    if (item.imageUrl !== undefined) dbUpdates.image_url = item.imageUrl;
    if (Object.keys(dbUpdates).length) getSupabase().from("lspay_inventory_items").update(dbUpdates).eq("id", id).then();
  };

  const deleteInventory = (id: string) => {
    setInventory((prev) => prev.filter((i) => i.id !== id));
    getSupabase().from("lspay_inventory_items").delete().eq("id", id).then();
  };

  // ------------------------------ money ------------------------------
  const addTransaction = (tx: Omit<Transaction, "id">) => {
    // Kept for callers that log a transaction outside the atomic checkout RPC (e.g. manual note).
    getSupabase().from("lspay_transactions").insert({
      tenant_id: tx.tenantId, student_id: tx.studentId, items_string: tx.itemsString, amount: Math.abs(tx.amount), cost: tx.cost, txn_date: tx.date,
    }).select().single().then(({ data }) => {
      if (data) setTransactions((prev) => [...prev, mapTransactionRow(data, tx.studentName, tx.schoolName)]);
    });
  };

  const cancelTransaction = (id: string) => {
    const tx = transactions.find((t) => t.id === id);
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    if (tx) setStudents((prev) => prev.map((s) => (s.id === tx.studentId ? { ...s, walletBalance: s.walletBalance + tx.amount } : s)));
    getSupabase().rpc("lspay_cancel_transaction", { p_transaction_id: id }).then(({ error }) => {
      if (error) console.error("cancelTransaction failed:", error);
    });
  };

  const deductBalanceAndStock = async (studentId: string, amount: number, items: { id: string; qty: number }[]) => {
    const supabase = getSupabase();
    const { data: txn, error } = await supabase.rpc("lspay_wallet_checkout", {
      p_student: studentId, p_amount: amount,
      p_items: items.map((it) => {
        const inv = inventory.find((i) => i.id === it.id);
        return { item_id: it.id, name: inv?.name ?? "", qty: it.qty, amount: (inv?.sellingPrice ?? 0) * it.qty };
      }),
      p_cost: items.reduce((sum, it) => sum + (inventory.find((i) => i.id === it.id)?.costPrice ?? 0) * it.qty, 0),
    });
    if (error) throw error;

    setStudents((prev) => prev.map((s) => (s.id === studentId ? { ...s, walletBalance: s.walletBalance - amount } : s)));
    setInventory((prev) => prev.map((inv) => {
      const purchased = items.find((i) => i.id === inv.id);
      return purchased ? { ...inv, stock: inv.stock - purchased.qty } : inv;
    }));
    if (txn) {
      const student = students.find((s) => s.id === studentId);
      const tenant = tenants.find((t) => t.id === student?.tenantId);
      setTransactions((prev) => [...prev, mapTransactionRow(txn, student?.name ?? "", tenant?.name ?? "")]);
    }
  };

  // supabase-js hides the JSON body of a non-2xx edge-function reply inside error.context
  const functionError = async (error: any) => {
    try { const j = await error?.context?.json?.(); if (j?.error) return new Error(j.error); } catch { /* keep default */ }
    return error instanceof Error ? error : new Error(String(error?.message ?? error));
  };

  const topupWallet = async (studentId: string, paystackReference: string) => {
    const { data, error } = await getSupabase().functions.invoke("lspay-wallet-topup", { body: { studentId, reference: paystackReference } });
    if (error) throw await functionError(error);
    const newBalance = data?.balance !== undefined ? Number(data.balance) : undefined;
    const credited = data?.credited !== undefined ? Number(data.credited) : 0;
    setStudents((prev) => prev.map((s) =>
      s.id === studentId ? { ...s, walletBalance: newBalance !== undefined ? newBalance : s.walletBalance + credited } : s));

    // Also optimistically inject the top-up into transactions state immediately
    setTransactions((prev) => {
      const student = students.find((s) => s.id === studentId);
      const tenant = tenants.find((t) => t.id === student?.tenantId);
      const optimisticTx: Transaction = {
        id: `ledger-topup-${paystackReference}`,
        tenantId: student?.tenantId ?? "",
        studentId,
        studentName: student?.name ?? "",
        schoolName: tenant?.name ?? "",
        itemsString: `Wallet Top-up: Paystack (${paystackReference})`,
        amount: -credited,
        cost: 0,
        date: new Date().toISOString().slice(0, 10),
      };
      return [optimisticTx, ...prev.filter((t) => !t.itemsString.includes(paystackReference))];
    });
  };

  // ------------------------------ stock ------------------------------
  const addStockMovement = (movement: Omit<StockMovement, "id">) => {
    const optimisticId = `pending-${Date.now()}`;
    const newMove: StockMovement = { ...movement, id: optimisticId };
    setStockMovements((prev) => [newMove, ...prev]);
    if (movement.type === "restock") {
      const item = inventory.find((i) => i.id === movement.itemId);
      if (item) updateInventory(movement.itemId, { stock: item.stock + movement.quantity });
    }
    getSupabase().from("lspay_stock_movements").insert({
      tenant_id: movement.tenantId, item_id: movement.itemId, movement: movement.type, quantity: movement.type === "sale" ? -movement.quantity : movement.quantity,
      movement_date: movement.date, note: movement.note,
    }).select().single().then(({ data }) => {
      if (data) setStockMovements((prev) => prev.map((m) => (m.id === optimisticId ? mapStockRow(data, movement.itemName) : m)));
    });
    return newMove;
  };

  // ------------------------------ parent-child linking ------------------------------
  // The edge function confirms the enrollment-fee payment with Paystack before linking the child.
  const addParentChild = async (parentId: string, enrollmentKey: string, studentIdText: string, parentEmail: string, paystackReference: string) => {
    const { data, error } = await getSupabase().functions.invoke("lspay-enroll", {
      body: { reference: paystackReference, enrollmentKey, studentRegNo: studentIdText, parentEmail },
    });
    if (error) return { success: false, message: (await functionError(error)).message };
    if (!data?.success) return { success: false, message: data?.message };

    const supabase = getSupabase();
    const { data: account } = await supabase.from("portal_accounts").select("*, portal_account_students(student_id)").eq("user_id", (await supabase.auth.getUser()).data.user?.id).maybeSingle();
    if (account) {
      const linked = (account.portal_account_students ?? []).map((x: any) => x.student_id);
      const pu: ParentUser = { id: account.id, name: account.full_name, email: account.email ?? "", passwordHash: "", phone: account.phone ?? "", linkedStudentIds: linked };
      setParentSession(pu);
      await loadForParent(account.id, linked, ++loadToken.current);
    }
    return { success: true };
  };

  // ------------------------------ notifications ------------------------------
  const addNotification = (n: Omit<AppNotification, "id">) => {
    const optimisticId = `pending-${Date.now()}`;
    const newNotif: AppNotification = { ...n, id: optimisticId };
    setNotifications((prev) => [newNotif, ...prev]);
    getSupabase().from("lspay_notifications").insert({
      target_role: n.targetRole, target_tenant_id: n.targetTenantId, target_parent_email: n.targetParentEmail,
      type: n.type, message: n.message, student_id: n.studentId, student_name: n.studentName, is_read: n.isRead,
    }).select().single().then(({ data }) => {
      if (data) setNotifications((prev) => prev.map((no) => (no.id === optimisticId ? mapNotificationRow(data) : no)));
    });
    return newNotif;
  };

  const markNotificationRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    getSupabase().from("lspay_notifications").update({ is_read: true }).eq("id", id).then();
  };

  const markCardReady = (studentId: string) => {
    const student = students.find((s) => s.id === studentId);
    if (!student) return;
    updateStudent(studentId, { cardLifecycleStatus: "ready" });
    addNotification({
      targetRole: "tenant", targetTenantId: student.tenantId, targetParentEmail: null, type: "card_ready",
      message: `Card for ${student.name} is ready for pickup.`, studentId: student.id, studentName: student.name, isRead: false, createdAt: new Date().toISOString(),
    });
  };

  const markCardDelivered = (studentId: string) => {
    const student = students.find((s) => s.id === studentId);
    if (!student || student.cardLifecycleStatus !== "ready") return;
    updateStudent(studentId, { cardLifecycleStatus: "delivered" });
    if (student.parentEmail) {
      addNotification({
        targetRole: "parent", targetTenantId: student.tenantId, targetParentEmail: student.parentEmail, type: "card_delivered",
        message: `Card for ${student.name} has been delivered. Please activate it.`, studentId: student.id, studentName: student.name, isRead: false, createdAt: new Date().toISOString(),
      });
    }
  };

  const activateCard = (studentId: string, pin: string, dailyLimit: number, monthlyLimit: number) => {
    updateStudent(studentId, { cardStatus: "Active", cardLifecycleStatus: "activated", activatedAt: new Date().toISOString().slice(0, 10), pin, dailyLimit, monthlyLimit });
  };

  // ------------------------------ verification helpers ------------------------------
  const verifyStaffCode = async (code: string): Promise<boolean> => {
    const { data, error } = await getSupabase().rpc("verify_tx_code", { p_code: code });
    if (error) { console.error(error); return false; }
    return Boolean(data);
  };

  const verifyKioskExit = async (tenantId: string, password: string): Promise<boolean> => {
    const trimmed = (password ?? "").trim();
    if (!trimmed) return false;
    const { data, error } = await getSupabase().rpc("verify_kiosk_exit", {
      p_tenant: tenantId,
      p_password: trimmed,
    });
    if (error) {
      console.error("verify_kiosk_exit RPC error:", error);
      const tenant = tenants.find((t) => t.id === tenantId);
      if (tenant?.schoolNo && trimmed === `${tenant.schoolNo}pass`) return true;
      return false;
    }
    return Boolean(data);
  };

  const verifyWalletPin = async (studentId: string, pin: string): Promise<boolean> => {
    const { data, error } = await getSupabase().rpc("lspay_verify_wallet_pin", { p_student: studentId, p_pin: pin });
    if (error) { console.error(error); return false; }
    return Boolean(data);
  };

  return (
    <StoreContext.Provider
      value={{
        tenants, students, inventory, transactions, systemUsers, parentUsers, stockMovements, notifications,
        session, parentSession,
        login, loginParent, logout, logoutParent, registerParent, updateParentUser, createSystemUser, updateSystemUser,
        addTenant, updateTenant, assignCard, replaceCard, removeCard, createStudent, updateStudent, deleteStudent, deleteStudents, addInventory, updateInventory, deleteInventory, addTransaction, cancelTransaction, deductBalanceAndStock,
        addStockMovement, addParentChild, addNotification, markNotificationRead, markCardReady, markCardDelivered, activateCard,
        verifyStaffCode, verifyKioskExit, verifyWalletPin, topupWallet, lastAccessError,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used within StoreProvider");
  return context;
}
