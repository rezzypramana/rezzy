import { useEffect, useState } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line
} from 'recharts';
import { Asset, Inventory, ActivityLog } from '../types';
import { Package, ClipboardList, AlertCircle, CheckCircle2, DollarSign, Briefcase, TrendingUp, History, Wrench, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { formatCurrency, formatDate, cn } from '../lib/utils';
import { db, handleFirestoreError, OperationType, auth } from '../lib/firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';

interface DashboardProps {
  assets: Asset[];
  inventory: Inventory[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function Dashboard({ assets, inventory }: DashboardProps) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(10));
    const unsub = onSnapshot(q, (snapshot) => {
      setLogs(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ActivityLog)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'auditLogs');
    });

    return () => unsub();
  }, []);

  const totalValuation = assets.reduce((sum, a) => sum + (a.currentPrice || a.purchasePrice || 0), 0) +
                        inventory.reduce((sum, i) => sum + (i.currentPrice || i.purchasePrice || 0) * i.quantity, 0);

  const maintenanceAlerts = assets.filter(a => {
    if (!a.nextMaintenance) return false;
    const nextDate = new Date(a.nextMaintenance);
    const today = new Date();
    const diffTime = nextDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 7 && a.status !== 'retired';
  });

  const stats = [
    { label: 'Total Aset', value: assets.length, icon: <Package />, color: 'bg-blue-500', trend: '+12%' },
    { label: 'Total Stok', value: inventory.reduce((sum, i) => sum + i.quantity, 0), icon: <TrendingUp />, color: 'bg-violet-500', trend: '-5%' },
    { label: 'Valuasi Total', value: formatCurrency(totalValuation), icon: <DollarSign />, color: 'bg-green-500', trend: '+8%' },
    { label: 'Pemeliharaan', value: assets.filter(a => a.status === 'maintenance').length, icon: <AlertCircle />, color: 'bg-amber-500', trend: 'Penting' },
  ];

  const lowStock = inventory.filter(i => i.quantity <= i.minQuantity);

  const divisionValueData = Object.entries(
    [...assets, ...inventory].reduce((acc, item) => {
      const div = item.division || 'General';
      const val = (item.currentPrice || item.purchasePrice || 0) * ('quantity' in item ? item.quantity : 1);
      acc[div] = (acc[div] || 0) + val;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }));

  const statusData = [
    { name: 'Available', value: assets.filter(a => a.status === 'available').length },
    { name: 'In Use', value: assets.filter(a => a.status === 'in-use').length },
    { name: 'Maintenance', value: assets.filter(a => a.status === 'maintenance').length },
    { name: 'Retired', value: assets.filter(a => a.status === 'retired').length },
  ];

  const categoryData = Object.entries(
    assets.reduce((acc, a) => {
      acc[a.category] = (acc[a.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-8">
      {/* Dynamic Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
            className="group rounded-3xl border border-gray-100 bg-white p-6 shadow-xl hover:shadow-2xl transition-all duration-300 relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`${stat.color} p-4 rounded-2xl text-white shadow-lg shadow-black/5 group-hover:scale-110 transition-transform`}>
                {stat.icon}
              </div>
              <span className={cn(
                "px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-gray-100 text-gray-500"
              )}>
                {stat.trend}
              </span>
            </div>
            <div>
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">{stat.label}</p>
              <h3 className="text-2xl font-black text-gray-900 truncate">{stat.value}</h3>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Assets Status Chart */}
        <div className="lg:col-span-1 rounded-3xl border border-gray-100 bg-white p-8 shadow-xl">
          <h3 className="text-xl font-black text-gray-900 mb-8 flex items-center gap-2">
             <div className="h-2 w-2 rounded-full bg-blue-600"></div>
             Status Operasional
          </h3>
          <div className="h-64 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={95}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} cornerRadius={10} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}
                  itemStyle={{ fontWeight: 'bold' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
               <p className="text-4xl font-black text-gray-900">{assets.length}</p>
               <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Aset</p>
            </div>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-4">
            {statusData.map((d, i) => (
              <div key={d.name} className="flex items-center gap-2 p-2 bg-gray-50 rounded-xl">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                <div className="flex-1 min-w-0">
                   <p className="text-[10px] text-gray-400 font-bold uppercase truncate">{d.name}</p>
                   <p className="text-sm font-black text-gray-900 leading-none mt-0.5">{d.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Division Valuation Chart */}
        <div className="lg:col-span-2 rounded-3xl border border-gray-100 bg-white p-8 shadow-xl">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
               <div className="h-2 w-2 rounded-full bg-violet-600"></div>
               Valuasi per Divisi
            </h3>
            <button className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline">Lihat Rincian</button>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={divisionValueData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f3f4f6" />
                <XAxis type="number" hide />
                <YAxis 
                   dataKey="name" 
                   type="category" 
                   fontSize={10} 
                   fontWeight="bold" 
                   tickLine={false} 
                   axisLine={false} 
                   width={100}
                />
                <Tooltip 
                  cursor={{ fill: '#f9fafb' }}
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ borderRadius: '15px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="value" radius={[0, 10, 10, 0]}>
                  {divisionValueData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 flex gap-6 overflow-x-auto pb-2 scrollbar-hide">
             <div className="flex items-center gap-2 shrink-0">
                <div className="h-10 w-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                   <Briefcase size={20} />
                </div>
                <div>
                   <p className="text-[10px] font-bold text-gray-400 uppercase">Divisi Aktif</p>
                   <p className="text-sm font-black text-gray-900">{divisionValueData.length}</p>
                </div>
             </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
         {/* Low Stock Alerts */}
         <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-xl">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-black text-gray-900">Perlu Restok</h3>
            <span className="bg-red-50 text-red-600 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border border-red-100">
              {lowStock.length} Item Kritis
            </span>
          </div>
          <div className="space-y-4 max-h-[350px] overflow-auto pr-2 scrollbar-hide">
            {lowStock.length > 0 ? (
              lowStock.map(item => (
                <div key={item.id} className="flex items-center justify-between p-5 rounded-2xl bg-gray-50 border border-gray-100 group hover:border-red-200 hover:bg-white transition-all duration-300">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-white flex items-center justify-center text-gray-400 group-hover:text-red-500 transition-colors shadow-sm">
                      <Package size={24} />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">{item.name}</p>
                      <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">{item.division} • {item.location}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black text-red-600 leading-none">{item.quantity}</p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">Min: {item.minQuantity} {item.unit}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-gray-400 italic bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                <CheckCircle2 size={48} className="mb-4 text-green-500 opacity-20" />
                <p className="font-bold">Semua stok terpenuhi</p>
              </div>
            )}
          </div>
        </div>

        {/* Global Distribution Map-like View */}
        <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-xl">
           <h3 className="text-xl font-black text-gray-900 mb-8 flex items-center gap-2">
             <div className="h-2 w-2 rounded-full bg-amber-600"></div>
             Sebaran Kategori
           </h3>
           <div className="h-72">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={categoryData}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                 <XAxis dataKey="name" fontSize={10} fontWeight="bold" tickLine={false} axisLine={false} dy={10} />
                 <YAxis fontSize={10} fontWeight="bold" tickLine={false} axisLine={false} />
                 <Tooltip 
                   cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }} 
                   contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }} 
                 />
                 <Bar dataKey="value" fill="#3b82f6" radius={[10, 10, 0, 0]}>
                   {categoryData.map((entry, index) => (
                     <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                   ))}
                 </Bar>
               </BarChart>
             </ResponsiveContainer>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
         {/* Recent Activity */}
         <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-xl">
           <div className="flex items-center justify-between mb-8">
             <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
               <History size={24} className="text-blue-600" />
               Update Aktivitas Real-time
             </h3>
             <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
           </div>
           <div className="space-y-4 max-h-[400px] overflow-auto pr-2 scrollbar-hide">
             {logs.length > 0 ? (
               logs.map(log => (
                 <div key={log.id} className="flex gap-4 p-4 rounded-2xl bg-gray-50 border border-gray-100 hover:bg-white transition-all cursor-default">
                    <div className="h-10 w-10 flex-shrink-0 rounded-full bg-white flex items-center justify-center text-blue-600 shadow-sm font-black text-xs">
                       {log.userEmail?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                       <p className="text-sm font-bold text-gray-900">
                         {log.userEmail?.split('@')[0]} <span className="text-gray-400 font-medium">melakukan</span> {log.action.replace('_', ' ')}
                       </p>
                       <p className="text-xs text-blue-600 font-black uppercase mt-0.5">{log.targetName || log.details}</p>
                       <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold">{formatDate(log.timestamp)}</p>
                    </div>
                 </div>
               ))
             ) : (
               <div className="py-20 text-center text-gray-400 italic">Belum ada aktivitas tercatat</div>
             )}
           </div>
         </div>

         {/* Maintenance Alerts */}
         <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-xl">
           <div className="flex items-center justify-between mb-8">
             <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
               <Wrench size={24} className="text-amber-500" />
               Jadwal Maintenance Segera
             </h3>
             <span className="bg-amber-50 text-amber-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-amber-100">
               {maintenanceAlerts.length} Perlu Cek
             </span>
           </div>
           <div className="space-y-4 max-h-[400px] overflow-auto pr-2 scrollbar-hide">
              {maintenanceAlerts.length > 0 ? (
                maintenanceAlerts.map(asset => (
                  <div key={asset.id} className="flex items-center justify-between p-4 rounded-2xl bg-amber-50/30 border border-amber-100 hover:bg-amber-50 transition-all">
                     <div className="flex items-center gap-4">
                        <div className="h-12 w-12 bg-white rounded-xl flex items-center justify-center text-amber-500 shadow-sm">
                           <AlertCircle size={24} />
                        </div>
                        <div>
                           <p className="font-bold text-gray-900">{asset.name}</p>
                           <p className="text-xs text-amber-600 font-bold uppercase tracking-widest">Jadwal: {new Date(asset.nextMaintenance).toLocaleDateString()}</p>
                        </div>
                     </div>
                     <button className="p-2 text-amber-600 hover:bg-amber-100 rounded-xl transition-colors">
                        <ArrowRight size={20} />
                     </button>
                  </div>
                ))
              ) : (
                <div className="py-20 text-center text-gray-400 italic">Tidak ada jadwal mendesak</div>
              )}
           </div>
         </div>
      </div>
    </div>
  );
}
