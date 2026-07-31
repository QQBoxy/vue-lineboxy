/**
 * 運動計畫功能的型別定義（唯一真相來源）。
 * 對應計畫文件 doc/plan/done/2026-07-27-workout-feature-batch-a.md 第 2 節，
 * v2 變更見 doc/plan/done/2026-07-30-workout-schema-v2.md 第 3 節。
 */

/**
 * 目前的資料格式版本，日後遷移用。
 * v2：群組加入 variants（同日擇一）、countsTowardQuota（NEAT 日）、
 *     階段加入 selection（階段內擇一）、durationSeconds 改為範圍。
 */
export const WORKOUT_SCHEMA_VERSION = 2;

/** 1 = 週一 … 7 = 週日（ISO-8601） */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** 'YYYY-MM-DD'，一律以本地時區產生，不使用 Date / ISO 字串儲存 */
export type DateString = string;

/** crypto.randomUUID() 產生的字串 id */
export type Id = string;

/** 數值範圍。單一值時只給 min */
export interface NumRange {
  min: number;
  max?: number;
}

/** 打卡時的量測型態，決定打卡 UI 的輸入欄位 */
export type MeasureType = 'reps' | 'time' | 'hold';

/** 群組的達成判定方式（跨星期，例如「週六或週日」） */
export type GroupRequirement = 'all' | 'any-one';

/**
 * 階段內項目的達成判定方式。
 * 'choose-one' 例：廚房 1 分鐘微肌力，伏地挺身與靠牆靜止收縮擇一執行。
 * 與 GroupRequirement 層級不同：這是單一階段內的動作擇一，
 * 整節課的二選一請用 PlanGroup.variants。
 */
export type StageSelection = 'all' | 'choose-one';

// ---------------------------------------------------------------------------
// 動作庫
// ---------------------------------------------------------------------------

/**
 * 動作定義。獨立於課表版本，跨版本以名稱共用同一筆。
 * 屬「參考資料」，允許修改（補影片、修步驟）；課表版本則不可修改。
 */
export interface ExerciseDef {
  id: Id;
  name: string;
  nameEn?: string;
  targetMuscles: string[];
  equipment: string[];
  steps: string[];
  cautions: string[];
  videoUrl?: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// 課表
// ---------------------------------------------------------------------------

/** 階段內對動作的「引用 + 規格」。同一動作在不同階段可有不同規格 */
export interface StageItem {
  id: Id;
  order: number;
  exerciseId: Id;
  measureType: MeasureType;
  /** 單項組數 */
  sets?: number;
  /** 次數，支援範圍如 8-12 次 */
  reps?: NumRange;
  /**
   * 時間型：每組秒數，支援範圍如「MV 舞蹈 10–15 分鐘」。
   * 打卡輸入單位由數量級決定：min >= 120 以分鐘輸入，否則以秒。
   */
  durationSeconds?: NumRange;
  /** 動作內的停留秒數 */
  holdSeconds?: number;
  /** 「兩邊各…」 */
  perSide?: boolean;
  /** 飛輪阻力等非重量強度，如 '0' / '極低' */
  resistance?: string;
  weightKg?: number;
  /** 規格原文，如 '每組 8-12 次'，顯示用 */
  specText: string;
  note?: string;
}

export interface Stage {
  id: Id;
  order: number;
  name: string;
  estimatedMinutes?: NumRange;
  /** 循環訓練組數，如 3-4 組 */
  rounds?: NumRange;
  /** 循環組間休息秒數 */
  restBetweenRoundsSeconds?: NumRange;
  /** 'choose-one' → items 擇一執行即可 */
  selection: StageSelection;
  note?: string;
  items: StageItem[];
}

/**
 * 同一天的可選內容之一，例如週四的「MV 舞蹈」與「坐姿飛輪」。
 * 只有一種內容的日子就是單一 variant，不必特例。
 */
export interface PlanVariant {
  id: Id;
  label: string;
  summary?: string;
  estimatedMinutes: NumRange;
  /** 允許為空（例如僅有描述的「家庭輕活動」） */
  stages: Stage[];
}

export interface PlanGroup {
  id: Id;
  label: string;
  weekdays: IsoWeekday[];
  /** 'any-one' → 該週涵蓋日擇一達成即可 */
  requirement: GroupRequirement;
  summary?: string;
  /** 群組層防護重點 */
  cautions: string[];
  estimatedMinutes: NumRange;
  /**
   * 是否計入「應運動日配額」的分母。
   * NEAT 日（買菜備料煮飯日）設 false：本來就不要求完成大課表，
   * 放進分母只會讓達成率失真；但該日的打卡仍計入「實際運動日」。
   */
  countsTowardQuota: boolean;
  /** 至少一個。length > 1 代表當天二擇一 */
  variants: PlanVariant[];
}

/** 微型／備用課表：不綁星期，忙碌日可主動選用 */
export interface FallbackRoutine {
  id: Id;
  label: string;
  when?: string;
  estimatedMinutes: NumRange;
  items: StageItem[];
}

export interface WorkoutPlan {
  id: Id;
  schemaVersion: number;
  name: string;
  description?: string;
  /**
   * 課表版次。
   * TODO: 目前為全域編號，未來可能調整成「同一系列課表」各自計數。
   */
  version: number;
  effectiveFrom: DateString;
  groups: PlanGroup[];
  fallbackRoutines: FallbackRoutine[];
  medicalNotes: string[];
  /**
   * 全課表層級的禁忌動作，如 ['深蹲', '跳躍', '爬樓梯']。
   * 與 medicalNotes（病史）性質不同：這是可機器檢查的規則，
   * 匯入新版時掃描動作名稱與步驟，命中即警告——AI 重出課表最容易
   * 悄悄把被排除的動作放回來。
   */
  avoidances: string[];
  /** 匯入時的原始文字，保留備查 */
  sourceText?: string;
  /** 已被打卡引用 → true，禁止修改，修改需另建新版本 */
  locked: boolean;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// 打卡（批次 A 先定義型別與資料層，UI 於批次 B 接上）
// ---------------------------------------------------------------------------

export type LogSource = 'group' | 'fallback' | 'freeform';
export type LogStatus = 'done' | 'partial' | 'rest';

export interface LogItem {
  id: Id;
  /** 未填 = 臨時追加的項目 */
  stageItemId?: Id;
  exerciseId?: Id;
  /** 名稱快照，臨時項目亦有名字 */
  name: string;
  done: boolean;
  actualSets?: number;
  actualReps?: number;
  actualDurationSeconds?: number;
  actualWeightKg?: number;
  note?: string;
}

export interface WorkoutLog {
  id: Id;
  date: DateString;
  /** 該日期生效的課表。自由運動且當天沒有任何生效課表時為 undefined */
  planId?: Id;
  planVersion?: number;
  source: LogSource;
  groupId?: Id;
  /** 當天實際做了哪個選項。舊資料為空 = 當時只有一個選項 */
  variantId?: Id;
  fallbackId?: Id;
  status: LogStatus;
  totalMinutes?: number;
  /** 自覺強度 1–10 */
  rpe?: number;
  note?: string;
  items: LogItem[];
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// 備份
// ---------------------------------------------------------------------------

export interface BackupFile {
  schemaVersion: number;
  exportedAt: string;
  exercises: ExerciseDef[];
  plans: WorkoutPlan[];
  logs: WorkoutLog[];
}

export interface WorkoutMeta {
  schemaVersion: number;
  lastBackupAt?: string;
}
