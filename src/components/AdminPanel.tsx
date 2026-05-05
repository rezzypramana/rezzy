import { useState, useEffect, FormEvent } from 'react';
import { UserProfile, UserRole, ActivityLog, OrgSettings } from '../types';
import { db, handleFirestoreError, OperationType, auth } from '../lib/firebase';
import { collection, query, onSnapshot, updateDoc, doc, orderBy, limit, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { UserCog, Shield, Briefcase, Mail, ChevronDown, History, Search, Layout, Upload, Camera, Loader2, Save } from 'lucide-react';
import { formatDate, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { uploadImage } from '../lib/storageService';

const DIVISIONS = ['Finance', 'IT & Tech', 'Operations', 'Marketing', 'Human Resources', 'Security'];

export default function AdminPanel() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [settings, setSettings] = useState<OrgSettings | null>(null);
  const [activeTab, setActiveTab] = useState<'users' | 'activity' | 'branding'>('users');
  const [logSearch, setLogSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Users Listener
    const qUsers = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubUsers = onSnapshot(qUsers, (snapshot) => {
      setUsers(snapshot.docs.map(d => ({ ...d.data() } as UserProfile)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    // Logs Listener
    let unsubLogs: (() => void) | undefined;
    if (auth.currentUser) {
      const qLogs = query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(50));
      unsubLogs = onSnapshot(qLogs, (snapshot) => {
        setLogs(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ActivityLog)));
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'auditLogs');
      });
    }

    // Settings Listener
    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        setSettings(snapshot.data() as OrgSettings);
      }
    }, (error) => {
      console.warn('Branding settings unavailable:', error);
    });

    return () => {
      unsubUsers();
      if (unsubLogs) unsubLogs();
      unsubSettings();
    };
  }, []);

  const handleSaveSettings = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const formData = new FormData(e.currentTarget);
      const logoFile = (e.currentTarget.elements.namedItem('logo') as HTMLInputElement).files?.[0];
      const orgName = formData.get('orgName') as string;

      let logoUrl = settings?.orgLogo || null;
      if (logoFile) {
        logoUrl = await uploadImage(logoFile, 'branding');
      }

      await setDoc(doc(db, 'settings', 'global'), {
        orgName,
        orgLogo: logoUrl,
        updatedAt: serverTimestamp()
      }, { merge: true });

      alert('Pengaturan lembaga berhasil diperbarui!');
    } catch (error) {
       handleFirestoreError(error, OperationType.WRITE, 'settings/global');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRoleChange = async (uid: string, role: UserRole) => {
    try {
      await updateDoc(doc(db, 'users', uid), { role });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const handleDivisionChange = async (uid: string, division: string) => {
    try {
      await updateDoc(doc(db, 'users', uid), { division });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const filteredLogs = logs.filter(l => 
    l.userEmail?.toLowerCase().includes(logSearch.toLowerCase()) ||
    l.action.toLowerCase().includes(logSearch.toLowerCase()) ||
    l.targetName?.toLowerCase().includes(logSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Tab Switcher */}
      <div className="flex gap-2 p-1.5 bg-white border border-gray-100 rounded-2xl shadow-sm w-fit">
        <button 
          onClick={() => setActiveTab('users')}
          className={cn(
            "px-6 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest transition-all",
            activeTab === 'users' ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "text-gray-400 hover:text-gray-900"
          )}
        >
          User Management
        </button>
        <button 
          onClick={() => setActiveTab('activity')}
          className={cn(
            "px-6 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest transition-all flex items-center gap-2",
            activeTab === 'activity' ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "text-gray-400 hover:text-gray-900"
          )}
        >
          <History size={16} />
          Monitoring Real-time
        </button>
        <button 
          onClick={() => setActiveTab('branding')}
          className={cn(
            "px-6 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest transition-all flex items-center gap-2",
            activeTab === 'branding' ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "text-gray-400 hover:text-gray-900"
          )}
        >
          <Layout size={16} />
          Branding Lembaga
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'users' ? (
          <motion.div 
            key="users"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-blue-600"></div>
              <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                  <UserCog size={28} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-gray-900 tracking-tight">Manajemen Admin & Akses</h2>
                  <p className="text-gray-500 font-medium">Kelola level admin dan divisi untuk setiap pengguna</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Pengguna</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Hak Akses</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Penempatan Divisi</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Terdaftar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {users.map((u) => (
                      <tr key={u.uid} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-black text-sm">
                              {u.displayName.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-gray-900 leading-none mb-1">{u.displayName}</p>
                              <p className="text-xs text-gray-400 flex items-center gap-1"><Mail size={10} /> {u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 min-w-[180px]">
                          <div className="relative">
                            <select 
                              value={u.role}
                              onChange={(e) => handleRoleChange(u.uid, e.target.value as UserRole)}
                              className={cn(
                                "w-full appearance-none px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border transition-all cursor-pointer pr-10",
                                u.role === 'super_admin' ? "bg-red-50 text-red-600 border-red-100" :
                                u.role === 'division_admin' ? "bg-blue-50 text-blue-600 border-blue-100" :
                                "bg-gray-100 text-gray-500 border-gray-200"
                              )}
                            >
                              <option value="super_admin">Super Admin</option>
                              <option value="division_admin">Division Admin</option>
                              <option value="viewer">Viewer Only</option>
                            </select>
                            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50" />
                          </div>
                        </td>
                        <td className="px-6 py-4 min-w-[180px]">
                          <div className="relative">
                            <select 
                              value={u.division || ''}
                              onChange={(e) => handleDivisionChange(u.uid, e.target.value)}
                              disabled={u.role !== 'division_admin'}
                              className="w-full appearance-none px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold text-gray-600 outline-none pr-10 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <option value="">(Belum Ada)</option>
                              {DIVISIONS.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50" />
                          </div>
                        </td>
                        <td className="px-6 py-4">
                           <p className="text-xs text-gray-500 font-medium">
                              {formatDate(u.createdAt)}
                           </p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <div className="bg-red-50 p-6 rounded-2xl border border-red-100">
                  <Shield className="text-red-500 mb-2" size={24} />
                  <h4 className="font-bold text-red-700">Super Admin</h4>
                  <p className="text-xs text-red-600/70 mt-1">Akses penuh ke seluruh sistem, termasuk pengaturan admin dan seluruh data divisi.</p>
               </div>
               <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
                  <Briefcase className="text-blue-500 mb-2" size={24} />
                  <h4 className="font-bold text-blue-700">Division Admin</h4>
                  <p className="text-xs text-blue-600/70 mt-1">Akses terbatas pada divisi yang ditentukan. Hanya bisa mengelola aset divisi tersebut.</p>
               </div>
               <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                  <UserCog className="text-gray-500 mb-2" size={24} />
                  <h4 className="font-bold text-gray-700">Viewer</h4>
                  <p className="text-xs text-gray-600/70 mt-1">Hanya bisa melihat data tanpa hak akses untuk menambah, mengubah, atau menghapus.</p>
               </div>
            </div>
          </motion.div>
        ) : activeTab === 'branding' ? (
          <motion.div 
            key="branding"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="max-w-2xl"
          >
            <div className="bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-2xl relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-2 bg-blue-600"></div>
               <div className="flex items-center gap-5 mb-10">
                 <div className="p-4 bg-blue-50 text-blue-600 rounded-3xl">
                   <Layout size={32} />
                 </div>
                 <div>
                   <h2 className="text-3xl font-black text-gray-900 tracking-tight">Identitas Lembaga</h2>
                   <p className="text-gray-500 font-medium">Ubah nama sistem dan pasang logo lembaga Anda</p>
                 </div>
               </div>

               <form onSubmit={handleSaveSettings} className="space-y-8">
                  <div className="space-y-6">
                    <div>
                      <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Logo Institusi / Lembaga</label>
                      <div className="flex items-center gap-8">
                        <div className="h-32 w-32 rounded-[2rem] bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden relative group">
                          {settings?.orgLogo ? (
                            <img src={settings.orgLogo} alt="Logo Prev" className="w-full h-full object-cover" />
                          ) : (
                            <Camera size={32} className="text-gray-300" />
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Upload size={24} className="text-white" />
                          </div>
                          <input type="file" name="logo" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-gray-600 font-medium leading-relaxed">
                            Upload logo resmi lembaga Anda. Logo ini akan muncul pada sidebar, halaman login, dan laporan cetak aset.
                          </p>
                          <p className="text-xs text-gray-400 mt-2 italic font-mono">Format yang disarankan: .PNG atau .JPG (Transparan lebih baik)</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Nama Lembaga (Sistem)</label>
                      <input 
                        name="orgName"
                        type="text" 
                        defaultValue={settings?.orgName}
                        placeholder="Contoh: Yayasan Pendidikan Sinergi"
                        className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-lg font-bold text-gray-900 focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                        required
                      />
                    </div>
                  </div>

                  <div className="pt-4">
                    <button 
                      type="submit" 
                      disabled={isSaving}
                      className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-black/20 disabled:opacity-50 flex items-center justify-center gap-3"
                    >
                      {isSaving ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                      {isSaving ? 'Menyimpan...' : 'Simpan Identitas'}
                    </button>
                  </div>
               </form>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="activity"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-1 bg-violet-600"></div>
               <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-violet-50 text-violet-600 rounded-2xl">
                      <History size={28} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-gray-900 tracking-tight">Log Aktivitas Sistem</h2>
                      <p className="text-gray-500 font-medium">Monitoring realtime tindakan seluruh admin</p>
                    </div>
                  </div>
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input 
                      type="text" 
                      placeholder="Cari user atau aktivitas..." 
                      value={logSearch}
                      onChange={(e) => setLogSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 text-sm"
                    />
                  </div>
               </div>

               <div className="overflow-x-auto">
                 <table className="w-full text-left border-collapse">
                   <thead>
                     <tr className="border-b border-gray-100">
                       <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Waktu</th>
                       <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Admin</th>
                       <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Aktivitas</th>
                       <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Target Item</th>
                       <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Detail</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-50">
                     {filteredLogs.map((log) => (
                       <tr key={log.id} className="hover:bg-violet-50/20 transition-colors">
                         <td className="px-6 py-4">
                            <p className="text-xs text-gray-500 font-black tabular-nums">{formatDate(log.timestamp)}</p>
                         </td>
                         <td className="px-6 py-4">
                            <p className="text-sm font-bold text-gray-900 leading-none">{log.userEmail?.split('@')[0]}</p>
                            <p className="text-[10px] text-gray-400 font-mono mt-1">{log.userEmail}</p>
                         </td>
                         <td className="px-6 py-4">
                            <span className={cn(
                               "px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider",
                               log.action.includes('CREATE') ? "bg-green-50 text-green-600" :
                               log.action.includes('DELETE') ? "bg-red-50 text-red-600" :
                               log.action.includes('UPDATE') ? "bg-blue-50 text-blue-600" :
                               "bg-gray-100 text-gray-500"
                            )}>
                               {log.action.replace('_', ' ')}
                            </span>
                         </td>
                         <td className="px-6 py-4">
                            <p className="text-sm font-bold text-gray-900 truncate max-w-[200px]">{log.targetName || '-'}</p>
                            <p className="text-[10px] text-gray-400 font-mono">{log.targetId ? `#${log.targetId}` : ''}</p>
                         </td>
                         <td className="px-6 py-4">
                            <p className="text-xs text-gray-500 italic max-w-[300px]">{log.details || '-'}</p>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
