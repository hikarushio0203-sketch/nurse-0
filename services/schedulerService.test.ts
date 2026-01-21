import { describe, it, expect } from 'vitest';
import { generateSchedule } from './schedulerService';
import { Staff, AppSettings, Schedule, LockedCells, NgPair } from '../types';

// Mock Staff Data
const mockStaff: Staff[] = [
  { id: 1, name: 'Staff 1', role: 'Ns', shiftSystem: '2shift' },
  { id: 2, name: 'Staff 2', role: 'Ns', shiftSystem: '3shift' },
  { id: 3, name: 'Staff 3', role: 'Ns', shiftSystem: '3shift' },
  { id: 4, name: 'Staff 4', role: 'Ns', shiftSystem: '2shift' },
  { id: 5, name: 'Staff 5', role: 'Ns', shiftSystem: '3shift' },
  { id: 6, name: 'Staff 6', role: 'Ns', shiftSystem: '2shift' },
];

// Mock Settings
const mockSettings: AppSettings = {
  targetNight: 1,
  targetLate: 1,
  targetDayWeekday: 2,
  targetDayWeekend: 2
};

// Mock Dates (April 2024 has 30 days)
const year = 2024;
const month = 3; // 0-indexed, so April

describe('schedulerService', () => {
  it('should generate a complete schedule for all staff and days', () => {
    const result = generateSchedule({
      currentSchedule: {},
      lockedCells: {},
      staffList: mockStaff,
      year,
      month,
      targetSettings: mockSettings,
      ngPairs: []
    });

    const daysInMonth = 30;
    mockStaff.forEach(staff => {
      for (let d = 1; d <= daysInMonth; d++) {
        expect(result[`${staff.id}_${d}`]).toBeDefined();
      }
    });
  });

  it('should respect locked cells', () => {
    const lockedCells: LockedCells = { '2_5': true };
    const currentSchedule: Schedule = { '2_5': 'off' };
    
    const result = generateSchedule({
      currentSchedule,
      lockedCells,
      staffList: mockStaff,
      year,
      month,
      targetSettings: mockSettings,
      ngPairs: []
    });

    expect(result['2_5']).toBe('off');
  });

  it('should enforce 2-shift logic: Late must be followed by Night', () => {
    const staff2shift = mockStaff.filter(s => s.shiftSystem === '2shift');
    const result = generateSchedule({
      currentSchedule: {},
      lockedCells: {},
      staffList: mockStaff,
      year,
      month,
      targetSettings: mockSettings,
      ngPairs: []
    });

    const daysInMonth = 30;
    staff2shift.forEach(staff => {
      for (let d = 1; d < daysInMonth; d++) {
        if (result[`${staff.id}_${d}`] === 'late') {
          // Verify strict 2-shift rule: Late -> Night
          // Note: If day+1 was locked to something else, this might fail, but here we have no locks
          expect(result[`${staff.id}_${d + 1}`]).toBe('night');
        }
      }
    });
  });

  it('should enforce 3-shift logic: Night requires Day before', () => {
    const staff3shift = mockStaff.filter(s => s.shiftSystem === '3shift');
    const result = generateSchedule({
      currentSchedule: {},
      lockedCells: {},
      staffList: mockStaff,
      year,
      month,
      targetSettings: mockSettings,
      ngPairs: []
    });

    staff3shift.forEach(staff => {
      for (let d = 2; d <= 30; d++) {
        if (result[`${staff.id}_${d}`] === 'night') {
           // In an empty schedule generation, the generator puts 'day' before 'night'
           expect(result[`${staff.id}_${d - 1}`]).toBe('day');
        }
      }
    });
  });

  it('should prevent NG pairs from having night shifts on the same day', () => {
    // NG Pair between Staff 2 (3shift) and Staff 3 (3shift)
    const ngPairs: NgPair[] = [{ id: 100, staff1: 2, staff2: 3 }];
    
    // Increase targets to force density
    const heavySettings = { ...mockSettings, targetNight: 2 }; 

    const result = generateSchedule({
      currentSchedule: {},
      lockedCells: {},
      staffList: mockStaff,
      year,
      month,
      targetSettings: heavySettings,
      ngPairs
    });

    const daysInMonth = 30;
    const isNight = (s: string) => s === 'night' || s === 'late';

    for (let d = 1; d <= daysInMonth; d++) {
      const s1 = result[`2_${d}`];
      const s2 = result[`3_${d}`];
      
      const bothNight = isNight(s1) && isNight(s2);
      expect(bothNight).toBe(false);
    }
  });

  it('should attempt to meet target settings', () => {
     const result = generateSchedule({
      currentSchedule: {},
      lockedCells: {},
      staffList: mockStaff,
      year,
      month,
      targetSettings: mockSettings,
      ngPairs: []
    });

    // Check a sample day to ensure shifts are being assigned
    let nightCount = 0;
    for (const staff of mockStaff) {
      if (result[`${staff.id}_15`] === 'night') nightCount++;
    }
    // We requested 1 night, checking if at least 1 was assigned
    expect(nightCount).toBeGreaterThanOrEqual(1);
  });
});
