import { useState, useEffect } from 'react';
import { Asset, Inventory, OrgSettings } from '../types';
import { FileDown, Filter, Calendar, MapPin, Tag, Briefcase, ChevronDown, Table as TableIcon } from 'lucide-react';
import { formatDate, formatCurrency, cn } from '../lib/utils';
import { motion } from 'motion/react';
import { db } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import * as XLSX from 'xlsx';

interface ReportModuleProps {
  assets: Asset[];
  inventory: Inventory[];
}

export default function ReportModule({ assets, inventory }: ReportModuleProps) {
  const [reportType, setReportType] = useState<'asset' | 'inventory'>('asset');
  const [dateFilter, setDateFilter] = useState({ start: '', end: '' });
  const [divisionFilter, setDivisionFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [settings, setSettings] = useState<OrgSettings | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
      if (snapshot.exists()) setSettings(snapshot.data() as OrgSettings);
    }, (error) => {
      console.warn('Report settings delayed:', error);
    });
    return () => unsub();
  }, []);

  const divisions = Array.from(new Set([...assets.map(a => a.division), ...inventory.map(i => i.division)])).filter(Boolean);
  const locations = Array.from(new Set([...assets.map(a => a.location), ...inventory.map(i => i.location)])).filter(Boolean);
  const categories = Array.from(new Set([...assets.map(a => a.category), ...inventory.map(i => i.category)])).filter(Boolean);

  const filteredAssets = assets.filter(a => {
    const d = new Date(a.createdAt?.seconds * 1000 || a.createdAt);
    const inRange = (!dateFilter.start || d >= new Date(dateFilter.start)) && (!dateFilter.end || d <= new Date(dateFilter.end));
    const matchDiv = divisionFilter === 'all' || a.division === divisionFilter;
    const matchLoc = locationFilter === 'all' || a.location === locationFilter;
    const matchCat = categoryFilter === 'all' || a.category === categoryFilter;
    return inRange && matchDiv && matchLoc && matchCat;
  });

  const filteredInventory = inventory.filter(i => {
    const d = new Date(i.createdAt?.seconds * 1000 || i.createdAt);
    const inRange = (!dateFilter.start || d >= new Date(dateFilter.start)) && (!dateFilter.end || d <= new Date(dateFilter.end));
    const matchDiv = divisionFilter === 'all' || i.division === divisionFilter;
    const matchLoc = locationFilter === 'all' || i.location === locationFilter;
    const matchCat = categoryFilter === 'all' || i.category === categoryFilter;
    return inRange && matchDiv && matchLoc && matchCat;
  });

  const currentData = reportType === 'asset' ? filteredAssets : filteredInventory;
  const totalValuation = currentData.reduce((sum, item) => sum + (item.currentPrice || item.purchasePrice || 0) * ('quantity' in item ? item.quantity : 1), 0);

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    const dataToExport = currentData.map(item => ({
      'Nama Barang': item.name,
      'Barcode': item.barcode,
      'Kategori': item.category,
      'Divisi': item.division || 'GENERAL',
      'Lokasi': item.location,
      'Status': item.status,
      'Harga Beli': item.purchasePrice || 0,
      'Harga Saat Ini': item.currentPrice || item.purchasePrice || 0,
      'Kuantitas': 'quantity' in item ? item.quantity : 1,
      'Satuan': 'unit' in item ? (item as Inventory).unit : 'Unit',
      'Tanggal Input': formatDate(item.createdAt)
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, reportType === 'asset' ? 'Laporan Aset' : 'Laporan Inventaris');
    
    const fileName = `Laporan_${reportType === 'asset' ? 'Aset' : 'Inventaris'}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  return (
    <div className="space-y-6">
      {/* Filters Card */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
            <Filter size={20} />
          </div>
          <h2 className="text-lg font-bold text-gray-900">Filter Laporan</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
              <Calendar size={12} /> Rentang Tanggal
            </label>
            <div className="flex gap-2">
              <input 
                type="date" 
                value={dateFilter.start}
                onChange={(e) => setDateFilter(prev => ({ ...prev, start: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20 outline-none" 
              />
              <input 
                type="date" 
                value={dateFilter.end}
                onChange={(e) => setDateFilter(prev => ({ ...prev, end: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20 outline-none" 
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
              <Briefcase size={12} /> Divisi
            </label>
            <div className="relative">
              <select 
                value={divisionFilter}
                onChange={(e) => setDivisionFilter(e.target.value)}
                className="w-full appearance-none px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none pr-10"
              >
                <option value="all">Semua Divisi</option>
                {divisions.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
              <MapPin size={12} /> Lokasi
            </label>
            <div className="relative">
              <select 
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="w-full appearance-none px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none pr-10"
              >
                <option value="all">Semua Lokasi</option>
                {locations.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
              <Tag size={12} /> Jenis Barang
            </label>
            <div className="relative">
              <select 
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full appearance-none px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none pr-10"
              >
                <option value="all">Semua Kategori</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Report Data Card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden min-h-[500px]">
        <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between">
          <div className="flex gap-4">
            <button 
              onClick={() => setReportType('asset')}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-bold transition-all",
                reportType === 'asset' ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              )}
            >
              Laporan Aset
            </button>
            <button 
              onClick={() => setReportType('inventory')}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-bold transition-all",
                reportType === 'inventory' ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              )}
            >
              Laporan Inventaris
            </button>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={handleExportExcel}
              className="group flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all shadow-lg active:scale-95 font-bold"
            >
              <TableIcon size={18} className="group-hover:rotate-12 transition-transform" />
              <span>Export Excel</span>
            </button>
            <button 
              onClick={handlePrint}
              className="flex items-center gap-2 px-6 py-2.5 bg-gray-900 text-white rounded-xl hover:bg-black transition-all shadow-lg active:scale-95 font-bold"
            >
              <FileDown size={18} />
              <span>Ekspor PDF / Cetak</span>
            </button>
          </div>
        </div>

        <div className="p-8">
           <div className="mb-8 flex justify-between items-end border-b-2 border-gray-100 pb-8">
              <div className="flex items-center gap-4">
                 {settings?.orgLogo && (
                   <img src={settings.orgLogo} alt="Logo" className="h-16 w-16 object-cover rounded-xl" />
                 )}
                 <div>
                    <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">{settings?.orgName || 'AssetWise Report Generator'}</h1>
                    <p className="text-gray-500 font-medium">Laporan Ringkasan {reportType === 'asset' ? 'Aset Tetap' : 'Inventaris Perusahaan'}</p>
                    <p className="text-xs text-gray-400 mt-1 uppercase font-bold tracking-widest">{formatDate(new Date())}</p>
                 </div>
              </div>
              <div className="text-right">
                 <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Total Nilai Valuasi</p>
                 <p className="text-3xl font-black text-blue-600 leading-none">{formatCurrency(totalValuation)}</p>
                 <p className="text-xs text-gray-400 mt-1">{currentData.length} item ditemukan</p>
              </div>
           </div>

           <div className="overflow-x-auto">
             <table className="w-full text-left border-collapse">
               <thead>
                 <tr className="border-b-2 border-gray-100">
                   <th className="py-4 text-[10px] font-black text-gray-900 uppercase tracking-widest">Detail Item</th>
                   <th className="py-4 text-[10px] font-black text-gray-900 uppercase tracking-widest">Divisi</th>
                   <th className="py-4 text-[10px] font-black text-gray-900 uppercase tracking-widest">Lokasi</th>
                   <th className="py-4 text-[10px] font-black text-gray-900 uppercase tracking-widest text-right">Harga Terkini</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-gray-50">
                 {currentData.map(item => (
                   <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                     <td className="py-4">
                        <p className="font-bold text-gray-900">{item.name}</p>
                        <p className="text-[10px] font-mono text-gray-400">Barcode: {item.barcode}</p>
                     </td>
                     <td className="py-4">
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[9px] font-black uppercase tracking-tighter">
                          {item.division || 'GENERAL'}
                        </span>
                     </td>
                     <td className="py-4 text-xs font-medium text-gray-600">
                        {item.location}
                     </td>
                     <td className="py-4 text-right">
                        <p className="font-bold text-gray-900">{formatCurrency(item.currentPrice || item.purchasePrice || 0)}</p>
                        <p className="text-[10px] text-gray-400">{reportType === 'inventory' ? `${(item as Inventory).quantity} ${(item as Inventory).unit}` : '1 Unit'}</p>
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>

           {currentData.length === 0 && (
             <div className="py-20 text-center text-gray-400 italic">
               Belum ada data untuk filter yang dipilih
             </div>
           )}
        </div>
      </div>
    </div>
  );
}
