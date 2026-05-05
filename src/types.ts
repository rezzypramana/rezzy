export type AssetStatus = 'available' | 'in-use' | 'maintenance' | 'retired';
export type UserRole = 'super_admin' | 'division_admin' | 'viewer';

export interface Asset {
  id: string;
  barcode: string;
  name: string;
  category: string;
  division: string;
  status: AssetStatus;
  location: string;
  purchaseDate?: any;
  purchasePrice?: number;
  currentPrice?: number;
  lastMaintenance?: any;
  nextMaintenance?: any;
  assignedTo?: string;
  image?: string;
  documentImage?: string;
  description?: string;
  
  // Land specific
  landCertificateNumber?: string;
  landOwnershipStatus?: string;
  landCertificateType?: 'SHM' | 'SHGB' | 'SHP' | 'Lainnya';
  landCertificateCondition?: 'Aman' | 'Dijaminkan' | 'Dalam Sengketa';
  
  // Building specific
  buildingNIB?: string;
  buildingFloors?: number;
  buildingArea?: number; // in m2
  buildingPermitNumber?: string;

  createdAt: any;
  updatedAt: any;
}

export interface Inventory {
  id: string;
  barcode: string;
  name: string;
  category: string;
  division: string;
  quantity: number;
  minQuantity: number;
  unit: string;
  purchasePrice?: number;
  currentPrice?: number;
  location: string;
  image?: string;
  documentImage?: string;
  lastRestock?: any;
  createdAt: any;
  updatedAt: any;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  division?: string;
  role: UserRole;
  createdAt: any;
}

export interface ActivityLog {
  id: string;
  uid: string;
  userEmail: string;
  action: string;
  targetId?: string;
  targetName?: string;
  details?: string;
  timestamp: any;
}

export interface OrgSettings {
  orgName: string;
  orgLogo?: string;
  updatedAt: any;
}

export type View = 'dashboard' | 'assets' | 'inventory' | 'scanner' | 'reports' | 'admin';
