import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { AppState, Tenant, Student, InventoryItem, Transaction, SystemUser, ParentUser, StockMovement, AuthSession, AppNotification } from "./lib/types";
import { getSupabase, isSupabaseConfigured } from "./lib/supabaseClient";

const initialTenants: Tenant[] = [
  { id: 1, name: "Greenwood Academy", code: "GRE", address: "12 Oak Lane, London", contactName: "Sarah Mitchell", contactEmail: "sarah@greenwood.edu", enrollmentKey: "SCH-GRE-2026", paystackPublicKey: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || "" },
  { id: 2, name: "Riverside Primary", code: "RIV", address: "45 Thames St, Oxford", contactName: "Lisa Chen", contactEmail: "lisa@riverside.edu", enrollmentKey: "SCH-RIV-2026", paystackPublicKey: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || "" }
];

const initialStudents: Student[] = [
  { id: 1, tenantId: 1, name: "Emma Johnson", studentId: "STU-001", cardStatus: "Active", cardHardwareId: "NFC-9982", cardType: "NFC", walletBalance: 45.50, dailyLimit: 10, monthlyLimit: 150, pin: "1234", parentNotificationSent: true, className: "Year 9B", homeAddress: "5 Elm Road, London", billingAddress: "5 Elm Road, London", parentName: "Helen Johnson", parentEmail: "helen@family.com", imageUrl: "https://api.dicebear.com/7.x/initials/svg?seed=Emma Johnson", cardLifecycleStatus: 'activated', activatedAt: '2026-06-02' },
  { id: 2, tenantId: 1, name: "Oliver Smith", studentId: "STU-002", cardStatus: "Issued", cardHardwareId: "QR-REF771", cardType: "QR", walletBalance: 20.00, dailyLimit: 8, monthlyLimit: 100, pin: "", parentNotificationSent: true, className: "Year 8A", homeAddress: "12 Oak St, London", billingAddress: "12 Oak St, London", parentName: "Carol Smith", parentEmail: "carol@smith.com", imageUrl: "https://api.dicebear.com/7.x/initials/svg?seed=Oliver Smith", cardLifecycleStatus: 'ready' },
  { id: 3, tenantId: 1, name: "Sophia Brown", studentId: "STU-003", cardStatus: "Unassigned", cardHardwareId: "", cardType: "NFC", walletBalance: 0, dailyLimit: 10, monthlyLimit: 100, pin: "", parentNotificationSent: false, className: "Year 7C", homeAddress: "8 Pine Ave, London", billingAddress: "8 Pine Ave, London", parentName: "David Brown", parentEmail: "david@brown.com", imageUrl: "https://api.dicebear.com/7.x/initials/svg?seed=Sophia Brown", cardLifecycleStatus: 'pending_assignment' },
  { id: 4, tenantId: 2, name: "Liam Davis", studentId: "STU-101", cardStatus: "Active", cardHardwareId: "NFC-4421", cardType: "NFC", walletBalance: 32.00, dailyLimit: 12, monthlyLimit: 200, pin: "4567", parentNotificationSent: false, className: "Year 6B", homeAddress: "22 River Lane, Oxford", billingAddress: "22 River Lane, Oxford", parentName: "Robert Davis", parentEmail: "robert@family.com", imageUrl: "https://api.dicebear.com/7.x/initials/svg?seed=Liam Davis", cardLifecycleStatus: 'activated', activatedAt: '2026-05-20' },
  { id: 5, tenantId: 2, name: "Isabella Wilson", studentId: "STU-102", cardStatus: "Blocked", cardHardwareId: "NFC-7733", cardType: "NFC", walletBalance: 15.00, dailyLimit: 10, monthlyLimit: 150, pin: "9876", parentNotificationSent: false, className: "Year 5A", homeAddress: "33 Riverside Dr, Oxford", billingAddress: "33 Riverside Dr, Oxford", parentName: "Maria Wilson", parentEmail: "maria@wilson.com", imageUrl: "https://api.dicebear.com/7.x/initials/svg?seed=Isabella Wilson", cardLifecycleStatus: 'activated', activatedAt: '2026-06-09' }
];

const initialInventory: InventoryItem[] = [
  { id: 1, tenantId: 1, name: "Grilled Chicken & Rice", category: "Mains", stock: 50, costPrice: 1.80, sellingPrice: 3.50, imageUrl: "https://placehold.co/300x200/1e293b/94a3b8?text=Chicken+%26+Rice" },
  { id: 2, tenantId: 1, name: "Margherita Pizza Slice", category: "Mains", stock: 30, costPrice: 1.20, sellingPrice: 2.75, imageUrl: "https://placehold.co/300x200/1e293b/94a3b8?text=Pizza" },
  { id: 3, tenantId: 1, name: "Cheese & Tomato Wrap", category: "Snacks", stock: 40, costPrice: 0.80, sellingPrice: 1.80, imageUrl: "https://placehold.co/300x200/1e293b/94a3b8?text=Wrap" },
  { id: 4, tenantId: 1, name: "Chocolate Brownie", category: "Snacks", stock: 60, costPrice: 0.40, sellingPrice: 1.20, imageUrl: "https://placehold.co/300x200/1e293b/94a3b8?text=Brownie" },
  { id: 5, tenantId: 1, name: "Orange Juice 330ml", category: "Drinks", stock: 80, costPrice: 0.30, sellingPrice: 1.00, imageUrl: "https://placehold.co/300x200/1e293b/94a3b8?text=OJ" },
  { id: 6, tenantId: 1, name: "Sparkling Water 500ml", category: "Drinks", stock: 100, costPrice: 0.20, sellingPrice: 0.75, imageUrl: "https://placehold.co/300x200/1e293b/94a3b8?text=Water" },
  { id: 7, tenantId: 2, name: "Fish & Chips", category: "Mains", stock: 35, costPrice: 2.00, sellingPrice: 4.00, imageUrl: "https://placehold.co/300x200/1e293b/94a3b8?text=Fish+%26+Chips" },
  { id: 8, tenantId: 2, name: "Veggie Burger", category: "Mains", stock: 25, costPrice: 1.50, sellingPrice: 3.25, imageUrl: "https://placehold.co/300x200/1e293b/94a3b8?text=Veggie+Burger" },
  { id: 9, tenantId: 2, name: "Apple", category: "Snacks", stock: 120, costPrice: 0.15, sellingPrice: 0.50, imageUrl: "https://placehold.co/300x200/1e293b/94a3b8?text=Apple" },
  { id: 10, tenantId: 2, name: "Ribena Carton", category: "Drinks", stock: 90, costPrice: 0.25, sellingPrice: 0.80, imageUrl: "https://placehold.co/300x200/1e293b/94a3b8?text=Ribena" }
];

const initialTransactions: Transaction[] = [
  { id: 1, tenantId: 1, studentId: 1, studentName: "Emma Johnson", schoolName: "Greenwood Academy", itemsString: "Grilled Chicken & Rice x1, Orange Juice 330ml x1", amount: 4.50, cost: 2.10, date: "2026-06-08" },
  { id: 2, tenantId: 1, studentId: 1, studentName: "Emma Johnson", schoolName: "Greenwood Academy", itemsString: "Margherita Pizza Slice x1, Chocolate Brownie x1", amount: 3.95, cost: 1.60, date: "2026-06-09" },
  { id: 3, tenantId: 1, studentId: 2, studentName: "Oliver Smith", schoolName: "Greenwood Academy", itemsString: "Cheese & Tomato Wrap x1, Sparkling Water 500ml x1", amount: 2.55, cost: 1.00, date: "2026-06-09" },
  { id: 4, tenantId: 2, studentId: 4, studentName: "Liam Davis", schoolName: "Riverside Primary", itemsString: "Fish & Chips x1, Ribena Carton x1", amount: 4.80, cost: 2.25, date: "2026-06-08" },
  { id: 5, tenantId: 2, studentId: 4, studentName: "Liam Davis", schoolName: "Riverside Primary", itemsString: "Veggie Burger x1, Apple x2", amount: 4.25, cost: 1.80, date: "2026-06-10" },
  { id: 6, tenantId: 1, studentId: 1, studentName: "Emma Johnson", schoolName: "Greenwood Academy", itemsString: "Sparkling Water 500ml x1", amount: 0.75, cost: 0.20, date: "2026-06-10" }
];

const initialSystemUsers: SystemUser[] = [
  { id: 1, name: "Platform Admin", email: "admin@lspay.com", passwordHash: "admin123", role: "super_admin", tenantId: null, isActive: true },
  { id: 2, name: "Sarah Mitchell", email: "sarah@greenwood.edu", passwordHash: "green123", role: "tenant_admin", tenantId: 1, isActive: true },
  { id: 3, name: "James Park", email: "james@greenwood.edu", passwordHash: "james123", role: "kiosk_operator", tenantId: 1, isActive: true },
  { id: 4, name: "Lisa Chen", email: "lisa@riverside.edu", passwordHash: "river123", role: "tenant_admin", tenantId: 2, isActive: true }
];

const initialParentUsers: ParentUser[] = [
  { id: 1, name: "Helen Johnson", email: "helen@family.com", passwordHash: "parent123", phone: "+44 7700 900123", linkedStudentIds: [1] },
  { id: 2, name: "Robert Davis", email: "robert@family.com", passwordHash: "parent456", phone: "+44 7700 900456", linkedStudentIds: [4] }
];

const initialStockMovements: StockMovement[] = [
  { id: 1, tenantId: 1, itemId: 1, itemName: "Grilled Chicken & Rice", date: "2026-06-08", type: "sale", quantity: 1 },
  { id: 2, tenantId: 1, itemId: 5, itemName: "Orange Juice 330ml", date: "2026-06-08", type: "sale", quantity: 1 },
  { id: 3, tenantId: 1, itemId: 2, itemName: "Margherita Pizza Slice", date: "2026-06-09", type: "sale", quantity: 1 },
  { id: 4, tenantId: 1, itemId: 4, itemName: "Chocolate Brownie", date: "2026-06-09", type: "sale", quantity: 1 },
  { id: 5, tenantId: 1, itemId: 3, itemName: "Cheese & Tomato Wrap", date: "2026-06-09", type: "sale", quantity: 1 },
  { id: 6, tenantId: 1, itemId: 6, itemName: "Sparkling Water 500ml", date: "2026-06-09", type: "sale", quantity: 1 },
  { id: 7, tenantId: 1, itemId: 6, itemName: "Sparkling Water 500ml", date: "2026-06-10", type: "sale", quantity: 1 },
  { id: 8, tenantId: 1, itemId: 1, itemName: "Grilled Chicken & Rice", date: "2026-06-07", type: "restock", quantity: 20, note: "Weekly restock" },
  { id: 9, tenantId: 1, itemId: 5, itemName: "Orange Juice 330ml", date: "2026-06-07", type: "restock", quantity: 30, note: "Weekly restock" },
  { id: 10, tenantId: 2, itemId: 7, itemName: "Fish & Chips", date: "2026-06-08", type: "sale", quantity: 1 },
  { id: 11, tenantId: 2, itemId: 10, itemName: "Ribena Carton", date: "2026-06-08", type: "sale", quantity: 1 },
  { id: 12, tenantId: 2, itemId: 8, itemName: "Veggie Burger", date: "2026-06-10", type: "sale", quantity: 1 },
  { id: 13, tenantId: 2, itemId: 9, itemName: "Apple", date: "2026-06-10", type: "sale", quantity: 2 },
  { id: 14, tenantId: 2, itemId: 7, itemName: "Fish & Chips", date: "2026-06-06", type: "restock", quantity: 15, note: "Weekly restock" }
];

const initialNotifications: AppNotification[] = [
  { id:1, targetRole:'super_admin', targetTenantId:null, targetParentEmail:null, type:'card_pending', message:'New student Sophia Brown at Greenwood Academy is awaiting card assignment.', studentId:3, studentName:'Sophia Brown', isRead:false, createdAt:'2026-06-10T09:00:00Z' },
  { id:2, targetRole:'tenant', targetTenantId:1, targetParentEmail:null, type:'card_ready', message:"Oliver Smith's card has been assigned and is ready for pickup.", studentId:2, studentName:'Oliver Smith', isRead:false, createdAt:'2026-06-09T14:30:00Z' },
  { id:3, targetRole:'parent', targetTenantId:1, targetParentEmail:'helen@family.com', type:'card_delivered', message:"Emma Johnson's card has been delivered.", studentId:1, studentName:'Emma Johnson', isRead:true, createdAt:'2026-06-08T11:00:00Z' }
];

const StoreContext = createContext<AppState | undefined>(undefined);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [tenants, setTenants] = useState<Tenant[]>(initialTenants);
  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [inventory, setInventory] = useState<InventoryItem[]>(initialInventory);
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>(initialSystemUsers);
  const [parentUsers, setParentUsers] = useState<ParentUser[]>(initialParentUsers);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>(initialStockMovements);
  const [notifications, setNotifications] = useState<AppNotification[]>(initialNotifications);
  
  const [session, setSession] = useState<AuthSession>(() => {
    try {
      const saved = localStorage.getItem('lspay_session');
      return saved ? JSON.parse(saved) : { user: null, portal: null };
    } catch { return { user: null, portal: null }; }
  });
  const [parentSession, setParentSession] = useState<ParentUser | null>(() => {
    try {
      const saved = localStorage.getItem('lspay_parent_session');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  useEffect(() => {
    localStorage.setItem('lspay_session', JSON.stringify(session));
  }, [session]);

  useEffect(() => {
    localStorage.setItem('lspay_parent_session', JSON.stringify(parentSession));
  }, [parentSession]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = getSupabase();
    (async () => {
      const { data: tData } = await supabase.from('tenants').select('*');
      if (tData) setTenants(tData.map(r => ({ id: r.id, name: r.name, code: r.code, address: r.address, contactName: r.contact_name, contactEmail: r.contact_email, enrollmentKey: r.enrollment_key, paystackPublicKey: r.paystack_public_key })));

      const { data: sData } = await supabase.from('students').select('*');
      if (sData) setStudents(sData.map(r => ({
        id: r.id, tenantId: r.tenant_id, name: r.name, studentId: r.student_id, cardStatus: r.card_status, cardHardwareId: r.card_hardware_id, cardType: r.card_type, walletBalance: Number(r.wallet_balance), dailyLimit: Number(r.daily_limit), monthlyLimit: Number(r.monthly_limit), pin: r.pin, parentNotificationSent: r.parent_notification_sent, imageUrl: r.image_url, className: r.class_name, cardLifecycleStatus: r.card_lifecycle_status, activatedAt: r.activated_at ?? undefined, homeAddress: r.home_address, billingAddress: r.billing_address, parentName: r.parent_name, parentEmail: r.parent_email
      })));

      const { data: iData } = await supabase.from('inventory_items').select('*');
      if (iData) setInventory(iData.map(r => ({ id: r.id, tenantId: r.tenant_id, name: r.name, category: r.category, stock: r.stock, costPrice: Number(r.cost_price), sellingPrice: Number(r.selling_price), imageUrl: r.image_url })));

      const { data: txData } = await supabase.from('transactions').select('*');
      if (txData) setTransactions(txData.map(r => ({ id: r.id, tenantId: r.tenant_id, studentId: r.student_id, studentName: r.student_name, schoolName: r.school_name, itemsString: r.items_string, amount: r.items_string === 'Wallet Top-up' ? -Math.abs(Number(r.amount)) : Number(r.amount), cost: Number(r.cost), date: r.date })));

      const { data: suData } = await supabase.from('system_users').select('*');
      if (suData) setSystemUsers(suData.map(r => ({ id: r.id, name: r.name, email: r.email, passwordHash: r.password_hash, role: r.role as any, tenantId: r.tenant_id, isActive: r.is_active })));

      const { data: puData } = await supabase.from('parent_users').select('*');
      const { data: psData } = await supabase.from('parent_students').select('*');
      if (puData) setParentUsers(puData.map(r => ({
        id: r.id, name: r.name, email: r.email, passwordHash: r.password_hash, phone: r.phone,
        linkedStudentIds: psData?.filter(ps => ps.parent_id === r.id).map(ps => ps.student_id) || []
      })));

      const { data: smData } = await supabase.from('stock_movements').select('*');
      if (smData) setStockMovements(smData.map(r => ({ id: r.id, tenantId: r.tenant_id, itemId: r.item_id, itemName: r.item_name, date: r.date, type: r.type, quantity: r.quantity, note: r.note })));

      const { data: nData } = await supabase.from('notifications').select('*');
      if (nData) setNotifications(nData.map(r => ({ id: r.id, targetRole: r.target_role as any, targetTenantId: r.target_tenant_id, targetParentEmail: r.target_parent_email, type: r.type as any, message: r.message, studentId: r.student_id, studentName: r.student_name, isRead: r.is_read, createdAt: r.created_at })));
    })();

    // Supabase Realtime Subscription
    const channel = supabase.channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          setStudents(prev => prev.map(s => s.id === payload.new.id ? {
            ...s,
            cardStatus: payload.new.card_status,
            cardHardwareId: payload.new.card_hardware_id,
            cardType: payload.new.card_type,
            walletBalance: Number(payload.new.wallet_balance),
            dailyLimit: Number(payload.new.daily_limit),
            monthlyLimit: Number(payload.new.monthly_limit),
            pin: payload.new.pin,
            parentNotificationSent: payload.new.parent_notification_sent,
            imageUrl: payload.new.image_url,
            className: payload.new.class_name,
            cardLifecycleStatus: payload.new.card_lifecycle_status,
            activatedAt: payload.new.activated_at ?? undefined,
            homeAddress: payload.new.home_address,
            billingAddress: payload.new.billing_address,
            parentName: payload.new.parent_name,
            parentEmail: payload.new.parent_email
          } : s));
        } else if (payload.eventType === 'INSERT') {
          setStudents(prev => {
            if (prev.find(s => s.id === payload.new.id)) return prev;
            return [...prev, {
              id: payload.new.id, tenantId: payload.new.tenant_id, name: payload.new.name, studentId: payload.new.student_id, cardStatus: payload.new.card_status, cardHardwareId: payload.new.card_hardware_id, cardType: payload.new.card_type, walletBalance: Number(payload.new.wallet_balance), dailyLimit: Number(payload.new.daily_limit), monthlyLimit: Number(payload.new.monthly_limit), pin: payload.new.pin, parentNotificationSent: payload.new.parent_notification_sent, imageUrl: payload.new.image_url, className: payload.new.class_name, cardLifecycleStatus: payload.new.card_lifecycle_status, activatedAt: payload.new.activated_at ?? undefined, homeAddress: payload.new.home_address, billingAddress: payload.new.billing_address, parentName: payload.new.parent_name, parentEmail: payload.new.parent_email
            }];
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const login = (email: string, passwordHash: string, portal: 'super_admin' | 'tenant') => {
    const user = systemUsers.find(u => u.email === email && u.passwordHash === passwordHash && u.isActive);
    if (!user) return null;
    if (portal === 'super_admin' && user.role !== 'super_admin') return null;
    if (portal === 'tenant' && user.role === 'super_admin') return null;
    setSession({ user, portal });
    return user;
  };

  const loginParent = (email: string, passwordHash: string) => {
    const user = parentUsers.find(u => u.email === email && u.passwordHash === passwordHash);
    if (!user) return null;
    setParentSession(user);
    return user;
  };

  const logout = () => setSession({ user: null, portal: null });
  const logoutParent = () => setParentSession(null);

  const registerParent = (name: string, email: string, passwordHash: string) => {
    const newUser: ParentUser = {
      id: parentUsers.length > 0 ? Math.max(...parentUsers.map(u => u.id)) + 1 : 1,
      name, email, passwordHash, phone: "", linkedStudentIds: []
    };
    setParentUsers(prev => [...prev, newUser]);
    setParentSession(newUser);
    if (isSupabaseConfigured) {
      getSupabase().from('parent_users').insert({ name, email, password_hash: passwordHash }).select().single().then(({ data }) => {
        if (data) {
          setParentUsers(prev => prev.map(u => u.id === newUser.id ? { ...u, id: data.id } : u));
          setParentSession(prev => prev && prev.id === newUser.id ? { ...prev, id: data.id } : prev);
        }
      });
    }
    return newUser;
  };

  const updateParentUser = (id: number, data: Partial<Pick<ParentUser, "phone">>) => {
    setParentUsers(prev => prev.map(u => u.id === id ? { ...u, ...data } : u));
    setParentSession(prev => prev && prev.id === id ? { ...prev, ...data } : prev);
    if (isSupabaseConfigured && data.phone !== undefined) {
      getSupabase().from('parent_users').update({ phone: data.phone }).eq('id', id).then();
    }
  };

  const createSystemUser = (user: Omit<SystemUser, "id">) => {
    const newUser: SystemUser = {
      ...user,
      id: systemUsers.length > 0 ? Math.max(...systemUsers.map(u => u.id)) + 1 : 1
    };
    setSystemUsers(prev => [...prev, newUser]);
    if (isSupabaseConfigured) {
      getSupabase().from('system_users').insert({
        name: user.name, email: user.email, password_hash: user.passwordHash, role: user.role, tenant_id: user.tenantId, is_active: user.isActive
      }).select().single().then(({ data }) => {
        if (data) setSystemUsers(prev => prev.map(u => u.id === newUser.id ? { ...u, id: data.id } : u));
      });
    }
    return newUser;
  };

  const updateSystemUser = (id: number, data: Partial<SystemUser>) => {
    setSystemUsers(prev => prev.map(u => u.id === id ? { ...u, ...data } : u));
    if (isSupabaseConfigured) {
      const updates: any = {};
      if (data.name !== undefined) updates.name = data.name;
      if (data.email !== undefined) updates.email = data.email;
      if (data.passwordHash !== undefined) updates.password_hash = data.passwordHash;
      if (data.role !== undefined) updates.role = data.role;
      if (data.tenantId !== undefined) updates.tenant_id = data.tenantId;
      if (data.isActive !== undefined) updates.is_active = data.isActive;
      getSupabase().from('system_users').update(updates).eq('id', id).then();
    }
  };

  const addTenant = (t: Omit<Tenant, "id">) => {
    const newTenant: Tenant = { ...t, id: tenants.length > 0 ? Math.max(...tenants.map(tn => tn.id)) + 1 : 1 };
    setTenants(prev => [...prev, newTenant]);
    if (isSupabaseConfigured) {
      getSupabase().from('tenants').insert({
        name: t.name, code: t.code, address: t.address, contact_name: t.contactName, contact_email: t.contactEmail, enrollment_key: t.enrollmentKey, paystack_public_key: t.paystackPublicKey
      }).select().single().then(({ data }) => {
        if (data) setTenants(prev => prev.map(tn => tn.id === newTenant.id ? { ...tn, id: data.id } : tn));
      });
    }
    return newTenant;
  };

  const updateTenant = (id: number, updates: Partial<Tenant>) => {
    setTenants(prev => prev.map(tn => tn.id === id ? { ...tn, ...updates } : tn));
    if (isSupabaseConfigured) {
      const dbUpdates: any = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.code !== undefined) dbUpdates.code = updates.code;
      if (updates.address !== undefined) dbUpdates.address = updates.address;
      if (updates.contactName !== undefined) dbUpdates.contact_name = updates.contactName;
      if (updates.contactEmail !== undefined) dbUpdates.contact_email = updates.contactEmail;
      if (updates.paystackPublicKey !== undefined) dbUpdates.paystack_public_key = updates.paystackPublicKey;
      getSupabase().from('tenants').update(dbUpdates).eq('id', id).then();
    }
  };

  const assignCard = (studentId: number, cardType: string, hardwareId: string) => {
    setStudents(prev => prev.map(s => s.id === studentId ? { ...s, cardStatus: "Issued", cardLifecycleStatus: "assigned", cardType, cardHardwareId: hardwareId, parentNotificationSent: true } : s));
    if (isSupabaseConfigured) {
      getSupabase().from('students').update({
        card_status: "Issued", card_lifecycle_status: "assigned", card_type: cardType, card_hardware_id: hardwareId, parent_notification_sent: true
      }).eq('id', studentId).then(({ error }) => {
        if (error) {
          console.error("Supabase update failed for assignCard:", error);
          alert("Database update failed! Check console for errors.");
        }
      });
    }
  };

  const replaceCard = (studentId: number, cardType: string, hardwareId: string) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    const wasActivated = student.cardLifecycleStatus === 'activated';
    updateStudent(studentId, {
      cardType, cardHardwareId: hardwareId,
      cardStatus: wasActivated ? 'Active' : 'Issued',
      cardLifecycleStatus: wasActivated ? 'activated' : 'assigned',
    });
    if (wasActivated && student.parentEmail) {
      addNotification({
        targetRole: 'parent', targetTenantId: student.tenantId, targetParentEmail: student.parentEmail,
        type: 'card_delivered', message: `${student.name}'s card was replaced. The new card is active and ready to use.`,
        studentId: student.id, studentName: student.name, isRead: false, createdAt: new Date().toISOString()
      });
    }
  };

  const removeCard = (studentId: number) => {
    updateStudent(studentId, {
      cardStatus: 'Unassigned', cardHardwareId: '', cardType: '', cardLifecycleStatus: 'pending_assignment', parentNotificationSent: false, activatedAt: undefined,
    });
  };

  const createStudent = (s: Omit<Student, "id">) => {
    const newStudent = { ...s, id: students.length > 0 ? Math.max(...students.map(st => st.id)) + 1 : 1, cardLifecycleStatus: 'pending_assignment' as const };
    setStudents(prev => [...prev, newStudent]);
    if (isSupabaseConfigured) {
      getSupabase().from('students').insert({
        tenant_id: s.tenantId, name: s.name, student_id: s.studentId, card_status: s.cardStatus, card_hardware_id: s.cardHardwareId, card_type: s.cardType, wallet_balance: s.walletBalance, daily_limit: s.dailyLimit, monthly_limit: s.monthlyLimit, pin: s.pin, parent_notification_sent: s.parentNotificationSent, image_url: s.imageUrl, class_name: s.className, card_lifecycle_status: 'pending_assignment', home_address: s.homeAddress, billing_address: s.billingAddress, parent_name: s.parentName, parent_email: s.parentEmail
      }).select().single().then(({ data, error }) => {
        if (error) {
          console.error("Supabase insert failed for createStudent:", error);
          alert("Database insert failed! Check console for errors.");
        }
        if (data) setStudents(prev => prev.map(st => st.id === newStudent.id ? { ...st, id: data.id } : st));
      });
    }
    
    addNotification({
      targetRole: 'super_admin', targetTenantId: null, targetParentEmail: null,
      type: 'card_pending', message: `New student ${s.name} is awaiting card assignment.`,
      studentId: newStudent.id, studentName: s.name, isRead: false, createdAt: new Date().toISOString()
    });
    return newStudent;
  };

  const updateStudent = (studentId: number, updates: Partial<Student>) => {
    setStudents(prev => prev.map(s => s.id === studentId ? { ...s, ...updates } : s));
    if (isSupabaseConfigured) {
      const dbUpdates: any = {};
      if (updates.cardStatus !== undefined) dbUpdates.card_status = updates.cardStatus;
      if (updates.cardHardwareId !== undefined) dbUpdates.card_hardware_id = updates.cardHardwareId;
      if (updates.cardType !== undefined) dbUpdates.card_type = updates.cardType;
      if (updates.walletBalance !== undefined) dbUpdates.wallet_balance = updates.walletBalance;
      if (updates.dailyLimit !== undefined) dbUpdates.daily_limit = updates.dailyLimit;
      if (updates.monthlyLimit !== undefined) dbUpdates.monthly_limit = updates.monthlyLimit;
      if (updates.pin !== undefined) dbUpdates.pin = updates.pin;
      if (updates.parentNotificationSent !== undefined) dbUpdates.parent_notification_sent = updates.parentNotificationSent;
      if (updates.imageUrl !== undefined) dbUpdates.image_url = updates.imageUrl;
      if (updates.className !== undefined) dbUpdates.class_name = updates.className;
      if (updates.cardLifecycleStatus !== undefined) dbUpdates.card_lifecycle_status = updates.cardLifecycleStatus;
      if (updates.activatedAt !== undefined) dbUpdates.activated_at = updates.activatedAt;
      if (updates.homeAddress !== undefined) dbUpdates.home_address = updates.homeAddress;
      if (updates.billingAddress !== undefined) dbUpdates.billing_address = updates.billingAddress;
      if (updates.parentName !== undefined) dbUpdates.parent_name = updates.parentName;
      if (updates.parentEmail !== undefined) dbUpdates.parent_email = updates.parentEmail;
      if (Object.keys(dbUpdates).length > 0) {
        getSupabase().from('students').update(dbUpdates).eq('id', studentId).then(({ error }) => {
          if (error) {
            console.error("Supabase update failed for updateStudent:", error);
            alert("Database update failed! Check console for errors.");
          }
        });
      }
    }
  };

  const addInventory = (item: Omit<InventoryItem, "id">) => {
    const newItem = { ...item, id: inventory.length > 0 ? Math.max(...inventory.map(i => i.id)) + 1 : 1 };
    setInventory(prev => [...prev, newItem]);
    if (isSupabaseConfigured) {
      getSupabase().from('inventory_items').insert({
        tenant_id: item.tenantId, name: item.name, category: item.category, stock: item.stock, cost_price: item.costPrice, selling_price: item.sellingPrice, image_url: item.imageUrl
      }).select().single().then(({ data }) => {
        if (data) setInventory(prev => prev.map(i => i.id === newItem.id ? { ...i, id: data.id } : i));
      });
    }
  };

  const updateInventory = (id: number, item: Partial<InventoryItem>) => {
    setInventory(prev => prev.map(i => i.id === id ? { ...i, ...item } : i));
    if (isSupabaseConfigured) {
      const dbUpdates: any = {};
      if (item.name !== undefined) dbUpdates.name = item.name;
      if (item.category !== undefined) dbUpdates.category = item.category;
      if (item.stock !== undefined) dbUpdates.stock = item.stock;
      if (item.costPrice !== undefined) dbUpdates.cost_price = item.costPrice;
      if (item.sellingPrice !== undefined) dbUpdates.selling_price = item.sellingPrice;
      if (item.imageUrl !== undefined) dbUpdates.image_url = item.imageUrl;
      if (Object.keys(dbUpdates).length > 0) getSupabase().from('inventory_items').update(dbUpdates).eq('id', id).then();
    }
  };

  const deleteInventory = (id: number) => {
    setInventory(prev => prev.filter(i => i.id !== id));
    if (isSupabaseConfigured) getSupabase().from('inventory_items').delete().eq('id', id).then();
  };
  
  const addTransaction = (tx: Omit<Transaction, "id">) => {
    const newTx = { ...tx, id: transactions.length > 0 ? Math.max(...transactions.map(t => t.id)) + 1 : 1 };
    setTransactions(prev => [...prev, newTx]);
    if (isSupabaseConfigured) {
      getSupabase().from('transactions').insert({
        tenant_id: tx.tenantId, student_id: tx.studentId, student_name: tx.studentName, school_name: tx.schoolName, items_string: tx.itemsString, amount: Math.abs(tx.amount), cost: tx.cost, date: tx.date
      }).select().single().then(({ data }) => {
        if (data) setTransactions(prev => prev.map(t => t.id === newTx.id ? { ...t, id: data.id } : t));
      });
    }
  };

  const cancelTransaction = (id: number) => {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;
    setTransactions(prev => prev.filter(t => t.id !== id));
    setStudents(prev => prev.map(s => s.id === tx.studentId ? { ...s, walletBalance: s.walletBalance + tx.amount } : s));
    if (isSupabaseConfigured) {
      getSupabase().from('transactions').delete().eq('id', id).then();
      const student = students.find(s => s.id === tx.studentId);
      if (student) getSupabase().from('students').update({ wallet_balance: student.walletBalance + tx.amount }).eq('id', tx.studentId).then();
    }
  };

  const deductBalanceAndStock = (studentId: number, amount: number, items: {id: number, qty: number}[]) => {
    setStudents(prev => prev.map(s => s.id === studentId ? { ...s, walletBalance: s.walletBalance - amount } : s));
    setInventory(prev => prev.map(inv => {
      const purchased = items.find(i => i.id === inv.id);
      return purchased ? { ...inv, stock: inv.stock - purchased.qty } : inv;
    }));
    
    if (isSupabaseConfigured) {
      const student = students.find(s => s.id === studentId);
      if (student) getSupabase().from('students').update({ wallet_balance: student.walletBalance - amount }).eq('id', studentId).then();
      items.forEach(purchased => {
        const inv = inventory.find(i => i.id === purchased.id);
        if (inv) getSupabase().from('inventory_items').update({ stock: inv.stock - purchased.qty }).eq('id', purchased.id).then();
      });
    }
  };

  const addStockMovement = (movement: Omit<StockMovement, "id">) => {
    const newMove = { ...movement, id: stockMovements.length > 0 ? Math.max(...stockMovements.map(m => m.id)) + 1 : 1 };
    setStockMovements(prev => [newMove, ...prev]);
    
    if (movement.type === 'restock') {
      updateInventory(movement.itemId, { stock: inventory.find(i => i.id === movement.itemId)!.stock + movement.quantity });
    }
    
    if (isSupabaseConfigured) {
      getSupabase().from('stock_movements').insert({
        tenant_id: movement.tenantId, item_id: movement.itemId, item_name: movement.itemName, date: movement.date, type: movement.type, quantity: movement.quantity, note: movement.note
      }).select().single().then(({ data }) => {
        if (data) setStockMovements(prev => prev.map(m => m.id === newMove.id ? { ...m, id: data.id } : m));
      });
    }
    return newMove;
  };

  const addParentChild = (parentId: number, enrollmentKey: string, studentId: string, parentEmail: string) => {
    const tenant = tenants.find(t => t.enrollmentKey === enrollmentKey);
    if (!tenant) return { success: false, message: "Record not found. Kindly confirm with the school that your email address matches what is on file." };
    
    const student = students.find(s => s.tenantId === tenant.id && s.studentId === studentId);
    if (!student) return { success: false, message: "Record not found. Kindly confirm with the school that your email address matches what is on file." };
    
    if (student.parentEmail !== parentEmail) return { success: false, message: "Record not found. Kindly confirm with the school that your email address matches what is on file." };
    
    setParentUsers(prev => prev.map(p => {
      if (p.id === parentId) {
        return { ...p, linkedStudentIds: [...p.linkedStudentIds, student.id] };
      }
      return p;
    }));
    
    if (parentSession && parentSession.id === parentId) {
      setParentSession(prev => prev ? { ...prev, linkedStudentIds: [...prev.linkedStudentIds, student.id] } : null);
    }
    
    if (isSupabaseConfigured) {
      getSupabase().from('parent_students').insert({ parent_id: parentId, student_id: student.id }).then();
    }
    
    return { success: true };
  };

  const addNotification = (n: Omit<AppNotification, "id">) => {
    const newNotif = { ...n, id: notifications.length > 0 ? Math.max(...notifications.map(no => no.id)) + 1 : 1 };
    setNotifications(prev => [newNotif, ...prev]);
    if (isSupabaseConfigured) {
      getSupabase().from('notifications').insert({
        target_role: n.targetRole, target_tenant_id: n.targetTenantId, target_parent_email: n.targetParentEmail, type: n.type, message: n.message, student_id: n.studentId, student_name: n.studentName, is_read: n.isRead, created_at: n.createdAt
      }).select().single().then(({ data }) => {
        if (data) setNotifications(prev => prev.map(no => no.id === newNotif.id ? { ...no, id: data.id } : no));
      });
    }
    return newNotif;
  };

  const markNotificationRead = (id: number) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    if (isSupabaseConfigured) getSupabase().from('notifications').update({ is_read: true }).eq('id', id).then();
  };

  const markCardReady = (studentId: number) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    updateStudent(studentId, { cardLifecycleStatus: 'ready' });
    addNotification({
      targetRole: 'tenant', targetTenantId: student.tenantId, targetParentEmail: null,
      type: 'card_ready', message: `Card for ${student.name} is ready for pickup.`,
      studentId: student.id, studentName: student.name, isRead: false, createdAt: new Date().toISOString()
    });
  };

  const markCardDelivered = (studentId: number) => {
    const student = students.find(s => s.id === studentId);
    if (!student || student.cardLifecycleStatus !== 'ready') return;
    updateStudent(studentId, { cardLifecycleStatus: 'delivered' });
    if (student.parentEmail) {
      addNotification({
        targetRole: 'parent', targetTenantId: student.tenantId, targetParentEmail: student.parentEmail,
        type: 'card_delivered', message: `Card for ${student.name} has been delivered. Please activate it.`,
        studentId: student.id, studentName: student.name, isRead: false, createdAt: new Date().toISOString()
      });
    }
  };

  const activateCard = (studentId: number, pin: string, dailyLimit: number, monthlyLimit: number) => {
    updateStudent(studentId, {
      cardStatus: 'Active', cardLifecycleStatus: 'activated', activatedAt: new Date().toISOString().slice(0, 10),
      pin, dailyLimit, monthlyLimit
    });
  };

  return (
    <StoreContext.Provider value={{
      tenants, students, inventory, transactions, systemUsers, parentUsers, stockMovements, notifications,
      session, parentSession,
      login, loginParent, logout, logoutParent, registerParent, updateParentUser, createSystemUser, updateSystemUser,
      addTenant, updateTenant, assignCard, replaceCard, removeCard, createStudent, updateStudent, addInventory, updateInventory, deleteInventory, addTransaction, cancelTransaction, deductBalanceAndStock,
      addStockMovement, addParentChild, addNotification, markNotificationRead, markCardReady, markCardDelivered, activateCard
    }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used within StoreProvider");
  return context;
}
