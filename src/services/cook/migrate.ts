/**
 * 食譜的 schema 遷移。純函式、無副作用，方便以腳本單獨驗證。
 *
 * 目前只有 v1，尚無跨版本轉換要做；本檔的存在是為了讓 v2 到來時
 * 有現成的掛載點——沒有遷移機制的資料等同無法演進。
 * 現階段的職責是「補齊缺漏欄位」，讓手動編輯過或半途中斷寫入的
 * localStorage 內容不會讓畫面層炸開。
 */
import { COOK_SCHEMA_VERSION, MEAL_SLOTS, type MealSlot, type Recipe } from './types';

type Raw = Record<string, unknown>;

function isObject(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asStringArray(value: unknown): string[] {
  return asArray(value).filter((item): item is string => typeof item === 'string');
}

function asMealTags(value: unknown): MealSlot[] {
  return asArray(value).filter((item): item is MealSlot =>
    MEAL_SLOTS.includes(item as MealSlot),
  );
}

/** 單份食譜。已是目前版本就原樣回傳 */
export function migrateRecipe(raw: unknown): Recipe {
  const recipe = isObject(raw) ? raw : {};
  if (recipe.schemaVersion === COOK_SCHEMA_VERSION) return recipe as unknown as Recipe;

  return {
    ...(recipe as unknown as Recipe),
    schemaVersion: COOK_SCHEMA_VERSION,
    name: typeof recipe.name === 'string' ? recipe.name : '未命名料理',
    ingredients: asArray(recipe.ingredients) as Recipe['ingredients'],
    steps: asStringArray(recipe.steps),
    sources: asArray(recipe.sources) as Recipe['sources'],
    mealTags: asMealTags(recipe.mealTags),
    cookCount: typeof recipe.cookCount === 'number' ? recipe.cookCount : 0,
  };
}

/** 整批食譜。changed 為 false 時呼叫端不必回寫 */
export function migrateRecipes(raws: unknown[]): { recipes: Recipe[]; changed: boolean } {
  const changed = raws.some(
    (raw) => !isObject(raw) || raw.schemaVersion !== COOK_SCHEMA_VERSION,
  );
  return { recipes: raws.map(migrateRecipe), changed };
}
