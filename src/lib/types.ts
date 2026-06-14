export interface AppNotification {
  id: number;
  targetRole: 'super_admin' | 'tenant' | 'parent';
  targetTenantId: number | null;
  targetParentEmail: string | null;
  type: 'card_pending' | 'card_ready' | 'card_delivered' | 'limit_exceeded';
  message: string;
  studentId: number;
  studentName: string;
  isRead: boolean;
  createdAt: string;
}

export interface Tenant {
  id: number;
  name: string;
  code: string;
  address: string;
  contactName: string;
  contactEmail: string;
  enrollmentKey: string;
}

export type CardStatus = "Active" | "Issued" | "Unassigned" | "Blocked";

export interface Student {
  id: number;
  tenantId: number;
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
  id: number;
  tenantId: number;
  name: string;
  category: "Mains" | "Snacks" | "Drinks" | string;
  stock: number;
  costPrice: number;
  sellingPrice: number;
  imageUrl?: string;
}

export interface Transaction {
  id: number;
  tenantId: number;
  studentId: number;
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
  id: number;
  name: string;
  email: string;
  passwordHash: string;
  role: SuperAdminUserRole | TenantUserRole;
  tenantId: number | null;
  isActive: boolean;
}

export interface AuthSession {
  user: SystemUser | null;
  portal: 'super_admin' | 'tenant' | 'parent' | null;
}

export interface ParentUser {
  id: number;
  name: string;
  email: string;
  passwordHash: string;
  phone?: string;
  linkedStudentIds: number[];
}

export interface StockMovement {
  id: number;
  tenantId: number;
  itemId: number;
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
  
  login: (email: string, passwordHash: string, portal: 'super_admin' | 'tenant') => SystemUser | null;
  loginParent: (email: string, passwordHash: string) => ParentUser | null;
  logout: () => void;
  logoutParent: () => void;
  
  registerParent: (name: string, email: string, passwordHash: string) => ParentUser;
  updateParentUser: (id: number, data: Partial<Pick<ParentUser, "phone">>) => void;
  createSystemUser: (user: Omit<SystemUser, "id">) => SystemUser;
  updateSystemUser: (id: number, data: Partial<SystemUser>) => void;
  
  addTenant: (t: Omit<Tenant, "id">) => Tenant;
  createStudent: (s: Omit<Student, "id">) => Student;
  updateStudent: (studentId: number, updates: Partial<Student>) => void;
  assignCard: (studentId: number, cardType: string, hardwareId: string) => void;
  replaceCard: (studentId: number, cardType: string, hardwareId: string) => void;
  removeCard: (studentId: number) => void;
  
  addInventory: (item: Omit<InventoryItem, "id">) => void;
  updateInventory: (id: number, item: Partial<InventoryItem>) => void;
  deleteInventory: (id: number) => void;
  
  addTransaction: (tx: Omit<Transaction, "id">) => void;
  cancelTransaction: (id: number) => void;
  deductBalanceAndStock: (studentId: number, amount: number, items: {id: number, qty: number}[]) => void;
  
  addStockMovement: (movement: Omit<StockMovement, "id">) => StockMovement;
  addParentChild: (parentId: number, enrollmentKey: string, studentId: string, parentEmail: string) => { success: boolean, message?: string };

  addNotification: (n: Omit<AppNotification, "id">) => AppNotification;
  markNotificationRead: (id: number) => void;
  markCardReady: (studentId: number) => void;
  markCardDelivered: (studentId: number) => void;
  activateCard: (studentId: number, pin: string, dailyLimit: number, monthlyLimit: number) => void;
}
