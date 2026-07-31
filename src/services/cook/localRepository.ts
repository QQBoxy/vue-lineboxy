import { migrateRecipes } from './migrate';
import type { CookRepository } from './repository';
import { findIngredientByName } from './suggest';
import {
  COOK_SCHEMA_VERSION,
  DEFAULT_COOK_SETTINGS,
  type CookBackupFile,
  type CookLog,
  type CookMeta,
  type CookSettings,
  type DateString,
  type Id,
  type Ingredient,
  type MealSlot,
  type Recipe,
} from './types';

const KEY_META = 'lineboxy.cook.meta';
const KEY_INGREDIENTS = 'lineboxy.cook.ingredients';
const KEY_RECIPES = 'lineboxy.cook.recipes';
const KEY_LOGS = 'lineboxy.cook.logs';
const KEY_SETTINGS = 'lineboxy.cook.settings';

/** 產生字串 id。日後與後端資料合併時不會撞號 */
export function newId(): Id {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Math.random().toString(36).slice(2)}-${String(performance.now()).replace('.', '')}`;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch (e) {
    console.error(`讀取 ${key} 失敗，改用預設值：`, e);
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

/** 深拷貝，避免呼叫端改到儲存層的物件 */
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * 所有讀取食譜的入口。舊版格式在此就地升級並回寫，
 * 讓其餘程式碼永遠只看得到目前版本的形狀。
 */
function readRecipes(): Recipe[] {
  const raw = read<unknown[]>(KEY_RECIPES, []);
  const { recipes, changed } = migrateRecipes(raw);
  if (changed) write(KEY_RECIPES, recipes);
  return recipes;
}

function readIngredients(): Ingredient[] {
  return read<Ingredient[]>(KEY_INGREDIENTS, []);
}

function readLogs(): CookLog[] {
  return read<CookLog[]>(KEY_LOGS, []);
}

/** 一份食譜引用了哪些食材（去重）。同一食材在同張食譜列兩次只算一次引用 */
function referencedIngredientIds(recipe: Recipe | null): Set<Id> {
  return new Set((recipe?.ingredients ?? []).map((item) => item.ingredientId).filter(Boolean));
}

export class LocalCookRepository implements CookRepository {
  // --- 食材主檔 -----------------------------------------------------------

  async listIngredients(): Promise<Ingredient[]> {
    return readIngredients();
  }

  async getIngredient(id: Id): Promise<Ingredient | null> {
    return readIngredients().find((item) => item.id === id) ?? null;
  }

  async upsertIngredient(
    input: Partial<Ingredient> & { name: string; kind: Ingredient['kind'] },
  ): Promise<Ingredient> {
    const all = readIngredients();
    const now = new Date().toISOString();
    const found = input.id
      ? all.find((item) => item.id === input.id)
      : findIngredientByName(all, input.name, input.kind);

    if (found) {
      const updated: Ingredient = { ...found, ...input, id: found.id, updatedAt: now };
      write(
        KEY_INGREDIENTS,
        all.map((item) => (item.id === found.id ? updated : item)),
      );
      return updated;
    }

    const created: Ingredient = {
      id: input.id ?? newId(),
      name: input.name.trim(),
      kind: input.kind,
      defaultUnit: input.defaultUnit,
      // 第一次輸入就進主檔，但尚未被任何食譜引用，故從 0 起算
      usageCount: input.usageCount ?? 0,
      lastUsedAt: input.lastUsedAt ?? now,
      createdAt: now,
      updatedAt: now,
    };
    write(KEY_INGREDIENTS, [...all, created]);
    return created;
  }

  // --- 食譜 ---------------------------------------------------------------

  async listRecipes(): Promise<Recipe[]> {
    return readRecipes().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getRecipe(id: Id): Promise<Recipe | null> {
    return readRecipes().find((recipe) => recipe.id === id) ?? null;
  }

  /**
   * 存檔並回填主檔。回填集中在 repository 而非畫面層，
   * 是為了讓日後的 apiRepository 有機會改成後端一次交易完成，而畫面層不必知道。
   */
  async saveRecipe(recipe: Recipe): Promise<Recipe> {
    const all = readRecipes();
    const existing = all.find((item) => item.id === recipe.id) ?? null;

    // 尚未對應主檔的食材（使用者手打的新名稱）在此建檔，補上 ingredientId
    const ingredients = await Promise.all(
      recipe.ingredients.map(async (item) => {
        if (item.ingredientId) return item;
        const created = await this.upsertIngredient({
          name: item.nameSnapshot,
          kind: item.kind,
        });
        return { ...item, ingredientId: created.id, nameSnapshot: created.name };
      }),
    );

    const next: Recipe = { ...recipe, ingredients };
    write(
      KEY_RECIPES,
      existing ? all.map((item) => (item.id === next.id ? next : item)) : [...all, next],
    );

    this.syncIngredientUsage(existing, next);
    return next;
  }

  async deleteRecipe(id: Id): Promise<void> {
    const all = readRecipes();
    const target = all.find((recipe) => recipe.id === id) ?? null;
    write(
      KEY_RECIPES,
      all.filter((recipe) => recipe.id !== id),
    );
    // 食譜沒了，它貢獻的引用次數也要收回，否則排序會被幽靈資料帶偏
    this.syncIngredientUsage(target, null);
  }

  /**
   * 依「舊版 → 新版」的引用差異調整主檔的 usageCount，
   * 並把仍在使用中的食材的 defaultUnit / lastUsedAt 更新為這次的內容。
   *
   * 用差異而非「每次輸入 +1」，否則編輯同一張食譜三次會讓次數虛增。
   */
  private syncIngredientUsage(before: Recipe | null, after: Recipe | null): void {
    const oldIds = referencedIngredientIds(before);
    const newIds = referencedIngredientIds(after);
    const now = new Date().toISOString();

    // 同一食材在食譜中可能列兩次（例如蔥分成爆香與盛盤），取最後一次填的單位
    const unitById = new Map<Id, string | undefined>();
    (after?.ingredients ?? []).forEach((item) => {
      if (item.ingredientId && item.unit) unitById.set(item.ingredientId, item.unit);
    });

    const all = readIngredients();
    let changed = false;

    const updated = all.map((item) => {
      const added = newIds.has(item.id) && !oldIds.has(item.id);
      const removed = oldIds.has(item.id) && !newIds.has(item.id);
      const stillUsed = newIds.has(item.id);
      if (!added && !removed && !stillUsed) return item;

      changed = true;
      const delta = added ? 1 : removed ? -1 : 0;
      return {
        ...item,
        usageCount: Math.max(0, item.usageCount + delta),
        defaultUnit: unitById.get(item.id) ?? item.defaultUnit,
        lastUsedAt: stillUsed ? now : item.lastUsedAt,
        updatedAt: now,
      };
    });

    if (changed) write(KEY_INGREDIENTS, updated);
  }

  // --- 烹飪紀錄 -----------------------------------------------------------

  async listLogs(from: DateString, to: DateString): Promise<CookLog[]> {
    return readLogs()
      .filter((log) => log.date >= from && log.date <= to)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async getLogsByDate(date: DateString): Promise<CookLog[]> {
    return this.listLogs(date, date);
  }

  async saveLog(log: CookLog): Promise<CookLog> {
    const all = readLogs();
    const existing = all.find((item) => item.id === log.id) ?? null;
    write(
      KEY_LOGS,
      existing ? all.map((item) => (item.id === log.id ? log : item)) : [...all, log],
    );

    // 編輯紀錄時食譜可能被換掉，兩邊的統計都要重算
    this.syncRecipeStats([log.recipeId, existing?.recipeId]);
    return log;
  }

  async deleteLog(id: Id): Promise<void> {
    const all = readLogs();
    const target = all.find((log) => log.id === id) ?? null;
    write(
      KEY_LOGS,
      all.filter((log) => log.id !== id),
    );
    this.syncRecipeStats([target?.recipeId]);
  }

  /**
   * 由紀錄重算食譜的 mealTags / cookCount / lastCookedAt。
   *
   * 用「重算」而非「+1／-1」：紀錄才是這三個欄位的真相來源，
   * 重算對新增、修改、刪除三種操作都是同一段邏輯，也不會因為
   * 中途失敗而讓計數永久偏掉。
   */
  private syncRecipeStats(recipeIds: (Id | undefined)[]): void {
    const targets = new Set(recipeIds.filter((id): id is Id => !!id));
    if (targets.size === 0) return;

    const logs = readLogs();
    const all = readRecipes();
    let changed = false;

    const updated = all.map((recipe) => {
      if (!targets.has(recipe.id)) return recipe;

      const own = logs.filter((log) => log.recipeId === recipe.id);
      const mealTags: MealSlot[] = [];
      own.forEach((log) => {
        if (!mealTags.includes(log.meal)) mealTags.push(log.meal);
      });
      const lastCookedAt = own.reduce<DateString | undefined>(
        (latest, log) => (!latest || log.date > latest ? log.date : latest),
        undefined,
      );

      changed = true;
      return { ...recipe, mealTags, cookCount: own.length, lastCookedAt };
    });

    if (changed) write(KEY_RECIPES, updated);
  }

  // --- 設定 ---------------------------------------------------------------

  async getSettings(): Promise<CookSettings> {
    // 展開預設值再覆蓋，日後新增設定項時舊資料不會少欄位
    return { ...DEFAULT_COOK_SETTINGS, ...read<Partial<CookSettings>>(KEY_SETTINGS, {}) };
  }

  async saveSettings(settings: CookSettings): Promise<CookSettings> {
    write(KEY_SETTINGS, settings);
    return settings;
  }

  // --- 備份 ---------------------------------------------------------------

  async getMeta(): Promise<CookMeta> {
    return read<CookMeta>(KEY_META, { schemaVersion: COOK_SCHEMA_VERSION });
  }

  async markBackedUp(at: string): Promise<void> {
    const meta = await this.getMeta();
    write(KEY_META, { ...meta, schemaVersion: COOK_SCHEMA_VERSION, lastBackupAt: at });
  }

  async exportAll(): Promise<CookBackupFile> {
    return {
      schemaVersion: COOK_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      ingredients: readIngredients(),
      recipes: readRecipes(),
      logs: readLogs(),
      settings: await this.getSettings(),
    };
  }

  async importAll(backup: CookBackupFile): Promise<void> {
    // 舊版備份檔可以升級後匯入；比目前新的則無從得知未來格式，只能擋下
    if (backup.schemaVersion > COOK_SCHEMA_VERSION) {
      throw new Error(
        `備份檔格式版本為 ${backup.schemaVersion}，高於目前支援的 ${COOK_SCHEMA_VERSION}，無法匯入。請先更新 app。`,
      );
    }
    write(KEY_INGREDIENTS, clone(backup.ingredients));
    write(KEY_RECIPES, migrateRecipes(clone(backup.recipes)).recipes);
    write(KEY_LOGS, clone(backup.logs));
    write(KEY_SETTINGS, { ...DEFAULT_COOK_SETTINGS, ...clone(backup.settings) });
  }
}

/** 批次 A 使用的預設實作。日後接後端時改為匯出 apiRepository 即可 */
export const cookRepository: CookRepository = new LocalCookRepository();
