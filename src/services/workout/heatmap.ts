/**
 * 年檢視 heatmap 的格線與年度統計。純函式、無副作用。
 *
 * 格子語意**沿用月曆的四色**（calendar.ts 的 DayStatus），不另外做一套強度深淺——
 * 兩頁對照時若色義不同，使用者要在腦中換算兩套規則。
 *
 * 設計決策見 doc/plan/2026-08-01-workout-batch-c.md 第 2 節。
 */
import { classifyDay, resolvePlanForDate, type DayStatus } from './calendar';
import { ALL_WEEKDAYS, addDays, listMonthDates, startOfIsoWeek, todayString } from './schedule';
import type { DateString, IsoWeekday, WorkoutLog, WorkoutPlan } from './types';

export interface HeatmapDay {
  date: DateString;
  month: number;
  weekday: IsoWeekday;
  /** 首尾補格（鄰年）為 false */
  inYear: boolean;
  isToday: boolean;
  isFuture: boolean;
  status: DayStatus;
  logCount: number;
}

export interface HeatmapGrid {
  /** 每欄為一個 ISO 週，固定七格（週一 → 週日） */
  columns: HeatmapDay[][];
  /** 月份標籤：該月第一天所在的欄索引 */
  monthTicks: { month: number; columnIndex: number }[];
}

/**
 * 整年的週欄格線。
 *
 * 以 ISO 週為欄，因此首尾會帶到鄰年的日子（`inYear: false`），
 * 這與月曆的補格是同一套處理方式。
 */
export function buildYearHeatmap(
  plans: WorkoutPlan[],
  logs: WorkoutLog[],
  year: number,
  today: DateString = todayString(),
): HeatmapGrid {
  const first: DateString = `${year}-01-01`;
  const last: DateString = `${year}-12-31`;

  const columns: HeatmapDay[][] = [];
  let cursor = startOfIsoWeek(first);
  while (cursor <= last) {
    const column = ALL_WEEKDAYS.map((weekday, index) => {
      const date = addDays(cursor, index);
      const plan = resolvePlanForDate(plans, date);
      return {
        date,
        month: Number(date.slice(5, 7)),
        weekday,
        inYear: date >= first && date <= last,
        isToday: date === today,
        isFuture: date > today,
        status: classifyDay(plan, date, logs),
        logCount: logs.filter((log) => log.date === date).length,
      } satisfies HeatmapDay;
    });
    columns.push(column);
    cursor = addDays(cursor, 7);
  }

  const monthTicks: { month: number; columnIndex: number }[] = [];
  columns.forEach((column, columnIndex) => {
    column.forEach((day) => {
      if (!day.inYear || day.date.slice(8) !== '01') return;
      if (monthTicks.some((tick) => tick.month === day.month)) return;
      monthTicks.push({ month: day.month, columnIndex });
    });
  });

  return { columns, monthTicks };
}

export interface YearStats {
  year: number;
  /** 列入計算的天數：該年已過去的日子 */
  countedDays: number;
  /** 有動的天數（照表 + 部分 + 彈性日） */
  activeDays: number;
  planDoneDays: number;
  partialDays: number;
  flexDays: number;
  restDays: number;
  /** 應運動日但沒打卡（已過去者） */
  missedDays: number;
  /** 目前的連續天數。休息日不中斷也不加分 */
  currentStreak: number;
  /** 該年內最長的連續天數 */
  longestStreak: number;
}

/** 有動的三種狀態。休息日不算「有動」，但也不該中斷連續紀錄 */
function isActiveStatus(status: DayStatus): boolean {
  return status === 'plan-done' || status === 'partial' || status === 'flex';
}

/** currentStreak 往回追溯的上限，避免資料很久以前時一路掃到底 */
const STREAK_LOOKBACK_DAYS = 400;

/**
 * 年度統計。
 *
 * 連續天數的規則：**休息日不中斷、也不加分**，應運動日沒打卡才中斷。
 * 課表本來就排了休息日，讓休息把連續歸零等於懲罰照表操課的人。
 * 彈性日（NEAT）有打卡一樣延續——它不進達成率分母，但確實動了（roadmap §3.9）。
 *
 * `currentStreak` 會往回跨年追溯（上限 400 天），因此呼叫端要多帶前一年的紀錄；
 * `longestStreak` 則只在該年內計算。
 */
export function computeYearStats(
  plans: WorkoutPlan[],
  logs: WorkoutLog[],
  year: number,
  today: DateString = todayString(),
): YearStats {
  const yearDates: DateString[] = [];
  for (let month = 1; month <= 12; month += 1) {
    listMonthDates(year, month).forEach((date) => yearDates.push(date));
  }
  const countedDates = yearDates.filter((date) => date <= today);

  const statusOf = (date: DateString): DayStatus =>
    classifyDay(resolvePlanForDate(plans, date), date, logs);

  let planDoneDays = 0;
  let partialDays = 0;
  let flexDays = 0;
  let restDays = 0;
  let missedDays = 0;
  let longestStreak = 0;
  let running = 0;

  countedDates.forEach((date) => {
    const status = statusOf(date);
    if (status === 'plan-done') planDoneDays += 1;
    else if (status === 'partial') partialDays += 1;
    else if (status === 'flex') flexDays += 1;
    else if (status === 'rest') restDays += 1;
    else missedDays += 1;

    if (isActiveStatus(status)) {
      running += 1;
      longestStreak = Math.max(longestStreak, running);
    } else if (status === 'none') {
      running = 0;
    }
  });

  // 從最後一個列入計算的日子往回追溯，可跨年
  let currentStreak = 0;
  const anchor = countedDates[countedDates.length - 1];
  if (anchor) {
    for (let offset = 0; offset < STREAK_LOOKBACK_DAYS; offset += 1) {
      const date = addDays(anchor, -offset);
      const status = statusOf(date);
      if (status === 'none') break;
      if (isActiveStatus(status)) currentStreak += 1;
    }
  }

  return {
    year,
    countedDays: countedDates.length,
    activeDays: planDoneDays + partialDays + flexDays,
    planDoneDays,
    partialDays,
    flexDays,
    restDays,
    missedDays,
    currentStreak,
    longestStreak,
  };
}
