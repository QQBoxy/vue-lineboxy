/**
 * 食材自動完成的排序。純函式、無副作用。
 *
 * 不做模糊比對（注音／錯字容錯成本高效益低），
 * 也不設「用過幾次才進主檔」的門檻——門檻會讓第二次輸入時因忘記全名而打錯字，
 * 反而製造重複資料。
 */
import type { Ingredient, IngredientKind } from './types';

/** 下拉選單一次最多顯示幾筆，太多在手機上會蓋住鍵盤上方的輸入框 */
export const SUGGEST_LIMIT = 8;

/**
 * 排序規則（依序）：
 * 1. 前綴命中優先於中間命中（輸入「韭」時「韭菜」排在「韭黃炒蛋用韭黃」之前）
 * 2. 同類命中內，usageCount 高者優先
 * 3. 再同分，lastUsedAt 新者優先
 *
 * 只比對同 kind 的食材。keyword 為空時回傳該 kind 的常用清單，
 * 讓使用者一點開輸入框就看得到選項。
 */
export function suggestIngredients(
  all: Ingredient[],
  keyword: string,
  kind: IngredientKind,
  limit: number = SUGGEST_LIMIT,
): Ingredient[] {
  const needle = keyword.trim().toLowerCase();
  const sameKind = all.filter((item) => item.kind === kind);

  const scored = sameKind
    .map((item) => {
      const name = item.name.toLowerCase();
      // 0 = 前綴命中，1 = 中間命中，-1 = 未命中
      const rank = needle === '' ? 0 : name.startsWith(needle) ? 0 : name.includes(needle) ? 1 : -1;
      return { item, rank };
    })
    .filter((entry) => entry.rank >= 0);

  scored.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    if (a.item.usageCount !== b.item.usageCount) return b.item.usageCount - a.item.usageCount;
    return b.item.lastUsedAt.localeCompare(a.item.lastUsedAt);
  });

  return scored.slice(0, limit).map((entry) => entry.item);
}

/** 主檔中是否已有同名同類的食材（比對時忽略前後空白與大小寫） */
export function findIngredientByName(
  all: Ingredient[],
  name: string,
  kind: IngredientKind,
): Ingredient | null {
  const needle = name.trim().toLowerCase();
  if (!needle) return null;
  return (
    all.find((item) => item.kind === kind && item.name.trim().toLowerCase() === needle) ?? null
  );
}
