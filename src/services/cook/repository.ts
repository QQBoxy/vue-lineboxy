import type {
  CookBackupFile,
  CookLog,
  CookMeta,
  CookSettings,
  DateString,
  Id,
  Ingredient,
  Recipe,
} from './types';

/**
 * 獺廚娘的資料存取介面。
 *
 * 所有方法一律 async，即使目前的 localStorage 實作是同步的。
 * 如此日後改接後端（apiRepository）時，畫面層一行都不用改。
 */
export interface CookRepository {
  // 食材主檔
  listIngredients(): Promise<Ingredient[]>;
  getIngredient(id: Id): Promise<Ingredient | null>;
  /** 依 id 更新，或依 name + kind 建立／沿用既有食材 */
  upsertIngredient(
    input: Partial<Ingredient> & { name: string; kind: Ingredient['kind'] },
  ): Promise<Ingredient>;

  // 食譜
  /** 由新至舊（createdAt 倒序） */
  listRecipes(): Promise<Recipe[]>;
  getRecipe(id: Id): Promise<Recipe | null>;
  /**
   * 存檔並回填食材主檔：比對舊版與新版的 ingredients，
   * 對主檔做 usageCount 增減，並更新 defaultUnit 與 lastUsedAt；
   * 尚未建檔的食材名稱在此建立主檔，回傳的 Recipe 會帶上補齊的 ingredientId。
   */
  saveRecipe(recipe: Recipe): Promise<Recipe>;
  deleteRecipe(id: Id): Promise<void>;

  // 烹飪紀錄（批次 A 只實作、不接 UI）
  listLogs(from: DateString, to: DateString): Promise<CookLog[]>;
  getLogsByDate(date: DateString): Promise<CookLog[]>;
  /** 存檔並回填食譜的 mealTags / cookCount / lastCookedAt */
  saveLog(log: CookLog): Promise<CookLog>;
  deleteLog(id: Id): Promise<void>;

  // 設定
  getSettings(): Promise<CookSettings>;
  saveSettings(settings: CookSettings): Promise<CookSettings>;

  // 備份
  getMeta(): Promise<CookMeta>;
  markBackedUp(at: string): Promise<void>;
  exportAll(): Promise<CookBackupFile>;
  importAll(backup: CookBackupFile): Promise<void>;
}
