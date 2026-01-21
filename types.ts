export type ShiftType = 'day' | 'late' | 'night' | 'off' | 'paid' | string;
export type ShiftSystem = '2shift' | '3shift';

export interface Staff {
  id: number;
  name: string;
  role: string;
  shiftSystem: ShiftSystem;
}

export interface ShiftDef {
  id: ShiftType;
  name: string;
  symbol: string;
  color: string;
  type: 'work' | 'late' | 'night' | 'off';
}

export interface Schedule {
  [key: string]: ShiftType; // key: `${staffId}_${day}`
}

export interface LockedCells {
  [key: string]: boolean;
}

export interface NgPair {
  id: number;
  staff1: number;
  staff2: number;
}

export interface AppSettings {
  targetNight: number;
  targetLate: number;
  targetDayWeekday: number;
  targetDayWeekend: number;
}

export type TabType = 'schedule' | 'staff' | 'ng';
export type ModeType = 'view' | 'request';

export interface DateStats {
  night: number;
  late: number;
  day: number;
}

export interface StaffStats {
  night: number;
  late: number;
  day: number;
  off: number;
}