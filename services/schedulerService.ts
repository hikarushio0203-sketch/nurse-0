import { Schedule, Staff, LockedCells, AppSettings, NgPair, ShiftType } from '../types';
import { getDaysInMonth, isWeekendOrHoliday, shuffleArray } from '../utils/dateUtils';

interface GenerateParams {
  currentSchedule: Schedule;
  lockedCells: LockedCells;
  staffList: Staff[];
  year: number;
  month: number;
  targetSettings: AppSettings;
  ngPairs: NgPair[];
}

export const generateSchedule = ({
  currentSchedule, lockedCells, staffList, year, month, targetSettings, ngPairs
}: GenerateParams): Schedule => {
  
  const daysInMonth = getDaysInMonth(year, month);
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const tempSchedule: Schedule = { ...currentSchedule };

  // Remove unlocked cells
  for (const key in tempSchedule) {
    if (!lockedCells[key]) delete tempSchedule[key];
  }

  // --- Helper Functions ---
  const isNightShift = (shift: ShiftType) => shift === 'night' || shift === 'late';
  const isWork = (shift: ShiftType) => shift && shift !== 'off' && shift !== 'paid';
  const isOff = (shift: ShiftType) => shift === 'off' || shift === 'paid';
  const getShift = (sId: number, d: number) => tempSchedule[`${sId}_${d}`];

  const hasNgConflict = (staffId: number, day: number, shiftType: ShiftType) => {
    if (!isNightShift(shiftType)) return false;
    return ngPairs.some(pair => {
      const partnerId = (pair.staff1 === staffId) ? pair.staff2 : (pair.staff2 === staffId) ? pair.staff1 : null;
      if (partnerId) {
        const partnerShift = tempSchedule[`${partnerId}_${day}`];
        if (partnerShift && isNightShift(partnerShift as string)) return true;
      }
      return false;
    });
  };

  const countShift = (d: number, type: string) => staffList.filter(s => getShift(s.id, d) === type).length;
  
  // Count total shifts assigned to a staff member (across the whole month)
  const countStaffTotal = (sId: number, type: string) => {
    let count = 0;
    daysArray.forEach(d => { if (getShift(sId, d) === type) count++; });
    return count;
  };

  // Checks if assigning work shifts starting at 'day' for 'length' days would create a chain of > 5 consecutive work days
  const wouldExceedMaxConsecutiveWork = (sId: number, day: number, length: number = 1) => {
    // Check backwards from the start of the new block
    let backCount = 0;
    for (let i = 1; i <= 5; i++) {
      if (day - i < 1) break;
      if (isWork(getShift(sId, day - i) as string)) backCount++; else break;
    }
    
    // Check forwards from the end of the new block
    const endDay = day + length - 1;
    let forwardCount = 0;
    for (let i = 1; i <= 5; i++) {
        if (endDay + i > daysInMonth) break;
        const next = getShift(sId, endDay + i);
        if (next && isWork(next as string)) forwardCount++; else break;
    }
    
    // If the chain (back + new_block + forward) exceeds 5, it's a violation.
    return (backCount + length + forwardCount) > 5;
  };

  // --- Dynamic Limits Calculation ---
  // Calculate average required shifts per person to prevent bottlenecks
  const staff2 = staffList.filter(s => s.shiftSystem === '2shift');
  const staff3 = staffList.filter(s => s.shiftSystem === '3shift');

  // Strict Average Calculation
  const calcLimit = (totalSlots: number, staffCount: number) => {
    if (staffCount === 0) return 0;
    const average = totalSlots / staffCount;
    return Math.ceil(average); 
  };

  const totalNightSlots = daysInMonth * targetSettings.targetNight;
  const totalLateSlots = daysInMonth * targetSettings.targetLate;
  
  const MAX_NIGHT_LIMIT = calcLimit(totalNightSlots, staff3.length); 
  const MAX_LATE_LIMIT_2SHIFT = calcLimit(totalLateSlots, staff2.length); 
  const MAX_LATE_LIMIT_3SHIFT = calcLimit(totalLateSlots, staff3.length); 

  // --- Strict Balancing Selector ---
  const selectBestCandidate = (candidates: Staff[], shiftTypeToCheck: string, strictLimit: number) => {
    if (candidates.length === 0) return null;

    let validCandidates = candidates.filter(s => countStaffTotal(s.id, shiftTypeToCheck) < strictLimit);
    if (validCandidates.length === 0) {
       validCandidates = candidates.filter(s => countStaffTotal(s.id, shiftTypeToCheck) < strictLimit + 1);
    }
    if (validCandidates.length === 0) {
       validCandidates = candidates;
    }

    let minCount = Infinity;
    const counts: {[key: number]: number} = {};
    
    validCandidates.forEach(s => {
      const c = countStaffTotal(s.id, shiftTypeToCheck);
      counts[s.id] = c;
      if (c < minCount) minCount = c;
    });

    const bestCandidates = validCandidates.filter(s => counts[s.id] === minCount);
    return shuffleArray(bestCandidates)[0];
  };

  // --- Pre-process mandatory rules for locked cells ---
  staffList.forEach(staff => {
    daysArray.forEach(day => {
      if (lockedCells[`${staff.id}_${day}`]) {
        const shift = tempSchedule[`${staff.id}_${day}`];
        const nextDay = day + 1;
        
        // 3-shift Night -> requires Day before (unless locked otherwise)
        if (staff.shiftSystem === '3shift' && shift === 'night') {
          if (day > 1 && !lockedCells[`${staff.id}_${day - 1}`]) {
            tempSchedule[`${staff.id}_${day - 1}`] = 'day';
          }
          if (nextDay <= daysInMonth && !lockedCells[`${staff.id}_${nextDay}`]) {
             if (countShift(nextDay, 'late') < targetSettings.targetLate) {
                tempSchedule[`${staff.id}_${nextDay}`] = 'late';
                if (day + 2 <= daysInMonth && !lockedCells[`${staff.id}_${day + 2}`]) {
                   tempSchedule[`${staff.id}_${day + 2}`] = 'off';
                }
             } else {
                tempSchedule[`${staff.id}_${nextDay}`] = 'off';
             }
          }
        }
        
        // 2-shift Night -> requires Late before
        if (staff.shiftSystem === '2shift' && shift === 'night') {
          if (day > 1 && !lockedCells[`${staff.id}_${day - 1}`]) {
            tempSchedule[`${staff.id}_${day - 1}`] = 'late';
          }
          if (nextDay <= daysInMonth && !lockedCells[`${staff.id}_${nextDay}`]) {
            tempSchedule[`${staff.id}_${nextDay}`] = 'off';
          }
        }
        // 2-shift Late -> requires Night after
        if (staff.shiftSystem === '2shift' && shift === 'late') {
          if (nextDay <= daysInMonth && !lockedCells[`${staff.id}_${nextDay}`]) {
            tempSchedule[`${staff.id}_${nextDay}`] = 'night';
          }
        }
        // 3-shift Late (Locked)
        if (staff.shiftSystem === '3shift' && shift === 'late') {
          if (nextDay <= daysInMonth && !lockedCells[`${staff.id}_${nextDay}`]) {
            tempSchedule[`${staff.id}_${nextDay}`] = 'off';
          }
          if (day > 1 && !lockedCells[`${staff.id}_${day - 1}`]) {
             tempSchedule[`${staff.id}_${day - 1}`] = 'night';
             if (day > 2 && !lockedCells[`${staff.id}_${day - 2}`]) {
                tempSchedule[`${staff.id}_${day - 2}`] = 'day';
             }
          }
        }
      }
    });
  });

  // --- Phase 1: Assign Night and Late Shifts ---
  
  for (let day of daysArray) {
    
    // --- 1. 3-Shift Night Assignment ---
    let neededNight = Math.max(0, targetSettings.targetNight - countShift(day, 'night'));
    if (neededNight > 0) {
      // Create initial pool of potential candidates
      let pool = staff3.filter(s => {
        if (getShift(s.id, day)) return false; 
        if (getShift(s.id, day+1)) return false; 
        const d3 = getShift(s.id, day+2);
        if (d3 && !isOff(d3 as string)) return false; 
        
        if (day > 1) {
          const prev = getShift(s.id, day - 1);
          if (prev && prev !== 'day') return false; // Must be Day or Empty
          
          if (!prev) {
             // If prev is empty, we will try to assign Day at day-1 and Night at day.
             if (wouldExceedMaxConsecutiveWork(s.id, day - 1, 2)) return false;
          } else {
             // Prev is already Day. Just check if adding Night at day fits.
             if (wouldExceedMaxConsecutiveWork(s.id, day, 1)) return false;
          }
        } else {
           // Day 1, no prev.
           if (wouldExceedMaxConsecutiveWork(s.id, day, 1)) return false;
        }

        if (hasNgConflict(s.id, day, 'night')) return false;
        return true;
      });

      for (let i = 0; i < neededNight; i++) {
        // STRICT CHECK: Re-filter pool to ensure no NG conflicts with assignments made in this loop
        const validPool = pool.filter(s => !hasNgConflict(s.id, day, 'night'));
        
        const s = selectBestCandidate(validPool, 'night', MAX_NIGHT_LIMIT);
        if (!s) break;

        // Apply mandatory 'Day' before 'Night' if empty
        if (day > 1 && !getShift(s.id, day - 1)) {
            tempSchedule[`${s.id}_${day - 1}`] = 'day';
        }

        if (day + 1 <= daysInMonth && countShift(day + 1, 'late') >= targetSettings.targetLate) {
             tempSchedule[`${s.id}_${day}`] = 'night';
             if (day + 1 <= daysInMonth && !getShift(s.id, day+1)) tempSchedule[`${s.id}_${day + 1}`] = 'off';
        } else {
             tempSchedule[`${s.id}_${day}`] = 'night';
             if (day + 1 <= daysInMonth && !getShift(s.id, day+1)) tempSchedule[`${s.id}_${day + 1}`] = 'late';
             if (day + 2 <= daysInMonth && !getShift(s.id, day+2)) tempSchedule[`${s.id}_${day + 2}`] = 'off';
        }
        
        // Remove the assigned staff from the pool
        pool = pool.filter(c => c.id !== s.id);
      }
    }

    // --- 2. 2-Shift Late Assignment (Strict Pair: Late -> Night) ---
    let neededLate = Math.max(0, targetSettings.targetLate - countShift(day, 'late'));
    
    if (neededLate > 0) {
      let pool = staff2.filter(s => {
        if (getShift(s.id, day)) return false; 
        if (day + 1 <= daysInMonth) {
           const next = getShift(s.id, day + 1);
           if (next && next !== 'night') return false; 
           if (hasNgConflict(s.id, day + 1, 'night')) return false; 
        }
        
        const d3 = getShift(s.id, day + 2);
        if (d3 && !isOff(d3 as string)) return false; 

        if (wouldExceedMaxConsecutiveWork(s.id, day, 2)) return false;
        
        if (hasNgConflict(s.id, day, 'late')) return false;
        if (day + 1 <= daysInMonth && countShift(day + 1, 'night') >= targetSettings.targetNight) return false;

        return true;
      });

      while (neededLate > 0) {
         if (day + 1 <= daysInMonth && countShift(day + 1, 'night') >= targetSettings.targetNight) break;

         // STRICT CHECK: Re-filter to avoid NG conflicts on both Day (Late) and Day+1 (Night)
         const validPool = pool.filter(s => 
            !hasNgConflict(s.id, day, 'late') && 
            (day + 1 > daysInMonth || !hasNgConflict(s.id, day + 1, 'night'))
         );

         const s = selectBestCandidate(validPool, 'late', MAX_LATE_LIMIT_2SHIFT);
         if (!s) break;

         tempSchedule[`${s.id}_${day}`] = 'late';
         if (day + 1 <= daysInMonth) tempSchedule[`${s.id}_${day + 1}`] = 'night';
         if (day + 2 <= daysInMonth) tempSchedule[`${s.id}_${day + 2}`] = 'off';
         
         pool = pool.filter(c => c.id !== s.id);
         neededLate--;
      }
    }

    // --- 3. 3-Shift Late Assignment ---
    neededLate = Math.max(0, targetSettings.targetLate - countShift(day, 'late'));
    if (neededLate > 0) {
      let pool = staff3.filter(s => {
        if (getShift(s.id, day)) return false;
        if (day + 1 <= daysInMonth) {
            const next = getShift(s.id, day + 1);
            if (next && !isOff(next as string)) return false;
        }
        
        if (wouldExceedMaxConsecutiveWork(s.id, day, 1)) return false;
        if (hasNgConflict(s.id, day, 'late')) return false;
        return true;
      });

      for (let i = 0; i < neededLate; i++) {
        // STRICT CHECK
        const validPool = pool.filter(s => !hasNgConflict(s.id, day, 'late'));
        
        const s = selectBestCandidate(validPool, 'late', MAX_LATE_LIMIT_3SHIFT);
        if (!s) break;

        tempSchedule[`${s.id}_${day}`] = 'late';
        if (day + 1 <= daysInMonth && !getShift(s.id, day+1)) tempSchedule[`${s.id}_${day + 1}`] = 'off';
        
        pool = pool.filter(c => c.id !== s.id);
      }
    }
  }

  // --- Phase 1.5: Weekend Offs (Sat-Sun) ---
  const saturdays = daysArray.filter(d => new Date(year, month, d).getDay() === 6 && d + 1 <= daysInMonth);
  
  const canAssignWeekendOff = (day: number) => {
    const unavailableCount = staffList.filter(s => {
      const shift = getShift(s.id, day);
      return shift && (isOff(shift) || isNightShift(shift));
    }).length;
    return (staffList.length - (unavailableCount + 1)) >= targetSettings.targetDayWeekend;
  };

  const assignWeekendOffs = (targetCount: number) => {
    const shuffledStaff = shuffleArray([...staffList]);
    for (const staff of shuffledStaff) {
      let currentPairs = 0;
      for (const sat of saturdays) {
        if (isOff(getShift(staff.id, sat) as string) && isOff(getShift(staff.id, sat + 1) as string)) {
          currentPairs++;
        }
      }
      if (currentPairs >= targetCount) continue;

      const shuffledSats = shuffleArray([...saturdays]);
      for (const sat of shuffledSats) {
        if (currentPairs >= targetCount) break;
        if (!getShift(staff.id, sat) && !getShift(staff.id, sat + 1)) {
          if (canAssignWeekendOff(sat) && canAssignWeekendOff(sat + 1)) {
             tempSchedule[`${staff.id}_${sat}`] = 'off';
             tempSchedule[`${staff.id}_${sat + 1}`] = 'off';
             currentPairs++;
          }
        }
      }
    }
  };

  assignWeekendOffs(1);
  assignWeekendOffs(2);

  // --- Phase 2: Holidays & Weekends (Day shift filling) ---
  const balanceSort = (candidates: Staff[], shiftType: string) => {
    const shuffled = shuffleArray(candidates);
    return shuffled.sort((a, b) => countStaffTotal(a.id, shiftType) - countStaffTotal(b.id, shiftType));
  };

  const holidayGroup = daysArray.filter(d => isWeekendOrHoliday(year, month, d));
  for (let day of holidayGroup) {
    if (countShift(day, 'day') < targetSettings.targetDayWeekend) {
      const available = staffList.filter(s => !getShift(s.id, day));
      const candidates = balanceSort(available, 'day');
      for (let s of candidates) {
        if (countShift(day, 'day') >= targetSettings.targetDayWeekend) break;
        if (!wouldExceedMaxConsecutiveWork(s.id, day, 1)) tempSchedule[`${s.id}_${day}`] = 'day';
        else tempSchedule[`${s.id}_${day}`] = 'off';
      }
    }
    staffList.forEach(s => {
      if (!getShift(s.id, day)) tempSchedule[`${s.id}_${day}`] = 'off';
    });
  }

  // --- Phase 3: Weekdays & Balancing Offs ---
  const calculatePersonalOffTarget = () => {
    return daysArray.filter(d => {
        const dayOfWeek = new Date(year, month, d).getDay();
        return dayOfWeek === 0 || dayOfWeek === 6; 
    }).length;
  };

  const weekdayGroup = daysArray.filter(d => !isWeekendOrHoliday(year, month, d));
  let weekdayCapacity: {[key: number]: number} = {};
  weekdayGroup.forEach(d => {
    weekdayCapacity[d] = staffList.filter(s => !getShift(s.id, d)).length;
  });

  let staffNeedsOff = [];
  for(let staff of staffList) {
    let currentOffCount = 0;
    daysArray.forEach(d => { if (isOff(getShift(staff.id, d) as string)) currentOffCount++; });
    const targetOff = calculatePersonalOffTarget();
    const needed = Math.max(0, targetOff - currentOffCount);
    if(needed > 0) staffNeedsOff.push({ id: staff.id, count: needed });
  }

  let assigned = true;
  while(assigned) {
    assigned = false;
    staffNeedsOff = shuffleArray(staffNeedsOff);
    for(let item of staffNeedsOff) {
      if(item.count <= 0) continue;
      const candidates = weekdayGroup.filter(d => 
        !getShift(item.id, d) && 
        weekdayCapacity[d] > targetSettings.targetDayWeekday
      );
      if(candidates.length > 0) {
        const day = shuffleArray(candidates)[0];
        tempSchedule[`${item.id}_${day}`] = 'off';
        weekdayCapacity[day]--;
        item.count--;
        assigned = true;
      }
    }
  }

  // --- Phase 4: Fill remaining with Day shift (Strict Check) ---
  for(let day of weekdayGroup) {
    staffList.forEach(s => {
      if(!getShift(s.id, day)) {
        if (!wouldExceedMaxConsecutiveWork(s.id, day, 1)) {
             tempSchedule[`${s.id}_${day}`] = 'day';
        } else {
             // Enforce off if consecutive work limit would be exceeded
             tempSchedule[`${s.id}_${day}`] = 'off';
        }
      }
    });
  }

  return tempSchedule;
};