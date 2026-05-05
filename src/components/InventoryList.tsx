import { useState, useRef, FormEvent } from 'react';
import { Inventory } from '../types';
import { 
  Plus, 
  Search, 
  Minus,
  Edit2, 
  Trash2, 
  MapPin, 
  Box, 
  Calendar,
  X,
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

interface InventoryListProps {
  inventory: Inventory[];
}

const DIVISIONS = ['Finance', 'IT & Tech', 'Operations', 'Marketing', 'Human Resources', 'Security'];

export default function InventoryList({ inventory }: InventoryListProps) {
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [editingItem, setEditingItem] = useState<Inventory | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [qrItem, setQrItem] = useState<Inventory | null>(null);

  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: printRef,
  });

  const singleQRRef = useRef<HTMLDivElement>(null);
  const handlePrintSingleQR = useReactToPrint({
    contentRef: singleQRRef,
  });

  const filteredInventory = inventory.filter(i => 
    i.name.toLowerCase().includes(search.toLowerCase()) || 
    i.barcode.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (id: string, name: string) => {
    if (!confirm('Hapus item inventaris ini?')) return;
    try {
      await deleteDoc(doc(db, 'inventory', id));
      await logActivity(ActivityAction.DELETE_INVENTORY, id, name);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `inventory/${id}`);
    }
  };

  const handleUpdateQuantity = async (id: string, delta: number, name: string) => {
    const item = inventory.find(i => i.id === id);
    if (!item) return;
    const newQty = Math.max(0, item.quantity + delta);
    try {
      await updateDoc(doc(db, 'inventory', id), {
        quantity: newQty,
        updatedAt: serverTimestamp()
      });
      await logActivity(ActivityAction.UPDATE_INVENTORY, id, name, `Update stok: ${item.quantity} -> ${newQty}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `inventory/${id}`);
    }
  };

  const handleSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsUploading(true);
    try {
      const formData = new FormData(e.currentTarget);
      const itemPhoto = (e.currentTarget.elements.namedItem('itemPhoto') as HTMLInputElement).files?.[0];
      const docPhoto = (e.currentTarget.elements.namedItem('docPhoto') as HTMLInputElement).files?.[0];

      let imageUrl = editingItem?.image || null;
      let docImageUrl = editingItem?.documentImage || null;

      if (itemPhoto) {
        imageUrl = await uploadImage(itemPhoto, 'inventory/items');
      }
      if (docPhoto) {
        docImageUrl = await uploadImage(docPhoto, 'inventory/docs');
      }

      const itemData = {
        name: formData.get('name') as string,
        barcode: formData.get('barcode') as string,
        category: formData.get('category') as string,
        division: formData.get('division') as string,
        quantity: Number(formData.get('quantity')),
        minQuantity: Number(formData.get('minQuantity')),
        unit: formData.get('unit') as string,
        purchasePrice: Number(formData.get('purchasePrice')),
        currentPrice: Number(formData.get('currentPrice')),
        location: formData.get('location') as string,
        image: imageUrl,
        documentImage: docImageUrl,
        updatedAt: serverTimestamp(),
      };

      if (editingItem) {
        await updateDoc(doc(db, 'inventory', editingItem.id), itemData);
        await logActivity(ActivityAction.UPDATE_INVENTORY, editingItem.id, itemData.name);
      } else {
        const docRef = await addDoc(collection(db, 'inventory'), {
          ...itemData,
          createdAt: serverTimestamp(),
        });
        await logActivity(ActivityAction.CREATE_INVENTORY, docRef.id, itemData.name);
      }
      setIsModalOpen(false);
      setEditingItem(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'inventory');
    } finally {
      setIsUploading(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const selectedItems = inventory.filter(i => selectedIds.includes(i.id));

  return (
    <div className="space-y-6">
      <div style={{ display: 'none' }}>
        <QRPrint ref={printRef} items={selectedItems} />
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Cari alat/bahan..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm transition-all"
          />
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
              setEditingItem(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-lg active:scale-95 font-semibold"
          >
            <Plus size={20} />
            <span>Tambah Stock</span>
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-6 py-4 w-10"></th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Item</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Stock</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Divisi & Lokasi</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Harga (Terkini)</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredInventory.map((item) => (
              <tr key={item.id} className={cn(
                "hover:bg-gray-50/50 transition-colors group",
                selectedIds.includes(item.id) && "bg-blue-50/10"
              )}>
                <td className="px-6 py-4">
                  <input 
                    type="checkbox" 
                    checked={selectedIds.includes(item.id)}
                    onChange={() => toggleSelect(item.id)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" 
                  />
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    {item.image ? (
                      <div className="h-10 w-10 rounded-lg overflow-hidden border border-gray-100 shadow-sm">
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className={cn(
                        "h-10 w-10 rounded-lg flex items-center justify-center shadow-sm",
                        item.quantity <= item.minQuantity ? "bg-red-50 text-red-500" : "bg-blue-50 text-blue-500"
                      )}>
                        <Box size={20} />
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-gray-900">{item.name}</p>
                        {item.documentImage && (
                          <a href={item.documentImage} target="_blank" rel="noopener noreferrer" title="Lihat Surat/Dokumen" className="text-orange-500 hover:text-orange-600">
                             <FileText size={14} />
                          </a>
                        )}
                      </div>
                      <p className="text-xs font-mono text-gray-400 capitalize tracking-tighter">#{item.barcode}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-center gap-3">
                    <button 
                      onClick={() => handleUpdateQuantity(item.id, -1, item.name)}
                      className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors border border-transparent hover:border-red-100"
                    >
                      <Minus size={16} />
                    </button>
                    <div className="text-center min-w-[40px]">
                      <p className={cn(
                        "text-lg font-bold leading-none",
                        item.quantity <= item.minQuantity ? "text-red-600" : "text-gray-900"
                      )}>{item.quantity}</p>
                      <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">{item.unit}</p>
                    </div>
                    <button 
                      onClick={() => handleUpdateQuantity(item.id, 1, item.name)}
                      className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors border border-transparent hover:border-green-100"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-blue-600 font-bold uppercase tracking-widest">
                       {item.division || 'General'}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-gray-500">
                      <MapPin size={12} />
                      {item.location}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <p className="text-sm font-bold text-gray-900">{formatCurrency(item.currentPrice || item.purchasePrice || 0)}</p>
                  <p className="text-[10px] text-gray-400">Update: {formatDate(item.updatedAt)}</p>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => setQrItem(item)}
                      className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                      title="Generate QR"
                    >
                      <QrCode size={16} />
                    </button>
                    <button onClick={() => { setEditingItem(item); setIsModalOpen(true); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 size={16} /></button>
                    <button onClick={() => handleDelete(item.id, item.name)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                <h2 className="text-xl font-bold">{editingItem ? 'Edit Item Stock' : 'Tambah Stock Baru'}</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><X size={20} /></button>
              </div>
              <form onSubmit={handleSave} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-gray-900 uppercase tracking-wider mb-2 flex items-center gap-2">
                       <MapPin size={14} className="text-blue-500" /> Lokasi Barang / Gedung (WAJIB)
                    </label>
                    <input name="location" required placeholder="Gedung A, Lantai 2, Ruang Rapat, dll" defaultValue={editingItem?.location} className="w-full px-4 py-3 bg-blue-50 border-2 border-blue-100 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 font-bold" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Nama Barang</label>
                    <input name="name" required defaultValue={editingItem?.name} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Barcode</label>
                    <input name="barcode" required defaultValue={editingItem?.barcode} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Divisi</label>
                    <select name="division" defaultValue={editingItem?.division} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg">
                      {DIVISIONS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Unit (PCS, KG, Lt, dll)</label>
                    <input name="unit" required defaultValue={editingItem?.unit} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Jumlah Awal</label>
                    <input name="quantity" type="number" required defaultValue={editingItem?.quantity} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Minimal Stok (Alert)</label>
                    <input name="minQuantity" type="number" required defaultValue={editingItem?.minQuantity} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Harga Beli (IDR)</label>
                    <input name="purchasePrice" type="number" defaultValue={editingItem?.purchasePrice} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Harga Terkini (IDR)</label>
                    <input name="currentPrice" type="number" defaultValue={editingItem?.currentPrice || editingItem?.purchasePrice} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Kategori</label>
                    <input name="category" defaultValue={editingItem?.category} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg" />
                  </div>

                  <div className="col-span-2 p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-4">
                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                       <Upload size={14} /> Media & Dokumen Pendukung
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Foto Barang</label>
                        <div className="relative group">
                          <input type="file" name="itemPhoto" accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                          <div className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-200 rounded-xl group-hover:border-blue-400 group-hover:bg-blue-50 transition-all">
                             <Camera size={20} className="text-gray-400 group-hover:text-blue-500 mb-1" />
                             <span className="text-[10px] font-bold text-gray-400 group-hover:text-blue-600">Pilih Foto</span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Foto Surat/Invoice</label>
                        <div className="relative group">
                          <input type="file" name="docPhoto" accept="image/*,application/pdf" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                          <div className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-200 rounded-xl group-hover:border-orange-400 group-hover:bg-orange-50 transition-all">
                             <FileText size={20} className="text-gray-400 group-hover:text-orange-500 mb-1" />
                             <span className="text-[10px] font-bold text-gray-400 group-hover:text-orange-600">Pilih Surat</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2 text-gray-600 font-semibold hover:bg-gray-100 rounded-lg transition-colors">Batal</button>
                  <button 
                    type="submit" 
                    disabled={isUploading}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
                <h3 className="font-black text-gray-900 uppercase tracking-tight">QR Code Item</h3>
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

      {/* Hidden Bulk QR Print Area */}
      <div className="hidden">
        <QRPrint 
          ref={printRef} 
          items={inventory.filter(i => selectedIds.includes(i.id))} 
        />
      </div>
    </div>
  );
}
