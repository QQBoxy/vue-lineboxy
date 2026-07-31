/**
 * 獺廚娘（烹飪紀錄）功能的型別定義（唯一真相來源）。
 * 對應計畫文件 doc/plan/2026-07-31-cook-roadmap.md 第 2 節。
 */

/** 目前的資料格式版本，日後遷移用 */
export const COOK_SCHEMA_VERSION = 1;

/** 'YYYY-MM-DD'，一律以本地時區產生，不使用 Date / ISO 字串儲存 */
export type DateString = string;

/** crypto.randomUUID() 產生的字串 id */
export type Id = string;

/** 時段。屬於「紀錄」，不屬於食譜 */
export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'lateNight' | 'snack';

/**
 * 時段的顯示順序。集中定義，避免每個畫面各自硬寫一份。
 * 順序即為 UI 上由左至右的排列。
 */
export const MEAL_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'lateNight', 'snack'];

export const MEAL_LABELS: Record<MealSlot, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  lateNight: '消夜',
  snack: '點心',
};

/** 列表與標籤用的單字版本，如「早午晚」 */
export const MEAL_SHORT_LABELS: Record<MealSlot, string> = {
  breakfast: '早',
  lunch: '午',
  dinner: '晚',
  lateNight: '夜',
  snack: '點',
};

/**
 * 主檔的分類。UI 分區、單位候選不同，資料層邏輯只寫一份。
 *
 * 只有兩類：醃料用的東西（醬油、米酒、蒜末）與調味料幾乎完全重疊，
 * 若在主檔也分開，同一瓶醬油會變成兩筆、各自累積次數，
 * 在醃料區打字時就查不到已經用過二十次的那筆，自動完成等於白做。
 */
export type IngredientKind = 'food' | 'seasoning';

/**
 * 食譜中的分區。比主檔多一個「醃料」——它是擺放位置的差異，不是東西的差異。
 * 醃料的單位候選與自動完成一律比照調味料。
 */
export type RecipeSection = 'food' | 'marinade' | 'seasoning';

/** 編輯與檢視畫面的分區順序，照做菜的順序：備料 → 醃 → 調味 */
export const RECIPE_SECTIONS: RecipeSection[] = ['food', 'marinade', 'seasoning'];

export const SECTION_LABELS: Record<RecipeSection, string> = {
  food: '食材',
  marinade: '醃料',
  seasoning: '調味料',
};

/** 食譜分區 → 主檔分類。醃料與調味料共用同一個主檔池 */
export function masterKindOf(section: RecipeSection): IngredientKind {
  return section === 'food' ? 'food' : 'seasoning';
}

// ---------------------------------------------------------------------------
// 食材主檔
// ---------------------------------------------------------------------------

/**
 * 食材定義。比照 Workout 的 ExerciseDef：獨立於食譜，跨食譜以名稱共用同一筆。
 * 屬「參考資料」，允許修改（改名、調整預設單位）。
 */
export interface Ingredient {
  id: Id;
  name: string;
  kind: IngredientKind;
  /** 上次使用的單位，下次輸入時預選 */
  defaultUnit?: string;
  /**
   * 被食譜引用的次數，自動完成的排序依據。
   * 在食譜存檔時重算（掃該食譜的引用做增減），不是每次輸入就 +1，
   * 否則編輯同一張食譜三次會讓次數虛增。
   */
  usageCount: number;
  lastUsedAt: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// 食譜
// ---------------------------------------------------------------------------

/** 食譜中對食材的引用 + 用量 */
export interface RecipeIngredient {
  id: Id;
  /** 空字串 = 尚未對應到主檔，存檔時由 repository 依 nameSnapshot 建立 */
  ingredientId: Id;
  /** 名稱快照。主檔改名不影響歷史食譜的顯示 */
  nameSnapshot: string;
  /** 在食譜中屬於哪一區。舊資料只會是 'food' / 'seasoning'，仍然合法 */
  kind: RecipeSection;
  /** 未填 = 「適量」 */
  amount?: number;
  /** 單位代碼，或使用者自由輸入的字串 */
  unit?: string;
  note?: string;
}

export interface RecipeSource {
  url: string;
  title?: string;
  /** 由 url 解析而得，非 YT 連結則為空 */
  youtubeId?: string;
}

/**
 * 食譜**可修改**（打錯字、補步驟、加影片），與 Workout 的課表不同。
 * 因為烹飪紀錄記的是「我煮了這道菜」，不是「我照這個版本的規格執行」，
 * 事後修食譜不會讓歷史紀錄失真。故不需要 locked 與版本機制。
 */
export interface Recipe {
  id: Id;
  schemaVersion: number;
  /** 菜名 */
  name: string;
  /** kind 兩種混存，UI 分區顯示 */
  ingredients: RecipeIngredient[];
  /** 編號由 index 推導，刪除中間步驟時不需重編號 */
  steps: string[];
  sources: RecipeSource[];
  note?: string;
  /**
   * 時段標籤。**由 CookLog 自動累積**，非手動輸入。
   * 用於「輸入『早』推薦早餐食譜」與今天煮什麼的篩選。
   */
  mealTags: MealSlot[];
  /** 被煮過的次數與最後一次日期，供加權隨機與列表排序 */
  cookCount: number;
  lastCookedAt?: DateString;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// 烹飪紀錄（批次 A 定義型別與資料層，UI 於批次 B 接上）
// ---------------------------------------------------------------------------

/** 一天允許多筆：三餐各一筆、同一餐煮兩道也各一筆 */
export interface CookLog {
  id: Id;
  date: DateString;
  meal: MealSlot;
  recipeId: Id;
  /** 食譜名稱快照，食譜被刪除後紀錄仍可讀 */
  nameSnapshot: string;
  /** 份量倍率，預設 1。食材用量統計時相乘 */
  servingMultiplier: number;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// 設定與備份
// ---------------------------------------------------------------------------

export interface CookSettings {
  /** 晚餐紀錄後提示打卡「煮飯」（批次 C 接上） */
  workoutSyncEnabled: boolean;
  /** 提示中預填的分鐘數，預設 60 */
  workoutSyncMinutes: number;
  /** 哪些時段觸發提示，預設 ['dinner'] */
  workoutSyncMeals: MealSlot[];
}

export const DEFAULT_COOK_SETTINGS: CookSettings = {
  workoutSyncEnabled: false,
  workoutSyncMinutes: 60,
  workoutSyncMeals: ['dinner'],
};

export interface CookBackupFile {
  schemaVersion: number;
  exportedAt: string;
  ingredients: Ingredient[];
  recipes: Recipe[];
  logs: CookLog[];
  settings: CookSettings;
}

export interface CookMeta {
  schemaVersion: number;
  lastBackupAt?: string;
}
