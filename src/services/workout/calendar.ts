/**
 * 月曆格線推導。純函式、無副作用。
 *
 * 手機上日檢視資訊量太少，因此以月曆為主要檢視。
 * 設計決策見 doc/plan/2026-07-31-workout-batch-b.md 第 4 節。
 */
import {
  ALL_WEEKDAYS,
  addDays,
  getGroupForDate,
  isoWeekdayOf,
  listMonthDates,
  startOfIsoWeek,
  todayString,
} from './schedule';
import type { DateString, IsoWeekday, WorkoutLog, WorkoutPlan } from './types';

/**
 * 單日狀態。
 * 'none' 是「應運動日但還沒打卡」，以虛線框呈現而非配色，
 * 因此實際的四種顏色是 rest / plan-done / partial / flex。
 */
export type DayStatus = 'none' | 'rest' | 'plan-done' | 'partial' | 'flex';

export interface CalendarDay {
  date: DateString;
  dayOfMonth: number;
  weekday: IsoWeekday;
  /** 前後補格（鄰月）為 false */
  inMonth: boolean;
  isToday: boolean;
  isFuture: boolean;
  status: DayStatus;
  /** 當日群組名稱；休息日或無課表為空字串 */
  groupLabel: string;
  logCount: number;
}

/**
 * 課表清單 → 該日期適用者。
 * localRepository.getPlanForDate() 的純函式版：月曆會跨越生效日，
 * 每一格都要各自解析，不能整月共用同一份課表。
 */
export function resolvePlanForDate(
  plans: WorkoutPlan[],
  date: DateString,
): WorkoutPlan | null {
  let best: WorkoutPlan | null = null;
  plans.forEach((plan) => {
    if (plan.effectiveFrom > date) return;
    if (!best) {
      best = plan;
      return;
    }
    const current: WorkoutPlan = best;
    if (
      plan.effectiveFrom > current.effectiveFrom ||
      (plan.effectiveFrom === current.effectiveFrom && plan.version > current.version)
    ) {
      best = plan;
    }
  });
  return best;
}

/**
 * 單日狀態判定。
 *
 * 'flex' 優先於其他：彈性日（NEAT）就算照表完成也該顯示為彈性日，
 * 否則畫面上看不出 roadmap §3.9「不進分母但進運動日」的刻意不對稱。
 */
export function classifyDay(
  plan: WorkoutPlan | null,
  date: DateString,
  logs: WorkoutLog[],
): DayStatus {
  const group = getGroupForDate(plan, date);
  const dayLogs = logs.filter((log) => log.date === date && log.status !== 'rest');

  if (dayLogs.length === 0) return group ? 'none' : 'rest';
  if (group && !group.countsTowardQuota) return 'flex';
  if (dayLogs.some((log) => log.source === 'group' && log.status === 'done')) return 'plan-done';
  return 'partial';
}

/**
 * 週一起始的 ISO 週格線，含前後補格。
 * 回傳的每個子陣列固定七格，方便直接 v-for 成 grid。
 */
export function buildMonthCalendar(
  plans: WorkoutPlan[],
  logs: WorkoutLog[],
  year: number,
  month: number,
  today: DateString = todayString(),
): CalendarDay[][] {
  const monthDates = listMonthDates(year, month);
  const first = monthDates[0];
  const last = monthDates[monthDates.length - 1];

  const gridStart = startOfIsoWeek(first);
  // 最後一週補滿到週日
  const gridEnd = addDays(startOfIsoWeek(last), 6);

  const weeks: CalendarDay[][] = [];
  let cursor = gridStart;
  while (cursor <= gridEnd) {
    const week = ALL_WEEKDAYS.map((_, index) => {
      const date = addDays(cursor, index);
      const plan = resolvePlanForDate(plans, date);
      const group = getGroupForDate(plan, date);
      const dayLogs = logs.filter((log) => log.date === date);
      return {
        date,
        dayOfMonth: Number(date.slice(8)),
        weekday: isoWeekdayOf(date),
        inMonth: date >= first && date <= last,
        isToday: date === today,
        isFuture: date > today,
        status: classifyDay(plan, date, logs),
        groupLabel: group?.label ?? '',
        logCount: dayLogs.length,
      } satisfies CalendarDay;
    });
    weeks.push(week);
    cursor = addDays(cursor, 7);
  }

  return weeks;
}

/** 上一個月 / 下一個月。month 為 1–12 */
export function shiftMonth(
  year: number,
  month: number,
  amount: number,
): { year: number; month: number } {
  const zeroBased = year * 12 + (month - 1) + amount;
  return { year: Math.floor(zeroBased / 12), month: (zeroBased % 12) + 1 };
}
