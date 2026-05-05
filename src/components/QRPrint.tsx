import React, { forwardRef } from 'react';
import QRCode from 'react-qr-code';
import { Asset, Inventory } from '../types';

interface QRPrintProps {
  items: (Asset | Inventory)[];
}

export const QRPrint = forwardRef<HTMLDivElement, QRPrintProps>(({ items }, ref) => {
  return (
    <div ref={ref} className="p-8 bg-white grid grid-cols-4 gap-8">
      {items.map((item) => (
        <div key={item.id} className="flex flex-col items-center border border-gray-200 p-4 rounded-lg">
          <div className="bg-white p-2 border-2 border-black mb-2">
            <QRCode value={item.barcode} size={100} level="H" />
          </div>
          <p className="text-[10px] font-bold text-center uppercase tracking-tighter truncate w-full">
            {item.name}
          </p>
          <p className="text-[8px] font-mono text-gray-500">{item.barcode}</p>
          <div className="mt-1 px-1 py-0.5 bg-black text-white text-[7px] font-bold rounded">
            {item.division || 'GENERAL'}
          </div>
        </div>
      ))}
    </div>
  );
});

QRPrint.displayName = 'QRPrint';
