/**
 * 排程推導：日期 → 適用群組 / 應運動日 / 達成率。
 * 全部為純函式、無副作用，方便單獨驗證。
 */
import type {
  DateString,
  Id,
  IsoWeekday,
  NumRange,
  PlanGroup,
  WorkoutLog,
  WorkoutPlan,
} from './types';

// ---------------------------------------------------------------------------
// 日期工具（一律本地時區，不使用 UTC / ISO 字串儲存）
// ---------------------------------------------------------------------------

export const WEEKDAY_LABELS: Record<IsoWeekday, string> = {
  1: '週一',
  2: '週二',
  3: '週三',
  4: '週四',
  5: '週五',
  6: '週六',
  7: '週日',
};

export const ALL_WEEKDAYS: IsoWeekday[] = [1, 2, 3, 4, 5, 6, 7];

export function toDateString(date: Date): DateString {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** 以本地時區的午夜還原成 Date */
export function fromDateString(date: DateString): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function todayString(): DateString {
  return toDateString(new Date());
}

export function addDays(date: DateString, amount: number): DateString {
  const next = fromDateString(date);
  next.setDate(next.getDate() + amount);
  return toDateString(next);
}

export function isoWeekdayOf(date: DateString): IsoWeekday {
  const day = fromDateString(date).getDay();
  return (day === 0 ? 7 : day) as IsoWeekday;
}

/** 該日期所屬 ISO 週的週一 */
export function startOfIsoWeek(date: DateString): DateString {
  return addDays(date, 1 - isoWeekdayOf(date));
}

export function listMonthDates(year: number, month: number): DateString[] {
  const total = new Date(year, month, 0).getDate();
  return Array.from({ length: total }, (_, index) =>
    toDateString(new Date(year, month - 1, index + 1)),
  );
}

/** 從今天往前算 count 天（含今天），由新到舊 */
export function listRecentDates(count: number, today: DateString = todayString()): DateString[] {
  return Array.from({ length: count }, (_, index) => addDays(today, -index));
}

/** 將 [1,3,5] 顯示為「週一、三、五」 */
export function formatWeekdays(weekdays: IsoWeekday[]): string {
  const sorted = [...weekdays].sort((a, b) => a - b);
  if (sorted.length === 0) return '';
  return sorted
    .map((day, index) => (index === 0 ? WEEKDAY_LABELS[day] : WEEKDAY_LABELS[day].slice(1)))
    .join('、');
}

export function formatRange(range: NumRange | undefined, unit: string): string {
  if (!range) return '';
  return range.max && range.max !== range.min
    ? `${range.min}–${range.max} ${unit}`
    : `${range.min} ${unit}`;
}

// ---------------------------------------------------------------------------
// 群組推導
// ---------------------------------------------------------------------------

/** 該日期適用的群組；null 代表休息日 */
export function getGroupForDate(plan: WorkoutPlan | null, date: DateString): PlanGroup | null {
  if (!plan) return null;
  const weekday = isoWeekdayOf(date);
  return plan.groups.find((group) => group.weekdays.includes(weekday)) ?? null;
}

/** 星期 → 群組的對照表，供七天總覽使用 */
export function mapWeekdaysToGroups(plan: WorkoutPlan | null): Record<IsoWeekday, PlanGroup | null> {
  const result = {} as Record<IsoWeekday, PlanGroup | null>;
  ALL_WEEKDAYS.forEach((weekday) => {
    result[weekday] = plan?.groups.find((group) => group.weekdays.includes(weekday)) ?? null;
  });
  return result;
}

// ---------------------------------------------------------------------------
// 應運動日與達成率
// ---------------------------------------------------------------------------

/**
 * 一個「應運動日配額」。
 * - kind='day'：requirement 為 'all' 的群組，每個涵蓋日各佔一個配額。
 * - kind='week'：requirement 為 'any-one' 的群組，整組每週只佔一個配額，
 *   候選日中任一天有紀錄即達成。
 */
export interface ExpectedSlot {
  kind: 'day' | 'week';
  groupId: Id;
  groupLabel: string;
  /** 候選日期（week 配額會列出該週所有涵蓋日，含落在鄰月者） */
  dates: DateString[];
  /** 配額歸屬月份的判定基準：week 配額取該週第一個涵蓋日 */
  anchorDate: DateString;
}

/**
 * 指定月份的應運動日配額。
 *
 * 跨月週的歸屬規則：'any-one' 群組的週配額，歸屬於「該週內第一個涵蓋日」所在的月份。
 * 例：某週六為 8/31、週日為 9/1，該配額計入 8 月。
 */
export function getExpectedSlots(
  plan: WorkoutPlan | null,
  year: number,
  month: number,
): ExpectedSlot[] {
  if (!plan) return [];

  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
  const slots: ExpectedSlot[] = [];
  const seenWeekSlots = new Set<string>();

  listMonthDates(year, month).forEach((date) => {
    // 該日期若落在課表生效日之前，不列入
    if (date < plan.effectiveFrom) return;

    const group = getGroupForDate(plan, date);
    if (!group) return;

    if (group.requirement === 'all') {
      slots.push({
        kind: 'day',
        groupId: group.id,
        groupLabel: group.label,
        dates: [date],
        anchorDate: date,
      });
      return;
    }

    // any-one：整週共用一個配額
    const weekStart = startOfIsoWeek(date);
    const key = `${group.id}@${weekStart}`;
    if (seenWeekSlots.has(key)) return;
    seenWeekSlots.add(key);

    const candidates = [...group.weekdays]
      .sort((a, b) => a - b)
      .map((weekday) => addDays(weekStart, weekday - 1))
      .filter((candidate) => candidate >= plan.effectiveFrom);
    if (candidates.length === 0) return;

    const anchorDate = candidates[0];
    // 配額歸屬於 anchor 所在月份，避免跨月週重複計算
    if (!anchorDate.startsWith(monthPrefix)) return;

    slots.push({
      kind: 'week',
      groupId: group.id,
      groupLabel: group.label,
      dates: candidates,
      anchorDate,
    });
  });

  return slots;
}

export interface MonthStats {
  year: number;
  month: number;
  /** 列入計算的應運動日配額數（分母） */
  expectedTotal: number;
  /** 已達成的配額數 */
  achievedTotal: number;
  /** 達成率：已達成配額 / 應運動日配額 */
  achievementRate: number;
  /** 實際有運動的日數 */
  activeDays: number;
  /** 列入計算的天數（當月計算到今天為止） */
  countedDays: number;
  /** 運動日佔比：實際運動日 / 列入計算天數 */
  activeDayRate: number;
}

/**
 * 計算某月的兩個指標。
 *
 * 分母規則：尚未結束的配額不列入。'day' 配額須日期早於今天，
 * 'week' 配額須最後一個候選日早於今天；已達成者一律列入。
 * 如此當月月初不會因為分母是整月而失真。
 */
export function computeMonthStats(
  plan: WorkoutPlan | null,
  logs: WorkoutLog[],
  year: number,
  month: number,
  today: DateString = todayString(),
): MonthStats {
  const loggedDates = new Set(logs.filter((log) => log.status !== 'rest').map((log) => log.date));

  const slots = getExpectedSlots(plan, year, month);
  let expectedTotal = 0;
  let achievedTotal = 0;

  slots.forEach((slot) => {
    const achieved = slot.dates.some((date) => loggedDates.has(date));
    const lastDate = slot.dates[slot.dates.length - 1];
    const settled = lastDate < today;
    if (!achieved && !settled) return;
    expectedTotal += 1;
    if (achieved) achievedTotal += 1;
  });

  const monthDates = listMonthDates(year, month);
  const countedDates = monthDates.filter((date) => date <= today);
  const activeDays = countedDates.filter((date) => loggedDates.has(date)).length;

  return {
    year,
    month,
    expectedTotal,
    achievedTotal,
    achievementRate: expectedTotal === 0 ? 0 : achievedTotal / expectedTotal,
    activeDays,
    countedDays: countedDates.length,
    activeDayRate: countedDates.length === 0 ? 0 : activeDays / countedDates.length,
  };
}
