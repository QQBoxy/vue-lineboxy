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
  PlanVariant,
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
export function mapWeekdaysToGroups(
  plan: WorkoutPlan | null,
): Record<IsoWeekday, PlanGroup | null> {
  const result = {} as Record<IsoWeekday, PlanGroup | null>;
  ALL_WEEKDAYS.forEach((weekday) => {
    result[weekday] = plan?.groups.find((group) => group.weekdays.includes(weekday)) ?? null;
  });
  return result;
}

/** 群組是否為當天二擇一 */
export function hasVariantChoice(group: PlanGroup | null): boolean {
  return (group?.variants.length ?? 0) > 1;
}

/**
 * 取出要呈現／執行的 variant。
 *
 * 指定 variantId 時以它為準（打卡紀錄回填用）；找不到或未指定時回傳第一個，
 * 讓「只有一種內容」與「尚未選擇」都有東西可顯示。
 */
export function getVariant(group: PlanGroup | null, variantId?: Id): PlanVariant | null {
  if (!group || group.variants.length === 0) return null;
  if (variantId) {
    const found = group.variants.find((variant) => variant.id === variantId);
    if (found) return found;
  }
  return group.variants[0];
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
 *
 * `countsTowardQuota === false` 的群組（NEAT 日）完全不產生配額，
 * 但這些日子的打卡仍會計入 MonthStats 的 activeDays。
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
    // NEAT 日本來就不要求完成大課表，放進分母只會讓達成率失真
    if (!group.countsTowardQuota) return;

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
  /** 列入計算的應運動日配額數（分母，兩條線共用） */
  expectedTotal: number;
  /** 已達成的配額數（寬鬆版：有動就算，含 fallback 與 partial） */
  achievedTotal: number;
  /** 活動達成率：有動就算 / 應運動日配額 */
  achievementRate: number;
  /** 照表達成的配額數：source === 'group' 且 status === 'done' */
  strictAchievedTotal: number;
  /** 照表達成率。與 achievementRate 的差距即「有動但沒照表完成」的比例 */
  strictAchievementRate: number;
  /** 實際有運動的日數 */
  activeDays: number;
  /** 列入計算的天數（當月計算到今天為止） */
  countedDays: number;
  /** 運動日佔比：實際運動日 / 列入計算天數 */
  activeDayRate: number;
}

/**
 * 計算某月的指標。達成率為雙線（2026-07-31 決議）：
 *
 * - 活動達成率（`achievementRate`）：`status !== 'rest'`，有動就算，含 fallback 與 partial
 * - 照表達成率（`strictAchievementRate`）：`source === 'group'` 且 `status === 'done'`
 *
 * 兩者**分母相同**，`partial` 只進寬鬆版——若兩邊都算，兩條線會黏在一起，
 * 「有動但沒照表完成」這個差距就看不出來了。
 *
 * 分母規則：尚未結束的配額不列入。'day' 配額須日期早於今天，
 * 'week' 配額須最後一個候選日早於今天；已達成者一律列入。
 * 如此當月月初不會因為分母是整月而失真。
 * 「已達成」以**寬鬆版**判定，兩條線才會共用同一個分母。
 */
export function computeMonthStats(
  plan: WorkoutPlan | null,
  logs: WorkoutLog[],
  year: number,
  month: number,
  today: DateString = todayString(),
): MonthStats {
  const loggedDates = new Set(logs.filter((log) => log.status !== 'rest').map((log) => log.date));
  const strictDates = new Set(
    logs.filter((log) => log.source === 'group' && log.status === 'done').map((log) => log.date),
  );

  const slots = getExpectedSlots(plan, year, month);
  let expectedTotal = 0;
  let achievedTotal = 0;
  let strictAchievedTotal = 0;

  slots.forEach((slot) => {
    const achieved = slot.dates.some((date) => loggedDates.has(date));
    const lastDate = slot.dates[slot.dates.length - 1];
    const settled = lastDate < today;
    if (!achieved && !settled) return;
    expectedTotal += 1;
    if (achieved) achievedTotal += 1;
    if (slot.dates.some((date) => strictDates.has(date))) strictAchievedTotal += 1;
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
    strictAchievedTotal,
    strictAchievementRate: expectedTotal === 0 ? 0 : strictAchievedTotal / expectedTotal,
    activeDays,
    countedDays: countedDates.length,
    activeDayRate: countedDates.length === 0 ? 0 : activeDays / countedDates.length,
  };
}
