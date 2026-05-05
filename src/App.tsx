import { useState, useEffect, ReactNode } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  ClipboardList, 
  ScanLine, 
  LogOut, 
  User as UserIcon,
  Bell,
  Search,
  Plus,
  FileText,
  UserCog,
  ShieldCheck,
  Package as PackageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  auth, 
  db, 
  googleProvider, 
  OperationType, 
  handleFirestoreError 
} from './lib/firebase';
import { 
  signInWithPopup, 
  onAuthStateChanged, 
  signOut, 
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  doc, 
  getDocFromServer, 
  getDoc, 
  setDoc,
  collection,
  onSnapshot,
  query,
  orderBy,
  getDocs,
  serverTimestamp,
  where
} from 'firebase/firestore';
import { View, UserProfile, Asset, Inventory, OrgSettings } from './types';
import Dashboard from './components/Dashboard';
import AssetList from './components/AssetList';
import InventoryList from './components/InventoryList';
import BarcodeScanner from './components/BarcodeScanner';
import ReportModule from './components/ReportModule';
import AdminPanel from './components/AdminPanel';
import { ActivityAction, logActivity } from './lib/auditService';
import { cn } from './lib/utils';

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [loading, setLoading] = useState(true);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [settings, setSettings] = useState<OrgSettings | null>(null);
  const [publicItem, setPublicItem] = useState<Asset | Inventory | null>(null);

  const maintenanceAlerts = assets.filter(a => {
    if (!a.nextMaintenance) return false;
    const nextDate = new Date(a.nextMaintenance);
    const today = new Date();
    const diffTime = nextDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 7 && a.status !== 'retired'; // Alert if within 7 days
  });

  // Test connection to Firestore according to integration rules
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            setProfile(userDoc.data() as UserProfile);
          } else {
            const isAdmin = firebaseUser.email === 'lastbrilian@gmail.com';
            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || 'User',
              role: isAdmin ? 'super_admin' : 'viewer',
              division: '',
              createdAt: serverTimestamp(),
            };
            await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
            setProfile(newProfile);
          }
          await logActivity(ActivityAction.LOGIN, firebaseUser.uid, firebaseUser.email || 'Unknown');
        } catch (error) {
          console.error("Error fetching profile", error);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Sync Data
  useEffect(() => {
    if (!user) return;

    const qAssets = query(collection(db, 'assets'), orderBy('updatedAt', 'desc'));
    const unsubAssets = onSnapshot(qAssets, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Asset));
      // Filter for division admin
      if (profile?.role === 'division_admin') {
        setAssets(data.filter(a => a.division === profile.division));
      } else {
        setAssets(data);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'assets');
    });

    const qInv = query(collection(db, 'inventory'), orderBy('updatedAt', 'desc'));
    const unsubInv = onSnapshot(qInv, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Inventory));
      if (profile?.role === 'division_admin') {
        setInventory(data.filter(i => i.division === profile.division));
      } else {
        setInventory(data);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'inventory');
    });

    return () => {
      unsubAssets();
      unsubInv();
    };
  }, [user, profile]);

  // Sync Settings
  useEffect(() => {
    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        setSettings(snapshot.data() as OrgSettings);
      }
    }, (error) => {
      console.warn('Settings read failed (likely new project):', error);
    });
    return () => unsubSettings();
  }, []);

  const handleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        // We log after profile check usually, but let's log the attempt here or in the listener
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogout = async () => {
    try {
      await logActivity(ActivityAction.LOGOUT, user?.uid || '', user?.email || 'Unknown');
      await signOut(auth);
    } catch (e) {
      console.error(e);
    }
  };

  const handleScan = async (barcode: string) => {
    setScannerOpen(false);
    
    // Quick search in local state if logged in
    let item: any = assets.find(a => a.barcode === barcode) || inventory.find(i => i.barcode === barcode);
    
    // If not found locally (or not logged in), search Firestore directly
    if (!item) {
      try {
        const qA = query(collection(db, 'assets'), where('barcode', '==', barcode));
        const sA = await getDocs(qA);
        if (!sA.empty) {
          item = { id: sA.docs[0].id, ...sA.docs[0].data() };
        } else {
          const qI = query(collection(db, 'inventory'), where('barcode', '==', barcode));
          const sI = await getDocs(qI);
          if (!sI.empty) {
            item = { id: sI.docs[0].id, ...sI.docs[0].data() };
          }
        }
      } catch (e) {
        console.error("Public scan query failed", e);
      }
    }

    if (item) {
      if (user) {
        if ('status' in item) setCurrentView('assets'); else setCurrentView('inventory');
      } else {
        setPublicItem(item);
      }
    } else {
      alert(`Barang dengan barcode ${barcode} tidak ditemukan.`);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  // Public View for Non-Logged-In Scans
  if (!user && publicItem) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-2xl border border-gray-100 overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-2 bg-blue-600"></div>
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-bold uppercase tracking-widest mb-2 inline-block">
                Informasi Aset
              </div>
              <h1 className="text-3xl font-extrabold text-gray-900 leading-tight">{publicItem.name}</h1>
              <p className="text-sm font-mono text-gray-400">Barcode: #{publicItem.barcode}</p>
            </div>
            <div className="h-16 w-16 bg-gray-50 rounded-2xl flex items-center justify-center border border-gray-100">
               <Package size={32} className="text-blue-500 opacity-50" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 bg-gray-50 rounded-2xl p-6 border border-gray-100 mb-8">
             <div>
               <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Kategori</p>
               <p className="text-gray-900 font-semibold">{publicItem.category}</p>
             </div>
             <div>
               <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Divisi</p>
               <p className="text-gray-900 font-semibold">{publicItem.division}</p>
             </div>
             <div>
               <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Lokasi</p>
               <p className="text-gray-900 font-semibold">{publicItem.location}</p>
             </div>
             <div>
               <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Status / Kondisi</p>
               <p className="text-gray-900 font-semibold">{'status' in publicItem ? publicItem.status : 'In Stock'}</p>
             </div>
          </div>

          <div className="space-y-4">
             <button 
                onClick={() => setPublicItem(null)} 
                className="w-full py-4 rounded-2xl bg-gray-900 text-white font-bold hover:bg-black transition-all active:scale-95 shadow-xl shadow-black/10"
             >
                Tutup Informasi
             </button>
             <button 
                onClick={handleLogin} 
                className="w-full py-4 rounded-2xl border-2 border-blue-600 text-blue-600 font-bold hover:bg-blue-50 transition-all active:scale-95"
             >
                Masuk ke Dasbor Admin
             </button>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl text-center"
        >
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-blue-100 text-blue-600 overflow-hidden border-2 border-blue-100">
            {settings?.orgLogo ? (
              <img src={settings.orgLogo} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <ClipboardList size={40} />
            )}
          </div>
          <h1 className="mb-2 text-3xl font-bold tracking-tight text-gray-900">{settings?.orgName || 'AssetWise'}</h1>
          <p className="mb-8 text-gray-500">Sistem Manajemen Aset & Inventaris Lembaga</p>
          <div className="space-y-3">
            <button 
              onClick={handleLogin}
              className="flex w-full items-center justify-center gap-3 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition-all hover:bg-blue-700 active:scale-95 shadow-lg shadow-blue-500/20"
            >
              Masuk dengan Google
            </button>
            <button 
              onClick={() => setScannerOpen(true)}
              className="flex w-full items-center justify-center gap-3 rounded-xl bg-white border border-gray-200 px-6 py-3 font-semibold text-gray-700 transition-all hover:bg-gray-50 active:scale-95 shadow-sm"
            >
              <ScanLine size={20} />
              Cek Barcode Barang
            </button>
          </div>
          <p className="mt-6 text-xs text-gray-400">© 2024 AssetWise Enterprise. All rights reserved.</p>
        </motion.div>
        {scannerOpen && <BarcodeScanner onScan={handleScan} onClose={() => setScannerOpen(false)} />}
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-gray-200 bg-white flex flex-col">
        <div className="p-6 flex items-center gap-3 border-bottom overflow-hidden">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-500/20 overflow-hidden">
            {settings?.orgLogo ? (
              <img src={settings.orgLogo} alt="L" className="w-full h-full object-cover" />
            ) : (
              <ClipboardList size={24} />
            )}
          </div>
          <span className="text-xl font-bold tracking-tight truncate">{settings?.orgName || 'AssetWise'}</span>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          <NavItem 
            active={currentView === 'dashboard'} 
            onClick={() => setCurrentView('dashboard')}
            icon={<LayoutDashboard size={20} />} 
            label="Dasbor" 
          />
          <NavItem 
            active={currentView === 'assets'} 
            onClick={() => setCurrentView('assets')}
            icon={<Package size={20} />} 
            label="Aset Tetap" 
          />
          <NavItem 
            active={currentView === 'inventory'} 
            onClick={() => setCurrentView('inventory')}
            icon={<PackageIcon size={20} />} 
            label="Inventaris" 
          />
          <NavItem 
            active={currentView === 'reports'} 
            onClick={() => setCurrentView('reports')}
            icon={<FileText size={20} />} 
            label="Laporan" 
          />
          {profile?.role === 'super_admin' && (
            <NavItem 
              active={currentView === 'admin'} 
              onClick={() => setCurrentView('admin')}
              icon={<UserCog size={20} />} 
              label="Manajemen" 
            />
          )}
          <div className="pt-4 border-t border-gray-100 mt-4">
            <button
              onClick={() => setScannerOpen(true)}
              className="flex w-full items-center gap-3 px-4 py-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors font-medium"
            >
              <ScanLine size={20} />
              <span>Scan Barcode</span>
            </button>
          </div>
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-3 p-2 mb-4 bg-gray-50 rounded-xl">
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700">
              <UserIcon size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate text-gray-900">{profile?.displayName}</p>
              <p className="text-xs text-gray-500 truncate">{profile?.role}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="flex w-full items-center gap-3 px-4 py-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors group"
          >
            <LogOut size={20} className="group-hover:rotate-180 transition-transform duration-300" />
            <span>Keluar Sesi</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <header className="h-16 border-bottom bg-white px-8 flex items-center justify-between sticky top-0 z-10">
          <h2 className="text-xl font-bold capitalize">{currentView === 'dashboard' ? 'Overview' : currentView.replace('-', ' ')}</h2>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" 
                placeholder="Cari aset..." 
                className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm w-64 transition-all"
              />
            </div>
            <button className="relative p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors">
              <Bell size={20} />
              {maintenanceAlerts.length > 0 && (
                <span className="absolute top-1 right-1 h-5 w-5 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full font-bold border-2 border-white animate-bounce">
                  {maintenanceAlerts.length}
                </span>
              )}
            </button>
          </div>
        </header>

        <div className="p-8">
          <AnimatePresence mode="wait">
            {currentView === 'dashboard' && (
              <motion.div key="dashboard" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <Dashboard assets={assets} inventory={inventory} />
              </motion.div>
            )}
            {currentView === 'assets' && (
              <motion.div key="assets" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <AssetList assets={assets} />
              </motion.div>
            )}
            {currentView === 'inventory' && (
              <motion.div key="inventory" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <InventoryList inventory={inventory} />
              </motion.div>
            )}
            {currentView === 'reports' && (
              <motion.div key="reports" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <ReportModule assets={assets} inventory={inventory} />
              </motion.div>
            )}
            {currentView === 'admin' && (
              <motion.div key="admin" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <AdminPanel />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Barcode Scanner Overlay */}
      {scannerOpen && <BarcodeScanner onScan={handleScan} onClose={() => setScannerOpen(false)} />}
    </div>
  );
}

function NavItem({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
        active 
          ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" 
          : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
      )}
    >
      <span className={cn("transition-transform group-hover:scale-110", active && "scale-110")}>
        {icon}
      </span>
      <span className="font-medium">{label}</span>
    </button>
  );
}
