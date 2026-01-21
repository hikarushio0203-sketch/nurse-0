import React from 'react';
import { Lock, AlertTriangle, XCircle } from 'lucide-react';
import { Staff, Schedule, ShiftDef, LockedCells, AppSettings, NgPair } from '../types';
import { getDaysInMonth, getDayOfWeek, isWeekendOrHoliday } from '../utils/dateUtils';
import { MAX_LATE_PER_STAFF, MAX_NIGHT_PER_STAFF } from '../constants';

interface ScheduleTableProps {
  currentDate: Date;
  staffList: Staff[];
  schedule: Schedule;
  lockedCells: LockedCells;
  shiftTypes: ShiftDef[];
  mode: 'view' | 'request';
  selectedTool: string;
  settings: AppSettings;
  ngPairs: NgPair[];
  setSchedule: (s: Schedule) => void;
  setLockedCells: (l: LockedCells) => void;
  showMessage: (title: string, msg: string) => void;
}

export const ScheduleTable: React.FC<ScheduleTableProps> = ({
  currentDate, staffList, schedule, lockedCells, shiftTypes, mode, selectedTool, settings, ngPairs, setSchedule, setLockedCells, showMessage
}) => {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const isWork = (shiftId: string) => shiftId && shiftId !== 'off' && shiftId !== 'paid';
  const isOff = (shiftId: string) => shiftId === 'off' || shiftId === 'paid';
  const isNightShift = (shiftId: string) => shiftId === 'night' || shiftId === 'late';
  const getShift = (sId: number, d: number) => schedule[`${sId}_${d}`];

  // 公休の目標数を土日の数に固定
  const calculatePersonalOffTarget = () => {
    return daysArray.filter(d => {
        const dayOfWeek = new Date(year, month, d).getDay();
        return dayOfWeek === 0 || dayOfWeek === 6; // 0:Sun, 6:Sat
    }).length;
  };

  const checkWarnings = (staffId: number, day: number) => {
    if (day === 1) return null;
    const today = schedule[`${staffId}_${day}`];
    const prev = schedule[`${staffId}_${day - 1}`];
    const staff = staffList.find(s => s.id === staffId);
    if (!today || !prev) return null;

    if (isWork(today)) {
        let consecutiveWork = 1;
        for (let i = 1; i <= 6; i++) {
            if (day - i < 1) break;
            if (isWork(schedule[`${staffId}_${day - i}`])) consecutiveWork++; else break;
        }
        if (consecutiveWork > 5) return '5連勤超過';
    }

    if (staff?.shiftSystem === '3shift') {
        if (today === 'night' && prev !== 'day') return '深夜の前は日勤が必要です';
        if (prev === 'night' && today !== 'late' && !isOff(today)) return '深夜の次は準夜か休み推奨';
        if (prev === 'late' && !isOff(today)) return '準→休(3交)';
    }
    if (staff?.shiftSystem === '2shift') {
        if (prev === 'late' && today !== 'night') return '準→深(2交)';
        if (prev === 'night' && !isOff(today)) return '深→休(2交)';
    }

    if (isNightShift(today)) {
        const conflict = ngPairs.find(pair => {
            const partnerId = (pair.staff1 === staffId) ? pair.staff2 : (pair.staff2 === staffId) ? pair.staff1 : null;
            if (partnerId) {
                const partnerShift = schedule[`${partnerId}_${day}`];
                return isNightShift(partnerShift);
            }
            return false;
        });
        if (conflict) return 'NGペア重複';
    }
    return null;
  };

  const handleCellClick = (staffId: number, day: number) => {
    const key = `${staffId}_${day}`;
    if (selectedTool === 'eraser') {
        const newSchedule = { ...schedule };
        delete newSchedule[key];
        setSchedule(newSchedule);
        const newLocked = { ...lockedCells };
        delete newLocked[key];
        setLockedCells(newLocked);
        return;
    }

    if (mode === 'request') {
        const currentShift = schedule[key];
        if (currentShift !== selectedTool) {
            const currentCount = staffList.filter(s => schedule[`${s.id}_${day}`] === selectedTool).length;
            if (selectedTool === 'night' && currentCount >= settings.targetNight) {
                showMessage('注意', `深夜は1日${settings.targetNight}人までです。`);
                return;
            }
            if (selectedTool === 'late' && currentCount >= settings.targetLate) {
                showMessage('注意', `準夜は1日${settings.targetLate}人までです。`);
                return;
            }
        }
    }

    const newSchedule = { ...schedule, [key]: selectedTool };
    const newLocked = { ...lockedCells, [key]: true };

    const staff = staffList.find(s => s.id === staffId);
    if (staff?.shiftSystem === '3shift' && selectedTool === 'night') {
        if (day > 1) {
            const prevKey = `${staffId}_${day - 1}`;
            if (!newSchedule[prevKey] || newSchedule[prevKey] === 'day') {
                newSchedule[prevKey] = 'day';
            }
        }
    }

    setSchedule(newSchedule);
    setLockedCells(newLocked);
  };

  const getStaffStats = (staffId: number) => {
    let night = 0, late = 0, dayShift = 0, off = 0;
    daysArray.forEach(d => {
        const s = getShift(staffId, d);
        if(s === 'night') night++;
        else if(s === 'late') late++;
        else if(s === 'day') dayShift++;
        else if(s === 'off' || s === 'paid') off++;
    });
    return { night, late, day: dayShift, off };
  };

  const getDailyStats = (day: number) => {
    const stats: any = { night: 0, late: 0, day: 0 };
    staffList.forEach(staff => {
      const shiftId = schedule[`${staff.id}_${day}`];
      if (stats[shiftId] !== undefined) stats[shiftId]++;
    });
    return stats;
  };

  return (
    <div className="flex-1 overflow-auto bg-slate-100 p-4">
      <div className="bg-white rounded-lg shadow-sm border border-gray-300 inline-block min-w-full">
        <table className="border-collapse w-full text-xs">
          <thead>
            <tr className="bg-slate-50 sticky top-0 z-20 shadow-sm">
              <th className="sticky left-0 z-30 bg-slate-50 border-b border-r border-gray-300 p-2 w-32 text-left font-bold text-gray-700">スタッフ</th>
              {daysArray.map(day => {
                const isHol = isWeekendOrHoliday(year, month, day);
                const dayOfWeek = getDayOfWeek(year, month, day);
                const colorClass = isHol && dayOfWeek !== '土' ? 'text-red-600 bg-red-50' : dayOfWeek === '土' ? 'text-blue-600 bg-blue-50' : 'text-gray-600';
                return (
                  <th key={day} className={`border-b border-r border-gray-200 p-1 w-7 min-w-[28px] text-center ${colorClass}`}>
                    <div>{day}</div>
                    <div className="text-[9px]">{dayOfWeek}</div>
                  </th>
                );
              })}
              <th className="border-b border-l-2 border-l-gray-300 border-r border-gray-200 bg-orange-100 text-orange-800 w-8 font-bold">日</th>
              <th className="border-b border-r border-gray-200 bg-purple-100 text-purple-800 w-8 font-bold">準</th>
              <th className="border-b border-r border-gray-200 bg-indigo-100 text-indigo-800 w-8 font-bold">深</th>
              <th className="border-b border-r border-gray-200 bg-gray-100 text-gray-600 w-16 font-bold text-center">公休</th>
            </tr>
          </thead>
          <tbody>
            {staffList.map(staff => {
              const stats = getStaffStats(staff.id);
              const targetOff = calculatePersonalOffTarget();
              const diff = stats.off - targetOff;
              const offColor = diff === 0 ? 'text-green-600 bg-green-50' : diff < 0 ? 'text-red-600 bg-red-50' : 'text-blue-600 bg-blue-50';
              const nightWarn = stats.night > MAX_NIGHT_PER_STAFF ? 'bg-red-200 text-red-900' : '';
              const lateWarn = stats.late > MAX_LATE_PER_STAFF ? 'bg-red-200 text-red-900' : '';

              return (
                <tr key={staff.id} className="hover:bg-yellow-50 transition-colors bg-white group">
                  <td className="sticky left-0 z-10 bg-white border-b border-r border-gray-300 p-1 px-2 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] group-hover:bg-yellow-50 transition-colors">
                    <div className="font-bold text-gray-800 flex justify-between items-center">
                      <span>{staff.name}</span>
                      <span className={`text-[9px] px-1 rounded ${staff.shiftSystem==='2shift'?'bg-blue-100 text-blue-800':'bg-purple-100 text-purple-800'}`}>{staff.shiftSystem==='2shift'?'2交':'3交'}</span>
                    </div>
                  </td>
                  {daysArray.map(day => {
                    const shiftId = schedule[`${staff.id}_${day}`];
                    const shift = shiftTypes.find(s => s.id === shiftId);
                    const warning = checkWarnings(staff.id, day);
                    const isLocked = lockedCells[`${staff.id}_${day}`];
                    const cellClass = mode === 'request' ? 'cursor-pointer hover:bg-blue-50' : 'cursor-default';
                    return (
                      <td key={day} onClick={() => mode === 'request' && handleCellClick(staff.id, day)} className={`border-b border-r border-gray-200 text-center p-0 h-7 relative ${warning ? 'bg-red-100' : ''} ${cellClass}`}>
                        {shift && (
                          <div className={`w-full h-full flex items-center justify-center font-bold ${shift.color} relative`}>
                            {shift.symbol}
                            {isLocked && <div className="absolute top-0.5 left-0.5 text-gray-500 opacity-80"><Lock size={8} /></div>}
                          </div>
                        )}
                        {warning && <div className="absolute bottom-0 right-0 text-red-600 bg-white/50 rounded-full" title={warning}><AlertTriangle size={8} fill="red" /></div>}
                      </td>
                    );
                  })}
                  <td className="border-b border-l-2 border-l-gray-300 border-r border-gray-200 text-center font-bold text-orange-700 bg-orange-50">{stats.day}</td>
                  <td className={`border-b border-r border-gray-200 text-center font-bold text-purple-700 bg-purple-50 ${lateWarn}`}>{stats.late}</td>
                  <td className={`border-b border-r border-gray-200 text-center font-bold text-indigo-700 bg-indigo-50 ${nightWarn}`}>{stats.night}</td>
                  <td className={`border-b border-r border-gray-200 text-center font-bold ${offColor}`}>
                    {stats.off} <span className="text-[10px] text-gray-400">/ {targetOff}</span>
                  </td>
                </tr>
              );
            })}
            
            <tr className="bg-slate-800 text-white font-bold border-t-2 border-slate-600 sticky bottom-0 z-20 shadow-lg">
              <td className="sticky left-0 z-30 bg-slate-800 border-r border-gray-600 p-2 text-right text-[10px] leading-tight">
                <div className="text-orange-300">日勤</div>
                <div className="text-indigo-300">深夜</div>
                <div className="text-purple-300">準夜</div>
              </td>
              {daysArray.map(day => {
                const stats = getDailyStats(day);
                const isLowTarget = isWeekendOrHoliday(year, month, day);
                const targetDay = isLowTarget ? settings.targetDayWeekend : settings.targetDayWeekday;
                
                const dayOk = isLowTarget ? (stats.day === targetDay) : (stats.day >= targetDay);
                const nightOk = stats.night === settings.targetNight;
                const lateOk = stats.late === settings.targetLate;

                const renderStatus = (val: number, ok: boolean, colorClass: string) => (
                    <div className={`flex justify-center items-center ${ok ? colorClass : 'text-red-400 font-extrabold bg-red-900/30'}`}>
                        {val} {!ok && <XCircle size={8} className="ml-0.5"/>}
                    </div>
                );

                return (
                  <td key={`total-${day}`} className={`border-r border-gray-600 p-1 text-center text-[10px] leading-tight ${isLowTarget ? 'bg-slate-700' : ''}`}>
                    {renderStatus(stats.day, dayOk, 'text-orange-400')}
                    {renderStatus(stats.night, nightOk, 'text-indigo-400')}
                    {renderStatus(stats.late, lateOk, 'text-purple-400')}
                  </td>
                );
              })}
              <td colSpan={4} className="bg-slate-800 border-l-2 border-l-gray-600"></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};