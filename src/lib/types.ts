export interface AppNotification {
  id: string;
  targetRole: 'super_admin' | 'tenant' | 'parent';
  targetTenantId: string | null;
  targetParentEmail: string | null;
  type: 'card_pending' | 'card_ready' | 'card_delivered' | 'limit_exceeded';
  message: string;
  studentId: string;
  studentName: string;
  isRead: boolean;
  createdAt: string;
}

export interface Tenant {
  id: string;
  name: string;
  code: string;
  address: string;
  phone?: string;
  contactName: string;
  contactEmail: string;
  enrollmentKey: string;
  paystackPublicKey?: string;
  paystackSubaccountCode?: string;
  logoUrl?: string;
  schoolNo?: number;
}

export type CardStatus = "Active" | "Issued" | "Unassigned" | "Blocked";

export interface Student {
  id: string;
  tenantId: string;
  name: string;
  studentId: string;
  cardStatus: CardStatus;
  cardHardwareId: string;
  cardType: string;
  walletBalance: number;
  dailyLimit: number;
  monthlyLimit: number;
  pin: string;
  parentNotificationSent: boolean;
  imageUrl: string;
  className: string;
  cardLifecycleStatus: CardLifecycleStatus;
  activatedAt?: string;
  homeAddress: string;
  billingAddress: string;
  parentName: string;
  parentEmail: string;
  /** Phone of the guardian on the student record. */
  parentPhone?: string;
  /** Card print check: "ready" (confirmed), "not_ready" (left / wrong class: never bulk-printed), null = not checked. */
  printStatus?: PrintStatus;
  printStatusAt?: string;
  printStatusBy?: string;
}

export type CardLifecycleStatus =
  | 'none'
  | 'pending_assignment'
  | 'assigned'
  | 'ready'
  | 'delivered'
  | 'activated';

export const CARD_LIFECYCLE_LABELS: Record<CardLifecycleStatus, string> = {
  none: 'No Card',
  pending_assignment: 'Awaiting Card',
  assigned: 'Assigned',
  ready: 'Ready',
  delivered: 'Collected',
  activated: 'Active',
};

export function cardLifecycleLabel(status: CardLifecycleStatus): string {
  return CARD_LIFECYCLE_LABELS[status] ?? status;
}

export interface InventoryItem {
  id: string;
  tenantId: string;
  name: string;
  category: "Mains" | "Snacks" | "Drinks" | string;
  stock: number;
  costPrice: number;
  sellingPrice: number;
  imageUrl?: string;
}

export interface Transaction {
  id: string;
  tenantId: string;
  studentId: string;
  studentName: string;
  schoolName: string;
  itemsString: string;
  amount: number;
  cost: number;
  date: string;
}

export type SuperAdminUserRole = 'super_admin';
export type TenantUserRole = 'tenant_admin' | 'backoffice' | 'kiosk_operator';

export interface SystemUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: SuperAdminUserRole | TenantUserRole;
  tenantId: string | null;
  isActive: boolean;
  /** Staff created with a temporary password who haven't chosen their own yet. */
  mustChangePassword?: boolean;
}

export interface AuthSession {
  user: SystemUser | null;
  portal: 'super_admin' | 'tenant' | 'parent' | null;
}

export interface ParentUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  phone?: string;
  linkedStudentIds: string[];
  /** LSPay parent account created by the school with a temporary password that hasn't been changed yet. */
  mustChangePassword?: boolean;
  tenantId?: string;
  /** Who connected the parent (staff name), for staff views. */
  createdByName?: string;
}

/** What the school sees after connecting a guardian to the LSPay parent portal (like LSA's "Portal access is ready"). */
export type PrintStatus = "ready" | "not_ready" | null;

export interface LspayParentCredentials {
  email: string;
  username: string;
  /** Temporary password — shown once; null when the guardian keeps an existing password. */
  password: string | null;
  isNew: boolean;
  alreadyActive: boolean;
  linkedExisting: boolean;
  emailed: boolean;
  children: string[];
  mustChange: boolean;
}

export type GuardianRelationship = "father" | "mother" | "guardian";

/** An extra LSPay guardian of a student (0088), besides the guardian on the student record. */
export interface LspayGuardian {
  id: string;
  tenantId: string;
  studentId: string;
  name: string;
  email: string;
  phone: string;
  relationship: GuardianRelationship;
  createdAt: string;
}

export interface GuardianInput { name: string; email: string; phone: string; relationship: GuardianRelationship }

export interface LspayGuardianImportRow {
  studentId: string;
  name: string;
  email: string;
  phone: string;
  relationship: GuardianRelationship;
}

export interface LspayGuardianImportResult {
  added: number;
  updated: number;
  alreadyOnRecord: number;
  skipped: { studentId: string; email: string; reason: string }[];
}

export interface StockMovement {
  id: string;
  tenantId: string;
  itemId: string;
  itemName: string;
  date: string;
  type: 'restock' | 'sale';
  quantity: number;
  note?: string;
}

export interface AppState {
  tenants: Tenant[];
  students: Student[];
  inventory: InventoryItem[];
  transactions: Transaction[];
  systemUsers: SystemUser[];
  parentUsers: ParentUser[];
  stockMovements: StockMovement[];
  notifications: AppNotification[];
  
  session: AuthSession;
  parentSession: ParentUser | null;
  
  login: (email: string, password: string, portal: 'super_admin' | 'tenant') => Promise<SystemUser | null>;
  loginParent: (email: string, password: string) => Promise<ParentUser | null>;
  /** Why the last sign-in was refused (suspended school, LSPay off for the school, or no LSPay access); empty when none. */
  lastAccessError: () => string;
  logout: () => Promise<void>;
  logoutParent: () => Promise<void>;

  /** Parent chooses their own password (first sign-in after the school connected them). */
  /** Staff: replace the temporary password, then clear the first-sign-in prompt. */
  changeStaffPassword: (newPassword: string) => Promise<{ success: boolean; message?: string }>;
  changeParentPassword: (newPassword: string) => Promise<{ success: boolean; message?: string }>;
  updateParentUser: (id: string, data: Partial<Pick<ParentUser, "phone">>) => void;
  createSystemUser: (user: Omit<SystemUser, "id">) => Promise<SystemUser | null>;
  updateSystemUser: (id: string, data: Partial<SystemUser>) => void;
  /** Deletes a staff account and its login (no more access anywhere). */
  deleteSystemUser: (id: string) => Promise<{ success: boolean; message?: string }>;
  /** Mark students ready / not ready for card printing (null clears). */
  setPrintStatus: (studentIds: string[], status: PrintStatus) => Promise<{ success: boolean; message?: string; changed?: number }>;

  addTenant: (t: Omit<Tenant, "id">) => Promise<Tenant>;
  updateTenant: (id: string, updates: Partial<Tenant>) => void;
  createStudent: (s: Omit<Student, "id">) => Promise<Student | null>;
  updateStudent: (studentId: string, updates: Partial<Student>) => void;
  bulkUpdateStudentAvatars: (updates: { studentId: string; imageUrl: string }[]) => Promise<{ successCount: number; errors: string[] }>;
  deleteStudent: (studentId: string) => Promise<boolean>;
  deleteStudents: (studentIds: string[], tenantId?: string) => Promise<boolean>;
  assignCard: (studentId: string, cardType: string, hardwareId: string) => void;
  replaceCard: (studentId: string, cardType: string, hardwareId: string) => void;
  removeCard: (studentId: string) => void;

  addInventory: (item: Omit<InventoryItem, "id">) => void;
  updateInventory: (id: string, item: Partial<InventoryItem>) => void;
  deleteInventory: (id: string) => void;

  addTransaction: (tx: Omit<Transaction, "id">) => void;
  cancelTransaction: (id: string) => void;
  deductBalanceAndStock: (studentId: string, amount: number, items: {id: string, qty: number}[]) => Promise<void>;

  addStockMovement: (movement: Omit<StockMovement, "id">) => StockMovement;
  addParentChild: (parentId: string, enrollmentKey: string, studentId: string, privacy: { policyVersion: string; acceptedAt: string }) => Promise<{ success: boolean, message?: string }>;

  addNotification: (n: Omit<AppNotification, "id">) => AppNotification;
  markNotificationRead: (id: string) => void;
  markCardReady: (studentId: string) => void;
  markCardDelivered: (studentId: string) => void;
  activateCard: (studentId: string, pin: string, dailyLimit: number, monthlyLimit: number) => void;

  verifyStaffCode: (code: string) => Promise<boolean>;
  verifyKioskExit: (tenantId: string, password: string) => Promise<boolean>;
  verifyWalletPin: (studentId: string, pin: string) => Promise<boolean>;
  topupWallet: (studentId: string, paystackReference: string) => Promise<void>;
  /** School admin records cash brought to the school: credits the wallet in full and returns the receipt reference. */
  /** Card limits through lspay_set_limits (parents and staff); saved in the database, not just on screen. */
  setCardLimits: (studentId: string, daily: number, monthly: number) => Promise<{ success: boolean; message?: string }>;
  /** Freeze (true) / unfreeze (false) an activated card through lspay_set_card_frozen. */
  setCardFrozen: (studentId: string, frozen: boolean) => Promise<{ success: boolean; message?: string }>;
  cashTopup: (studentId: string, amount: number, paidBy: string, note: string) => Promise<{ success: boolean; message?: string; reference?: string; balance?: number }>;
  /** Staff: connect a student's guardian to the LSPay parent portal (temporary password), or reset that password. */
  /** guardianId: an extra LSPay guardian; omitted = the guardian on the student record. */
  connectLspayParent: (studentId: string, action?: "connect" | "reset", guardianId?: string, opts?: { refresh?: boolean }) => Promise<{ success: boolean; message?: string; credentials?: LspayParentCredentials }>;
  /** Re-read one school's LSPay parent accounts and guardians. */
  refreshLspayParents: (tenantId: string) => Promise<void>;
  lspayGuardians: LspayGuardian[];
  addLspayGuardian: (studentId: string, g: GuardianInput, opts?: { tenantId?: string; refresh?: boolean }) => Promise<{ success: boolean; message?: string }>;
  updateLspayGuardian: (guardianId: string, g: GuardianInput, opts?: { refresh?: boolean }) => Promise<{ success: boolean; message?: string }>;
  removeLspayGuardian: (guardianId: string, opts?: { refresh?: boolean }) => Promise<{ success: boolean; message?: string }>;
  importLspayGuardians: (tenantId: string, rows: LspayGuardianImportRow[]) => Promise<LspayGuardianImportResult>;
}
