/**
 * 單位表與換算。純函式、無狀態。
 *
 * 「累積食材用量」的成敗全在單位，事後補做要回頭改所有既有資料，
 * 因此換算係數從第一版就存在（批次 C 的統計直接可用）。
 */
import type { IngredientKind } from './types';

export type UnitCategory = 'weight' | 'volume' | 'count';

export interface UnitDef {
  /** 儲存用的代碼，如 'jin' */
  code: string;
  /** 顯示用的中文，如 '臺斤' */
  label: string;
  category: UnitCategory;
  /** 換算到該分類基準單位的係數（weight → g、volume → ml）。count 類為 undefined */
  factor?: number;
}

/** 重量基準 g、容量基準 ml；count 各自獨立統計，不互換 */
export const UNITS: UnitDef[] = [
  // 重量（基準 g）
  { code: 'g', label: '公克', category: 'weight', factor: 1 },
  { code: 'kg', label: '公斤', category: 'weight', factor: 1000 },
  { code: 'jin', label: '臺斤', category: 'weight', factor: 600 },
  { code: 'liang', label: '兩', category: 'weight', factor: 37.5 },
  { code: 'lb', label: '磅', category: 'weight', factor: 453.6 },
  // 容量（基準 ml）
  { code: 'ml', label: '毫升', category: 'volume', factor: 1 },
  { code: 'l', label: '公升', category: 'volume', factor: 1000 },
  { code: 'tbsp', label: '大匙', category: 'volume', factor: 15 },
  { code: 'tsp', label: '小匙', category: 'volume', factor: 5 },
  { code: 'teaspoon', label: '茶匙', category: 'volume', factor: 5 },
  { code: 'cup', label: '杯', category: 'volume', factor: 240 },
  // 計數（各自獨立）
  { code: 'piece', label: '顆', category: 'count' },
  { code: 'grain', label: '粒', category: 'count' },
  { code: 'slice', label: '片', category: 'count' },
  { code: 'handful', label: '把', category: 'count' },
  { code: 'plant', label: '株', category: 'count' },
  { code: 'bundle', label: '束', category: 'count' },
  { code: 'stick', label: '根', category: 'count' },
  { code: 'whole', label: '隻', category: 'count' },
  { code: 'pack', label: '包', category: 'count' },
  { code: 'can', label: '罐', category: 'count' },
  { code: 'box', label: '盒', category: 'count' },
];

const BY_CODE = new Map(UNITS.map((unit) => [unit.code, unit]));

/**
 * 輸入區的單位候選清單依 kind 而異，順序即為下拉選單順序。
 * 常用的排前面，讓多數情況不必捲動也不必自由輸入。
 */
const FOOD_UNIT_CODES = [
  'g',
  'jin',
  'liang',
  'kg',
  'piece',
  'handful',
  'slice',
  'stick',
  'bundle',
  'pack',
  'box',
  'can',
  'ml',
  'cup',
];

const SEASONING_UNIT_CODES = ['tbsp', 'tsp', 'ml', 'g', 'cup', 'teaspoon', 'piece', 'slice'];

export function unitOptionsFor(kind: IngredientKind): UnitDef[] {
  const codes = kind === 'seasoning' ? SEASONING_UNIT_CODES : FOOD_UNIT_CODES;
  return codes
    .map((code) => BY_CODE.get(code))
    .filter((unit): unit is UnitDef => unit !== undefined);
}

export function findUnit(code: string | undefined): UnitDef | null {
  if (!code) return null;
  return BY_CODE.get(code) ?? null;
}

/**
 * 單位的顯示文字。
 * 自由輸入的單位不在表中，直接顯示原字串。
 */
export function unitLabel(code: string | undefined): string {
  if (!code) return '';
  return BY_CODE.get(code)?.label ?? code;
}

/** 自由輸入的單位視為 count 且無 factor，統計時單獨成列 */
export function unitCategory(code: string | undefined): UnitCategory {
  return findUnit(code)?.category ?? 'count';
}

/**
 * 換算到分類基準單位（weight → g、volume → ml）。
 * 無法換算（count 或自由輸入）時回傳 null，呼叫端應單獨成列而非當作 0。
 */
export function toBaseAmount(amount: number, code: string | undefined): number | null {
  const unit = findUnit(code);
  if (!unit || unit.factor === undefined) return null;
  return amount * unit.factor;
}

/** 該分類的基準單位代碼，統計輸出時標示用 */
export function baseUnitCode(category: UnitCategory): string | null {
  if (category === 'weight') return 'g';
  if (category === 'volume') return 'ml';
  return null;
}

/**
 * 用量的顯示文字。
 * amount 未填即為「適量」——「適量」是沒有數量，不是一個單位。
 */
export function formatAmount(amount: number | undefined, code: string | undefined): string {
  if (amount === undefined || amount === null || Number.isNaN(amount)) return '適量';
  const label = unitLabel(code);
  // 小數點後多餘的 0 會讓「1.0 大匙」看起來像是精算過的份量
  const shown = Number.isInteger(amount) ? String(amount) : String(Number(amount.toFixed(3)));
  return label ? `${shown} ${label}` : shown;
}
