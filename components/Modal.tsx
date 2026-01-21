import React from 'react';
import { AlertTriangle, Info, X } from 'lucide-react';

export interface ModalConfig {
  isOpen: boolean;
  title: string;
  message: string;
  type: 'alert' | 'confirm';
  onConfirm: (() => void) | null;
}

interface ModalProps extends ModalConfig {
  onClose: () => void;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, title, message, type, onConfirm, onClose }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-sm w-full animate-in fade-in zoom-in duration-200">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            {type === 'confirm' ? <AlertTriangle className="text-orange-500" size={20}/> : <Info className="text-blue-500" size={20}/>}
            {title}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
        </div>
        <div className="p-6">
          <p className="text-gray-600 whitespace-pre-wrap text-sm">{message}</p>
        </div>
        <div className="p-4 border-t bg-gray-50 rounded-b-lg flex justify-end gap-2">
          {type === 'confirm' ? (
            <>
              <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 rounded">キャンセル</button>
              <button onClick={() => { if(onConfirm) onConfirm(); onClose(); }} className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded shadow">OK</button>
            </>
          ) : (
            <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded shadow">閉じる</button>
          )}
        </div>
      </div>
    </div>
  );
};