import { ShiftDef, Staff } from './types';

export const DEFAULT_SHIFTS: ShiftDef[] = [
  { id: 'day', name: '日勤', symbol: '日', color: 'bg-orange-100 text-orange-700 border-orange-200', type: 'work' },
  { id: 'late', name: '準夜', symbol: '準', color: 'bg-purple-100 text-purple-700 border-purple-200', type: 'late' },
  { id: 'night', name: '深夜', symbol: '深', color: 'bg-indigo-100 text-indigo-700 border-indigo-200', type: 'night' },
  { id: 'off', name: '公休', symbol: '休', color: 'bg-gray-100 text-gray-500 border-gray-200', type: 'off' },
  { id: 'paid', name: '有給', symbol: '有', color: 'bg-pink-100 text-pink-600 border-pink-200', type: 'off' },
];

export const DEFAULT_STAFF: Staff[] = Array.from({ length: 35 }, (_, i) => ({
  id: i + 1,
  name: `Ns.${String(i + 1).padStart(2, '0')}`,
  role: i < 3 ? '管理者' : '看護師',
  shiftSystem: i % 2 === 0 ? '2shift' : '3shift' 
}));

export const MAX_NIGHT_PER_STAFF = 5;
export const MAX_LATE_PER_STAFF = 5;