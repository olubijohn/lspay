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
  contactName: string;
  contactEmail: string;
  enrollmentKey: string;
  paystackPublicKey?: string;
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

  registerParent: (name: string, email: string, password: string) => Promise<ParentUser | null>;
  updateParentUser: (id: string, data: Partial<Pick<ParentUser, "phone">>) => void;
  createSystemUser: (user: Omit<SystemUser, "id">) => Promise<SystemUser | null>;
  updateSystemUser: (id: string, data: Partial<SystemUser>) => void;

  addTenant: (t: Omit<Tenant, "id">) => Promise<Tenant>;
  updateTenant: (id: string, updates: Partial<Tenant>) => void;
  createStudent: (s: Omit<Student, "id">) => Promise<Student | null>;
  updateStudent: (studentId: string, updates: Partial<Student>) => void;
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
  addParentChild: (parentId: string, enrollmentKey: string, studentId: string, parentEmail: string, paystackReference: string) => Promise<{ success: boolean, message?: string }>;

  addNotification: (n: Omit<AppNotification, "id">) => AppNotification;
  markNotificationRead: (id: string) => void;
  markCardReady: (studentId: string) => void;
  markCardDelivered: (studentId: string) => void;
  activateCard: (studentId: string, pin: string, dailyLimit: number, monthlyLimit: number) => void;

  verifyStaffCode: (code: string) => Promise<boolean>;
  verifyKioskExit: (tenantId: string, password: string) => Promise<boolean>;
  verifyWalletPin: (studentId: string, pin: string) => Promise<boolean>;
  topupWallet: (studentId: string, paystackReference: string) => Promise<void>;
}
