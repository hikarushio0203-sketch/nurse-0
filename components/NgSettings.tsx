import React, { useState } from 'react';
import { Ban, X, Plus, Trash2 } from 'lucide-react';
import { Staff, NgPair } from '../types';

interface NgSettingsProps {
  staffList: Staff[];
  ngPairs: NgPair[];
  setNgPairs: (p: NgPair[]) => void;
  showMessage: (t: string, m: string) => void;
}

export const NgSettings: React.FC<NgSettingsProps> = ({ staffList, ngPairs, setNgPairs, showMessage }) => {
  const [selectedStaff1, setSelectedStaff1] = useState<string>('');
  const [selectedStaff2, setSelectedStaff2] = useState<string>('');

  const handleAddNgPair = () => {
    const s1 = Number(selectedStaff1);
    const s2 = Number(selectedStaff2);

    if (s1 && s2 && s1 !== s2) {
      const exists = ngPairs.some(p => 
        (p.staff1 === s1 && p.staff2 === s2) || 
        (p.staff1 === s2 && p.staff2 === s1)
      );
      if (!exists) {
        setNgPairs([...ngPairs, { id: Date.now(), staff1: s1, staff2: s2 }]);
        setSelectedStaff1('');
        setSelectedStaff2('');
      } else {
        showMessage('エラー', 'この組み合わせは既に存在します');
      }
    } else if (s1 === s2 && s1 !== 0) {
      showMessage('エラー', '異なるスタッフを選択してください');
    }
  };

  const handleRemoveNgPair = (id: number) => {
    setNgPairs(ngPairs.filter(p => p.id !== id));
  };

  return (
    <div className="p-6 max-w-4xl mx-auto w-full overflow-auto bg-white rounded-lg shadow mt-4">
      <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-700">
        <Ban className="text-red-500" /> NGペア設定（夜勤かぶり禁止）
      </h2>
      <div className="bg-orange-50 p-4 rounded-lg mb-6 border border-orange-100 text-sm text-gray-600">
        <p className="font-bold text-orange-800 mb-1">【設定方法】</p>
        ここに登録されたスタッフ同士は、自動作成時に「同じ日の夜勤（準夜・深夜）」に割り当てられなくなります。<br/>
        ※すでに確定（ロック）されているシフトや、手動での変更には影響しません（警告のみ表示されます）。
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200 items-end">
        <div className="flex-1 w-full">
          <label className="block text-xs font-bold text-gray-500 mb-1">スタッフA</label>
          <select 
            className="border p-2 rounded w-full text-sm bg-white outline-none focus:ring-2 focus:ring-blue-300"
            value={selectedStaff1}
            onChange={(e) => setSelectedStaff1(e.target.value)}
          >
            <option value="">選択してください</option>
            {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="flex items-center pb-2 text-gray-400 self-center sm:self-end"><X size={20}/></div>
        <div className="flex-1 w-full">
          <label className="block text-xs font-bold text-gray-500 mb-1">スタッフB</label>
          <select 
            className="border p-2 rounded w-full text-sm bg-white outline-none focus:ring-2 focus:ring-blue-300"
            value={selectedStaff2}
            onChange={(e) => setSelectedStaff2(e.target.value)}
          >
            <option value="">選択してください</option>
            {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <button onClick={handleAddNgPair} className="bg-red-500 text-white px-6 py-2 rounded text-sm font-bold hover:bg-red-600 transition flex items-center shadow-sm w-full sm:w-auto justify-center">
          <Plus size={16} className="mr-1" /> 禁止ペア追加
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {ngPairs.length === 0 && <div className="text-center text-gray-400 py-8 col-span-2 bg-gray-50 rounded border border-dashed">登録されたNGペアはありません</div>}
        {ngPairs.map(pair => {
          const s1 = staffList.find(s => s.id === pair.staff1);
          const s2 = staffList.find(s => s.id === pair.staff2);
          if (!s1 || !s2) return null;
          return (
            <div key={pair.id} className="flex justify-between items-center p-3 border rounded-lg bg-white shadow-sm hover:shadow-md transition">
              <div className="flex items-center gap-3">
                <span className="font-bold text-gray-700">{s1.name}</span>
                <Ban size={16} className="text-red-400" />
                <span className="font-bold text-gray-700">{s2.name}</span>
              </div>
              <button onClick={() => handleRemoveNgPair(pair.id)} className="text-gray-400 hover:text-red-500 p-2 rounded-full hover:bg-red-50">
                <Trash2 size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};