import React, { useState } from 'react';
import { Users, Plus, Edit3, Trash2, Save, X } from 'lucide-react';
import { Staff, Schedule, LockedCells, NgPair, ShiftSystem } from '../types';

interface StaffSettingsProps {
  staffList: Staff[];
  setStaffList: (list: Staff[]) => void;
  setSchedule: (s: Schedule) => void;
  setLockedCells: (l: LockedCells) => void;
  setNgPairs: (p: NgPair[]) => void;
  schedule: Schedule;
  lockedCells: LockedCells;
  ngPairs: NgPair[];
  showMessage: (t: string, m: string) => void;
  showConfirm: (t: string, m: string, cb: () => void) => void;
}

export const StaffSettings: React.FC<StaffSettingsProps> = ({ 
  staffList, setStaffList, setSchedule, setLockedCells, setNgPairs, schedule, lockedCells, ngPairs, showMessage, showConfirm 
}) => {
  const [newStaff, setNewStaff] = useState({ name: '', role: '看護師', shiftSystem: '3shift' as ShiftSystem });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<Staff>>({});
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const handleAddStaff = () => {
    if (!newStaff.name) {
      showMessage('エラー', '名前を入力してください');
      return;
    }
    const staff: Staff = {
      id: Date.now() + Math.random(),
      name: newStaff.name,
      role: newStaff.role,
      shiftSystem: newStaff.shiftSystem
    };
    setStaffList([...staffList, staff]);
    setNewStaff({ ...newStaff, name: '' });
  };

  const handleDeleteStaff = (id: number) => {
    if (deleteConfirmId === id) {
      setStaffList(staffList.filter(s => s.id !== id));
      
      const newSchedule = { ...schedule };
      const newLocked = { ...lockedCells };
      Object.keys(newSchedule).forEach(key => { if(key.startsWith(`${id}_`)) delete newSchedule[key]; });
      Object.keys(newLocked).forEach(key => { if(key.startsWith(`${id}_`)) delete newLocked[key]; });
      setSchedule(newSchedule);
      setLockedCells(newLocked);
      setNgPairs(ngPairs.filter(p => p.staff1 !== id && p.staff2 !== id));
      setDeleteConfirmId(null);
    } else {
      setDeleteConfirmId(id);
      setTimeout(() => setDeleteConfirmId(null), 3000);
    }
  };

  const handleStartEdit = (staff: Staff) => {
    setEditingId(staff.id);
    setEditForm({ ...staff });
    setDeleteConfirmId(null);
  };

  const handleSaveEdit = () => {
    if (editingId && editForm.name) {
      setStaffList(staffList.map(s => s.id === editingId ? { ...s, ...editForm } as Staff : s));
      setEditingId(null);
      setEditForm({});
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto w-full overflow-auto bg-white rounded-lg shadow mt-4">
      <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-700">
        <Users className="text-blue-500" /> スタッフ管理
      </h2>
      
      <div className="flex flex-wrap gap-3 mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200 items-end">
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1">氏名</label>
          <input 
            type="text" 
            className="border p-2 rounded w-40 text-sm outline-none focus:ring-2 focus:ring-blue-300" 
            placeholder="名前" 
            value={newStaff.name}
            onChange={(e) => setNewStaff({...newStaff, name: e.target.value})}
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1">役職</label>
          <select 
            className="border p-2 rounded w-24 text-sm outline-none focus:ring-2 focus:ring-blue-300"
            value={newStaff.role}
            onChange={(e) => setNewStaff({...newStaff, role: e.target.value})}
          >
            <option value="看護師">看護師</option>
            <option value="主任">主任</option>
            <option value="師長">師長</option>
            <option value="助手">助手</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1">勤務形態</label>
          <select 
            className="border p-2 rounded w-24 text-sm outline-none focus:ring-2 focus:ring-blue-300"
            value={newStaff.shiftSystem}
            onChange={(e) => setNewStaff({...newStaff, shiftSystem: e.target.value as ShiftSystem})}
          >
            <option value="3shift">3交代</option>
            <option value="2shift">2交代</option>
          </select>
        </div>
        <button onClick={handleAddStaff} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-bold hover:bg-blue-700 transition flex items-center shadow-sm">
          <Plus size={16} className="mr-1" /> 追加
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {staffList.map(staff => (
          <div key={staff.id} className="flex justify-between items-center p-3 border rounded-lg hover:shadow-md transition-all bg-white">
            {editingId === staff.id ? (
              <div className="flex flex-col gap-2 w-full">
                <input 
                  type="text" 
                  className="border p-1 rounded text-sm w-full outline-none focus:border-blue-400" 
                  value={editForm.name || ''} 
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} 
                />
                <div className="flex gap-2">
                  <select className="border p-1 rounded text-xs w-1/2" value={editForm.role || '看護師'} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}>
                    <option value="看護師">看護師</option>
                    <option value="主任">主任</option>
                    <option value="師長">師長</option>
                    <option value="助手">助手</option>
                  </select>
                  <select className="border p-1 rounded text-xs w-1/2" value={editForm.shiftSystem || '3shift'} onChange={(e) => setEditForm({ ...editForm, shiftSystem: e.target.value as ShiftSystem })}>
                    <option value="3shift">3交代</option>
                    <option value="2shift">2交代</option>
                  </select>
                </div>
                <div className="flex gap-2 justify-end mt-1">
                  <button onClick={handleSaveEdit} className="text-green-600 hover:bg-green-50 p-1 rounded"><Save size={16} /></button>
                  <button onClick={() => setEditingId(null)} className="text-gray-500 hover:bg-gray-100 p-1 rounded"><X size={16} /></button>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <div className="font-bold text-gray-800">{staff.name}</div>
                  <div className="flex gap-2 text-xs mt-1">
                    <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{staff.role}</span>
                    <span className={`px-1.5 py-0.5 rounded border ${staff.shiftSystem === '2shift' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-purple-50 text-purple-700 border-purple-100'}`}>
                      {staff.shiftSystem === '2shift' ? '2交代' : '3交代'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => handleStartEdit(staff)} className="text-blue-400 hover:text-blue-600 p-2 rounded-full hover:bg-blue-50"><Edit3 size={16} /></button>
                  <button 
                    onClick={() => handleDeleteStaff(staff.id)} 
                    className={`p-2 transition-all rounded-full flex items-center justify-center ${deleteConfirmId === staff.id ? 'bg-red-100 text-red-600 font-bold w-16 text-xs' : 'text-gray-400 hover:text-red-500 hover:bg-red-50'}`}
                  >
                    {deleteConfirmId === staff.id ? '削除?' : <Trash2 size={16} />}
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};