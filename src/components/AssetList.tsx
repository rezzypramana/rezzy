import { useState, useRef, FormEvent } from 'react';
import { Asset, AssetStatus } from '../types';
import { 
  Plus, 
  Search, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  MapPin, 
  Tag, 
  Calendar,
  X,
  Filter,
  Package,
  Printer,
  ChevronDown,
  Camera,
  FileText,
  Image as ImageIcon,
  Upload,
  Loader2,
  QrCode
} from 'lucide-react';
import { db, handleFirestoreError, OperationType, storage } from '../lib/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { uploadImage } from '../lib/storageService';
import { formatDate, formatCurrency, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useReactToPrint } from 'react-to-print';
import { QRCodeSVG } from 'qrcode.react';
import { QRPrint } from './QRPrint';

import { ActivityAction, logActivity } from '../lib/auditService';

interface AssetListProps {
  assets: Asset[];
}

const DIVISIONS = ['Finance', 'IT & Tech', 'Operations', 'Marketing', 'Human Resources', 'Security'];

export default function AssetList({ assets }: AssetListProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<AssetStatus | 'all'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('Elektronik');
  const [qrItem, setQrItem] = useState<Asset | null>(null);
  
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: printRef,
  });

  const singleQRRef = useRef<HTMLDivElement>(null);
  const handlePrintSingleQR = useReactToPrint({
    contentRef: singleQRRef,
  });

  const filteredAssets = assets.filter(a => {
    const matchesSearch = a.name.toLowerCase().includes(search.toLowerCase()) || a.barcode.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' || a.status === filter;
    return matchesSearch && matchesFilter;
  });

  const handleDelete = async (id: string, name: string) => {
    if (!confirm('Anda yakin ingin menghapus aset ini?')) return;
    try {
      await deleteDoc(doc(db, 'assets', id));
      await logActivity(ActivityAction.DELETE_ASSET, id, name);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `assets/${id}`);
    }
  };

  const handleSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsUploading(true);
    try {
      const formData = new FormData(e.currentTarget);
      const itemPhoto = (e.currentTarget.elements.namedItem('itemPhoto') as HTMLInputElement).files?.[0];
      const docPhoto = (e.currentTarget.elements.namedItem('docPhoto') as HTMLInputElement).files?.[0];

      let imageUrl = editingAsset?.image || null;
      let docImageUrl = editingAsset?.documentImage || null;

      if (itemPhoto) {
        imageUrl = await uploadImage(itemPhoto, 'assets/items');
      }
      if (docPhoto) {
        docImageUrl = await uploadImage(docPhoto, 'assets/docs');
      }

      const assetData = {
        name: formData.get('name') as string,
        barcode: formData.get('barcode') as string,
        category: formData.get('category') as string,
        division: formData.get('division') as string,
        status: formData.get('status') as AssetStatus,
        location: formData.get('location') as string,
        purchasePrice: Number(formData.get('purchasePrice')),
        currentPrice: Number(formData.get('currentPrice')),
        lastMaintenance: formData.get('lastMaintenance') as string,
        nextMaintenance: formData.get('nextMaintenance') as string,
        description: formData.get('description') as string,
        image: imageUrl,
        documentImage: docImageUrl,
        
        // Land specific
        landCertificateNumber: formData.get('landCertificateNumber') as string || null,
        landOwnershipStatus: formData.get('landOwnershipStatus') as string || null,
        landCertificateType: formData.get('landCertificateType') as any || null,
        landCertificateCondition: formData.get('landCertificateCondition') as any || null,
        
        // Building specific
        buildingNIB: formData.get('buildingNIB') as string || null,
        buildingFloors: formData.get('buildingFloors') ? Number(formData.get('buildingFloors')) : null,
        buildingArea: formData.get('buildingArea') ? Number(formData.get('buildingArea')) : null,
        buildingPermitNumber: formData.get('buildingPermitNumber') as string || null,

        updatedAt: serverTimestamp(),
      };

      if (editingAsset) {
        await updateDoc(doc(db, 'assets', editingAsset.id), assetData);
        await logActivity(ActivityAction.UPDATE_ASSET, editingAsset.id, assetData.name);
      } else {
        const docRef = await addDoc(collection(db, 'assets'), {
          ...assetData,
          createdAt: serverTimestamp(),
        });
        await logActivity(ActivityAction.CREATE_ASSET, docRef.id, assetData.name);
      }
      setIsModalOpen(false);
      setEditingAsset(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'assets');
    } finally {
      setIsUploading(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const selectedItems = assets.filter(a => selectedIds.includes(a.id));

  return (
    <div className="space-y-6">
      <div style={{ display: 'none' }}>
        <QRPrint ref={printRef} items={selectedItems} />
      </div>

      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Cari nama atau barcode..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm transition-all"
            />
          </div>
          <div className="relative">
            <select 
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="appearance-none pl-4 pr-10 py-2 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm transition-all text-sm font-medium"
            >
              <option value="all">Semua Status</option>
              <option value="available">Tersedia</option>
              <option value="in-use">Digunakan</option>
              <option value="maintenance">Pemeliharaan</option>
              <option value="retired">Pensiun</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <button 
              onClick={() => handlePrint()}
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-xl hover:bg-black transition-all shadow-lg active:scale-95 font-semibold"
            >
              <Printer size={18} />
              <span>Cetak QR ({selectedIds.length})</span>
            </button>
          )}
          <button 
            onClick={() => {
              setEditingAsset(null);
              setSelectedCategory('Elektronik');
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 active:scale-95 font-semibold"
          >
            <Plus size={20} />
            <span>Tambah Aset</span>
          </button>
        </div>
      </div>

      {/* Assets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredAssets.map((asset) => (
          <motion.div
            layout
            key={asset.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
              "group relative bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300",
              selectedIds.includes(asset.id) && "ring-2 ring-blue-500 bg-blue-50/10"
            )}
          >
            <input 
              type="checkbox" 
              className="absolute top-4 left-4 h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 z-10"
              checked={selectedIds.includes(asset.id)}
              onChange={() => toggleSelect(asset.id)}
            />

            <div className="flex justify-end items-start mb-4 ml-8">
              <div className={cn(
                "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                asset.status === 'available' ? "bg-green-50 text-green-600" :
                asset.status === 'in-use' ? "bg-blue-50 text-blue-600" :
                asset.status === 'maintenance' ? "bg-amber-50 text-amber-600" :
                "bg-gray-100 text-gray-600"
              )}>
                {asset.status === 'available' ? 'Tersedia' : 
                 asset.status === 'in-use' ? 'Digunakan' : 
                 asset.status === 'maintenance' ? 'Pemeliharaan' : 'Retired'}
              </div>
              <div className="flex gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => setQrItem(asset)}
                  className="p-1.5 hover:bg-gray-50 text-gray-600 rounded-lg transition-colors"
                  title="Generate QR"
                >
                  <QrCode size={16} />
                </button>
                <button 
                  onClick={() => {
                    setEditingAsset(asset);
                    setSelectedCategory(asset.category);
                    setIsModalOpen(true);
                  }}
                  className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                >
                  <Edit2 size={16} />
                </button>
                <button 
                  onClick={() => handleDelete(asset.id, asset.name)}
                  className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {asset.image && (
              <div className="mb-4 h-32 w-full rounded-xl overflow-hidden bg-gray-100 border border-gray-100">
                <img src={asset.image} alt={asset.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
            )}

            <div className="mb-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[9px] font-bold uppercase">
                  {asset.division || 'General'}
                </div>
              </div>
              <h3 className="font-bold text-lg text-gray-900 group-hover:text-blue-600 transition-colors truncate">{asset.name}</h3>
              <p className="text-xs font-mono text-gray-400 tracking-wider">#{asset.barcode}</p>
            </div>

            <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-sm">
               <div className="flex items-center gap-2 text-gray-500">
                  <Tag size={14} className="text-gray-400 shrink-0" />
                  <span className="truncate">{asset.category}</span>
               </div>
               <div className="flex items-center gap-2 text-gray-500">
                  <MapPin size={14} className="text-gray-400 shrink-0" />
                  <span className="truncate">{asset.location}</span>
               </div>
               <div className="flex items-center gap-2 text-gray-500 col-span-2">
                  <Calendar size={14} className="text-gray-400 shrink-0" />
                  <span>Update: {formatDate(asset.updatedAt)}</span>
               </div>
               
               {asset.category === 'Tanah' && asset.landCertificateNumber && (
                 <div className="col-span-2 mt-2 p-3 bg-orange-50 border border-orange-100 rounded-xl">
                   <div className="flex justify-between items-start mb-1">
                     <p className="text-[10px] font-black text-orange-600 uppercase">Surat Tanah / Sertifikat</p>
                     {asset.documentImage && (
                       <a href={asset.documentImage} target="_blank" rel="noopener noreferrer" className="text-[10px] bg-orange-600 text-white px-2 py-0.5 rounded font-bold uppercase hover:bg-orange-700 transition-colors">
                         Lihat Surat
                       </a>
                     )}
                   </div>
                   <p className="text-xs font-bold text-gray-900">{asset.landCertificateType}: {asset.landCertificateNumber}</p>
                   <p className="text-[10px] text-gray-500 mt-1 italic">{asset.landCertificateCondition} | {asset.landOwnershipStatus}</p>
                 </div>
               )}

               {asset.category === 'Bangunan' && (asset.buildingNIB || asset.buildingArea) && (
                 <div className="col-span-2 mt-2 p-3 bg-blue-50 border border-blue-100 rounded-xl">
                   <div className="flex justify-between items-start mb-1">
                     <p className="text-[10px] font-black text-blue-600 uppercase">Informasi Bangunan</p>
                     {asset.documentImage && (
                       <a href={asset.documentImage} target="_blank" rel="noopener noreferrer" className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded font-bold uppercase hover:bg-blue-700 transition-colors">
                         Lihat Surat
                       </a>
                     )}
                   </div>
                   <div className="flex justify-between items-end">
                     <div>
                       <p className="text-xs font-bold text-gray-900">{asset.buildingFloors} Lantai | {asset.buildingArea} m2</p>
                       <p className="text-[10px] text-gray-500 mt-0.5">NIB: {asset.buildingNIB || '-'}</p>
                     </div>
                     {asset.buildingPermitNumber && (
                       <div className="text-right">
                         <p className="text-[10px] text-gray-400 font-bold uppercase">IMB/Permit</p>
                         <p className="text-[10px] font-bold text-gray-700">{asset.buildingPermitNumber}</p>
                       </div>
                     )}
                   </div>
                 </div>
               )}
            </div>

            <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase">Valuasi Saat Ini</p>
                <span className="text-sm font-extrabold text-blue-600">{formatCurrency(asset.currentPrice || asset.purchasePrice || 0)}</span>
              </div>
              <div className="text-right">
                 <p className="text-[10px] font-bold text-gray-400 uppercase">Beli</p>
                 <span className="text-xs font-semibold text-gray-500 line-through opacity-50">{formatCurrency(asset.purchasePrice || 0)}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Empty State */}
      {filteredAssets.length === 0 && (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
          <div className="mx-auto w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 mb-4">
            <Package size={32} />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Tidak ada aset ditemukan</h3>
          <p className="text-gray-500">Coba ubah filter atau tambah aset baru.</p>
        </div>
      )}

      {/* Asset Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                <h2 className="text-xl font-bold">{editingAsset ? 'Edit Aset' : 'Tambah Aset Baru'}</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleSave} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-gray-900 uppercase tracking-wider mb-2 flex items-center gap-2">
                       <MapPin size={14} className="text-blue-500" /> Lokasi Barang / Gedung (WAJIB)
                    </label>
                    <input name="location" required placeholder="Gedung A, Lantai 2, Ruang Rapat, dll" defaultValue={editingAsset?.location} className="w-full px-4 py-3 bg-blue-50 border-2 border-blue-100 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 font-bold" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Nama Barang / Kendaraan</label>
                    <input name="name" required defaultValue={editingAsset?.name} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Barcode</label>
                    <input name="barcode" required defaultValue={editingAsset?.barcode} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Divisi</label>
                    <select name="division" defaultValue={editingAsset?.division} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                      {DIVISIONS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Kategori</label>
                    <select 
                      name="category" 
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option>Elektronik</option>
                      <option>Mebel</option>
                      <option>Kendaraan</option>
                      <option>Tanah</option>
                      <option>Bangunan</option>
                      <option>Peralatan</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Status</label>
                    <select name="status" defaultValue={editingAsset?.status} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                      <option value="available">Tersedia</option>
                      <option value="in-use">Digunakan</option>
                      <option value="maintenance">Pemeliharaan</option>
                      <option value="retired">Pensiun</option>
                    </select>
                  </div>

                  {/* Conditional Fields for Tanah */}
                  {selectedCategory === 'Tanah' && (
                    <div className="col-span-2 grid grid-cols-2 gap-4 p-4 bg-orange-50/50 rounded-xl border border-orange-100">
                       <h3 className="col-span-2 text-xs font-black text-orange-600 uppercase tracking-widest flex items-center gap-2">
                        🛡️ Detail Informasi Pertanahan
                       </h3>
                       <div className="col-span-2">
                          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Nomor Sertifikat / Surat</label>
                          <input name="landCertificateNumber" defaultValue={editingAsset?.landCertificateNumber} placeholder="Contoh: 12.01.02.04.1.00123" className="w-full px-3 py-2 bg-white border border-orange-100 rounded-lg text-sm" />
                       </div>
                       <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Jenis Sertifikat</label>
                          <select name="landCertificateType" defaultValue={editingAsset?.landCertificateType} className="w-full px-3 py-2 bg-white border border-orange-100 rounded-lg text-sm">
                             <option value="SHM">SHM (Milik)</option>
                             <option value="SHGB">SHGB (Bangunan)</option>
                             <option value="SHP">SHP (Pakai)</option>
                             <option value="Lainnya">Lainnya</option>
                          </select>
                       </div>
                       <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Status Sertifikat</label>
                          <select name="landCertificateCondition" defaultValue={editingAsset?.landCertificateCondition} className="w-full px-3 py-2 bg-white border border-orange-100 rounded-lg text-sm">
                             <option value="Aman">Aman (Dalam Box)</option>
                             <option value="Dijaminkan">Dijaminkan (Bank)</option>
                             <option value="Dalam Sengketa">Dalam Sengketa</option>
                          </select>
                       </div>
                       <div className="col-span-2">
                          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Status Kepemilikan</label>
                          <input name="landOwnershipStatus" defaultValue={editingAsset?.landOwnershipStatus} placeholder="Contoh: Atas Nama PT. Sesuatu" className="w-full px-3 py-2 bg-white border border-orange-100 rounded-lg text-sm" />
                       </div>
                    </div>
                  )}

                  {/* Conditional Fields for Bangunan */}
                  {selectedCategory === 'Bangunan' && (
                    <div className="col-span-2 grid grid-cols-2 gap-4 p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                       <h3 className="col-span-2 text-xs font-black text-blue-600 uppercase tracking-widest flex items-center gap-2">
                        🏢 Detail Informasi Bangunan
                       </h3>
                       <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Nomor NIB / PBG</label>
                          <input name="buildingNIB" defaultValue={editingAsset?.buildingNIB} placeholder="Nomor Induk Berusaha / PBG" className="w-full px-3 py-2 bg-white border border-blue-100 rounded-lg text-sm" />
                       </div>
                       <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Nomor IMB / Permit</label>
                          <input name="buildingPermitNumber" defaultValue={editingAsset?.buildingPermitNumber} placeholder="Nomor Ijin Mendirikan Bangunan" className="w-full px-3 py-2 bg-white border border-blue-100 rounded-lg text-sm" />
                       </div>
                       <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Jumlah Lantai</label>
                          <input name="buildingFloors" type="number" defaultValue={editingAsset?.buildingFloors} className="w-full px-3 py-2 bg-white border border-blue-100 rounded-lg text-sm" />
                       </div>
                       <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Luas Bangunan (m2)</label>
                          <input name="buildingArea" type="number" defaultValue={editingAsset?.buildingArea} className="w-full px-3 py-2 bg-white border border-blue-100 rounded-lg text-sm" />
                       </div>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Harga Beli (IDR)</label>
                    <input name="purchasePrice" type="number" defaultValue={editingAsset?.purchasePrice} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Harga Terkini (IDR)</label>
                    <input name="currentPrice" type="number" defaultValue={editingAsset?.currentPrice || editingAsset?.purchasePrice} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Terakhir Pemeliharaan</label>
                    <input name="lastMaintenance" type="date" defaultValue={editingAsset?.lastMaintenance?.split('T')[0]} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Jadwal Selanjutnya</label>
                    <input name="nextMaintenance" type="date" defaultValue={editingAsset?.nextMaintenance?.split('T')[0]} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                  </div>

                  <div className="col-span-2 p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-4">
                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                       <Upload size={14} /> Upload Media & Dokumen
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Foto Barang / Aset</label>
                        <div className="relative group">
                          <input 
                            type="file" 
                            name="itemPhoto" 
                            accept="image/*"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                          />
                          <div className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-200 rounded-xl group-hover:border-blue-400 group-hover:bg-blue-50 transition-all">
                             <Camera size={24} className="text-gray-400 group-hover:text-blue-500 mb-1" />
                             <span className="text-[10px] font-bold text-gray-400 group-hover:text-blue-600">Pilih Foto</span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Foto Surat / Dokumen</label>
                        <div className="relative group">
                          <input 
                            type="file" 
                            name="docPhoto" 
                            accept="image/*,application/pdf"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                          />
                          <div className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-200 rounded-xl group-hover:border-orange-400 group-hover:bg-orange-50 transition-all">
                             <FileText size={24} className="text-gray-400 group-hover:text-orange-500 mb-1" />
                             <span className="text-[10px] font-bold text-gray-400 group-hover:text-orange-600">Pilih Dokumen</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    {(editingAsset?.image || editingAsset?.documentImage) && (
                      <div className="flex gap-4 pt-2 border-t border-gray-200">
                        {editingAsset.image && (
                          <div className="flex items-center gap-2 text-[10px] font-bold text-blue-600">
                            <ImageIcon size={12} /> Foto Barang Tersedia
                          </div>
                        )}
                        {editingAsset.documentImage && (
                          <div className="flex items-center gap-2 text-[10px] font-bold text-orange-600">
                            <FileText size={12} /> Dokumen Tersedia
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Deskripsi</label>
                  <textarea name="description" rows={3} defaultValue={editingAsset?.description} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2 text-gray-600 font-semibold hover:bg-gray-100 rounded-lg transition-colors">Batal</button>
                  <button 
                    type="submit" 
                    disabled={isUploading}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        <span>Mengupload...</span>
                      </>
                    ) : (
                      'Simpan'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Item QR Modal */}
      <AnimatePresence>
        {qrItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <h3 className="font-black text-gray-900 uppercase tracking-tight">QR Code Aset</h3>
                <button onClick={() => setQrItem(null)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors">
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-8 flex flex-col items-center">
                <div className="bg-white p-4 border-4 border-gray-900 rounded-2xl shadow-inner mb-6">
                  <QRCodeSVG value={qrItem.barcode} size={200} level="H" />
                </div>
                <div className="text-center mb-8">
                  <h4 className="text-xl font-bold text-gray-900 mb-1">{qrItem.name}</h4>
                  <p className="text-sm font-mono text-gray-500 tracking-widest bg-gray-100 px-3 py-1 rounded-full inline-block">#{qrItem.barcode}</p>
                </div>
                
                <button 
                  onClick={() => handlePrintSingleQR()}
                  className="w-full flex items-center justify-center gap-3 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 active:scale-[0.98]"
                >
                  <Printer size={20} />
                  Cetak QR Code
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Hidden QR Print Area for single item */}
      {qrItem && (
        <div className="hidden">
           <div ref={singleQRRef} className="p-8 bg-white flex flex-col items-center justify-center min-h-screen">
             <div className="border-[10px] border-black p-4 mb-4">
                <QRCodeSVG value={qrItem.barcode} size={300} level="H" />
             </div>
             <p className="text-3xl font-black text-center uppercase tracking-tighter mb-2">{qrItem.name}</p>
             <p className="text-xl font-mono text-gray-500 mb-4">{qrItem.barcode}</p>
             <div className="px-6 py-2 bg-black text-white text-lg font-bold rounded-xl border-2 border-black">
                {qrItem.division || 'GENERAL'}
             </div>
           </div>
        </div>
      )}
    </div>
  );
}
