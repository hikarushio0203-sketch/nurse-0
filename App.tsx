import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Users, Ban, CalendarDays, Download, Upload, Wand2, RefreshCw, Edit3, Trash2 } from 'lucide-react';
import { Staff, Schedule, ShiftType, ShiftDef, LockedCells, NgPair, AppSettings, TabType, ModeType } from './types';
import { DEFAULT_SHIFTS, DEFAULT_STAFF } from './constants';
import { generateSchedule } from './services/schedulerService';
import { ScheduleTable } from './components/ScheduleTable';
import { StaffSettings } from './components/StaffSettings';
import { NgSettings } from './components/NgSettings';
import { Modal, ModalConfig } from './components/Modal';

export default function App() {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [staffList, setStaffList] = useState<Staff[]>(DEFAULT_STAFF);
  const [shiftTypes, setShiftTypes] = useState<ShiftDef[]>(DEFAULT_SHIFTS);
  const [schedule, setSchedule] = useState<Schedule>({});
  const [lockedCells, setLockedCells] = useState<LockedCells>({});
  const [selectedTool, setSelectedTool] = useState<string>('day');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [genStatus, setGenStatus] = useState<string>('');
  const [mode, setMode] = useState<ModeType>('request');
  const [activeTab, setActiveTab] = useState<TabType>('schedule');
  const [ngPairs, setNgPairs] = useState<NgPair[]>([]);
  
  // Settings
  const [settings, setSettings] = useState<AppSettings>({
    targetNight: 4,
    targetLate: 4,
    targetDayWeekday: 14,
    targetDayWeekend: 8
  });

  // Modal State
  const [modalConfig, setModalConfig] = useState<ModalConfig>({ 
    isOpen: false, 
    title: '', 
    message: '', 
    type: 'alert', 
    onConfirm: null 
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Persistence
  useEffect(() => {
    const savedData = localStorage.getItem('nurseSchedulerData_v34_ts');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        if (parsed.schedule) setSchedule(parsed.schedule);
        if (parsed.lockedCells) setLockedCells(parsed.lockedCells);
        if (parsed.currentDate) setCurrentDate(new Date(parsed.currentDate));
        if (parsed.staffList && parsed.staffList.length > 0) setStaffList(parsed.staffList);
        if (parsed.ngPairs) setNgPairs(parsed.ngPairs);
        if (parsed.settings) setSettings(parsed.settings);
      } catch (e) { 
        console.error("Failed to load data", e); 
      }
    }
  }, []);

  useEffect(() => {
    const dataToSave = {
      schedule,
      staffList,
      shiftTypes,
      lockedCells,
      ngPairs,
      currentDate: currentDate.toISOString(),
      settings
    };
    localStorage.setItem('nurseSchedulerData_v34_ts', JSON.stringify(dataToSave));
  }, [schedule, staffList, shiftTypes, lockedCells, ngPairs, currentDate, settings]);

  const showMessage = useCallback((title: string, message: string) => {
    setModalConfig({ isOpen: true, title, message, type: 'alert', onConfirm: null });
  }, []);

  const showConfirm = useCallback((title: string, message: string, onConfirm: () => void) => {
    setModalConfig({ isOpen: true, title, message, type: 'confirm', onConfirm });
  }, []);

  const closeModal = useCallback(() => {
    setModalConfig(prev => ({ ...prev, isOpen: false }));
  }, []);

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.value) return;
    const [y, m] = e.target.value.split('-').map(Number);
    setCurrentDate(new Date(y, m - 1, 1));
  };

  const handleExport = () => {
    const data = { 
      schedule, staffList, shiftTypes, lockedCells, ngPairs, 
      currentDate: currentDate.toISOString(), 
      settings 
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `シフト表_${currentDate.getFullYear()}年${currentDate.getMonth() + 1}月.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportTrigger = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const result = event.target?.result as string;
        const parsed = JSON.parse(result);
        
        if (!parsed.schedule && !parsed.staffList) {
          throw new Error('無効なファイル形式');
        }

        if (parsed.schedule) setSchedule(parsed.schedule);
        if (parsed.staffList) setStaffList(parsed.staffList);
        if (parsed.shiftTypes) setShiftTypes(parsed.shiftTypes);
        if (parsed.lockedCells) setLockedCells(parsed.lockedCells);
        if (parsed.ngPairs) setNgPairs(parsed.ngPairs);
        if (parsed.currentDate) setCurrentDate(new Date(parsed.currentDate));
        if (parsed.settings) setSettings(parsed.settings);
        
        showMessage('完了', 'ファイルを正常に読み込みました。');
      } catch (err) {
        showMessage('エラー', 'ファイルの読み込みに失敗しました。');
        console.error(err);
      }
    };
    reader.readAsText(file);
    e.target.value = ''; 
  };

  const clearSchedule = () => {
    showConfirm('確認', '全てのシフトをクリアしますか？\nこの操作は取り消せません。', () => {
      setSchedule({});
      setLockedCells({});
    });
  };

  const handleAutoGenerate = async () => {
    setIsGenerating(true);
    setGenStatus('処理中...');
    
    // Allow UI to update before heavy calculation
    await new Promise(r => setTimeout(r, 50));

    try {
      const result = generateSchedule({
        currentSchedule: schedule,
        lockedCells,
        staffList,
        year: currentDate.getFullYear(),
        month: currentDate.getMonth(),
        targetSettings: settings,
        ngPairs
      });
      
      setSchedule(result);
      setGenStatus('完了');
    } catch (e) {
      setGenStatus('エラー');
      console.error(e);
      showMessage('エラー', '自動作成中にエラーが発生しました。');
    } finally {
      setTimeout(() => { 
        setIsGenerating(false); 
        setGenStatus(''); 
      }, 1000);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-slate-50 text-gray-800 font-sans">
      <header className="bg-slate-800 text-white p-3 shadow-md flex justify-between items-center z-30">
        <div className="flex items-center gap-2">
          <Users className="h-6 w-6 text-orange-400" />
          <h1 className="text-xl font-bold tracking-wide">
            NurseShift Pro <span className="text-xs font-normal text-gray-400 ml-1">v34.0</span>
          </h1>
        </div>
        
        <div className="flex bg-slate-700 p-1 rounded">
          <button onClick={() => setActiveTab('schedule')} className={`px-3 py-1 text-sm rounded font-bold transition ${activeTab === 'schedule' ? 'bg-white text-slate-800 shadow' : 'text-slate-300 hover:text-white'}`}>シフト表</button>
          <button onClick={() => setActiveTab('staff')} className={`px-3 py-1 text-sm rounded font-bold transition ${activeTab === 'staff' ? 'bg-white text-slate-800 shadow' : 'text-slate-300 hover:text-white'}`}>スタッフ</button>
          <button onClick={() => setActiveTab('ng')} className={`px-3 py-1 text-sm rounded font-bold transition flex items-center gap-1 ${activeTab === 'ng' ? 'bg-white text-red-600 shadow' : 'text-slate-300 hover:text-white'}`}>
            <Ban size={14} /> NG設定
          </button>
        </div>
      </header>

      <div className="bg-white border-b shadow-sm z-10 flex flex-col">
        {activeTab === 'schedule' && (
          <div className="p-3 flex flex-wrap items-center justify-between gap-4 border-b border-gray-100">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setMode(mode === 'request' ? 'view' : 'request')}
                className={`flex items-center px-4 py-2 rounded-lg font-bold transition-all shadow-sm text-sm
                ${mode === 'request' ? 'bg-blue-600 text-white ring-2 ring-blue-300' : 'bg-white text-gray-700 border border-gray-300'}`}
              >
                <Edit3 size={16} className="mr-2" />
                {mode === 'request' ? '勤務希望入力中...' : '勤務希望入力'}
              </button>
              
              <div className="flex items-center bg-slate-100 rounded px-2 py-1 border border-slate-200">
                <CalendarDays size={16} className="text-slate-500 mr-2"/>
                <input 
                  type="month" 
                  className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer"
                  value={`${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`}
                  onChange={handleMonthChange}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm overflow-x-auto">
              <span className="font-bold text-gray-700 hidden sm:inline whitespace-nowrap">目標設定:</span>
              <div className="flex gap-2">
                <div className="flex items-center gap-1 bg-orange-50 px-2 py-1 rounded border border-orange-100">
                  <span className="text-[10px] font-bold text-orange-700 whitespace-nowrap">平日日勤</span>
                  <input type="number" value={settings.targetDayWeekday} onChange={(e) => setSettings({...settings, targetDayWeekday: Number(e.target.value)})} className="w-10 text-xs text-center border rounded font-bold" />
                </div>
                <div className="flex items-center gap-1 bg-red-50 px-2 py-1 rounded border border-red-100">
                  <span className="text-[10px] font-bold text-red-700 whitespace-nowrap">休日日勤</span>
                  <input type="number" value={settings.targetDayWeekend} onChange={(e) => setSettings({...settings, targetDayWeekend: Number(e.target.value)})} className="w-10 text-xs text-center border rounded font-bold" />
                </div>
                <div className="flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded border border-indigo-100">
                  <span className="text-[10px] font-bold text-indigo-700 whitespace-nowrap">深夜</span>
                  <input type="number" value={settings.targetNight} onChange={(e) => setSettings({...settings, targetNight: Number(e.target.value)})} className="w-10 text-xs text-center border rounded font-bold" />
                </div>
                <div className="flex items-center gap-1 bg-purple-50 px-2 py-1 rounded border border-purple-100">
                  <span className="text-[10px] font-bold text-purple-700 whitespace-nowrap">準夜</span>
                  <input type="number" value={settings.targetLate} onChange={(e) => setSettings({...settings, targetLate: Number(e.target.value)})} className="w-10 text-xs text-center border rounded font-bold" />
                </div>
              </div>
            </div>

            <div className="flex gap-2 ml-auto">
              <div className="flex bg-slate-100 rounded p-0.5 border border-slate-200">
                <button onClick={handleExport} className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-white rounded transition flex items-center gap-1 text-xs font-bold" title="保存">
                  <Download size={14} /> 保存
                </button>
                <div className="w-px bg-slate-300 my-1"></div>
                <button onClick={handleImportTrigger} className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-white rounded transition flex items-center gap-1 text-xs font-bold" title="読込">
                  <Upload size={14} /> 読込
                </button>
                <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleImportFile} />
              </div>

              {isGenerating && <span className="text-xs text-orange-600 font-bold animate-pulse self-center mr-2">{genStatus}</span>}
              <button 
                onClick={handleAutoGenerate} 
                disabled={isGenerating} 
                className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-2 rounded shadow-sm font-bold flex items-center disabled:opacity-50 hover:from-orange-600 hover:to-red-600 transition"
              >
                <Wand2 size={16} className={`mr-2 ${isGenerating ? 'animate-spin' : ''}`} /> 自動作成
              </button>
              <button onClick={clearSchedule} className="p-2 text-gray-400 hover:text-red-500 transition"><RefreshCw size={18}/></button>
            </div>
          </div>
        )}
        
        {activeTab === 'schedule' && mode === 'request' && (
          <div className="bg-blue-50 p-2 flex items-center gap-2 overflow-x-auto border-b border-blue-100">
            <span className="text-xs font-bold text-blue-800 whitespace-nowrap ml-2">希望を選択:</span>
            {shiftTypes.map(shift => (
              <button 
                key={shift.id} 
                onClick={() => setSelectedTool(shift.id)} 
                className={`flex items-center px-3 py-1.5 rounded-full border transition-all text-xs font-bold whitespace-nowrap ${selectedTool === shift.id ? `${shift.color} ring-2 ring-blue-400 scale-105` : 'bg-white text-gray-500'}`}
              >
                {shift.symbol} {shift.name}
              </button>
            ))}
            <button 
              onClick={() => setSelectedTool('eraser')} 
              className={`flex items-center px-3 py-1.5 rounded-full border text-xs font-bold transition-all ${selectedTool === 'eraser' ? 'bg-gray-700 text-white ring-2 ring-gray-400' : 'bg-white text-gray-600'}`}
            >
              <Trash2 size={12} className="mr-1" />解除
            </button>
          </div>
        )}
      </div>

      <main className="flex-1 overflow-hidden relative flex flex-col">
        {activeTab === 'schedule' && (
          <ScheduleTable 
            currentDate={currentDate}
            staffList={staffList}
            schedule={schedule}
            lockedCells={lockedCells}
            shiftTypes={shiftTypes}
            mode={mode}
            selectedTool={selectedTool}
            settings={settings}
            ngPairs={ngPairs}
            setSchedule={setSchedule}
            setLockedCells={setLockedCells}
            showMessage={showMessage}
          />
        )}
        {activeTab === 'staff' && (
          <StaffSettings 
            staffList={staffList} 
            setStaffList={setStaffList}
            setSchedule={setSchedule}
            setLockedCells={setLockedCells}
            setNgPairs={setNgPairs}
            schedule={schedule}
            lockedCells={lockedCells}
            ngPairs={ngPairs}
            showMessage={showMessage}
            showConfirm={showConfirm}
          />
        )}
        {activeTab === 'ng' && (
          <NgSettings 
            staffList={staffList}
            ngPairs={ngPairs}
            setNgPairs={setNgPairs}
            showMessage={showMessage}
          />
        )}
      </main>

      <Modal 
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
        onConfirm={modalConfig.onConfirm}
        onClose={closeModal}
      />
    </div>
  );
}