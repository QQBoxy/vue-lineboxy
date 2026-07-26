import type {
  BackupFile,
  DateString,
  ExerciseDef,
  Id,
  WorkoutLog,
  WorkoutMeta,
  WorkoutPlan,
} from './types';

/**
 * 運動計畫的資料存取介面。
 *
 * 所有方法一律 async，即使目前的 localStorage 實作是同步的。
 * 如此日後改接後端（apiRepository）時，畫面層一行都不用改。
 */
export interface WorkoutRepository {
  // 動作庫
  listExercises(): Promise<ExerciseDef[]>;
  getExercise(id: Id): Promise<ExerciseDef | null>;
  /** 依 id 更新，或依 name 建立／沿用既有動作 */
  upsertExercise(input: Partial<ExerciseDef> & { name: string }): Promise<ExerciseDef>;

  // 課表
  listPlans(): Promise<WorkoutPlan[]>;
  getPlan(id: Id): Promise<WorkoutPlan | null>;
  /** 取得該日期生效的課表：effectiveFrom <= date 之中最晚生效的一份 */
  getPlanForDate(date: DateString): Promise<WorkoutPlan | null>;
  savePlan(plan: WorkoutPlan): Promise<WorkoutPlan>;
  /**
   * 只調整生效日。即使課表已鎖定仍可調整——生效日不是課表內容，
   * 既有打卡以 planId 硬連結，改生效日不會竄改任何歷史紀錄。
   */
  updateEffectiveFrom(id: Id, effectiveFrom: DateString): Promise<WorkoutPlan>;

  // 打卡
  listLogs(from: DateString, to: DateString): Promise<WorkoutLog[]>;
  getLogsByDate(date: DateString): Promise<WorkoutLog[]>;
  saveLog(log: WorkoutLog): Promise<WorkoutLog>;
  deleteLog(id: Id): Promise<void>;

  // 備份
  getMeta(): Promise<WorkoutMeta>;
  markBackedUp(at: string): Promise<void>;
  exportAll(): Promise<BackupFile>;
  importAll(backup: BackupFile): Promise<void>;
}
