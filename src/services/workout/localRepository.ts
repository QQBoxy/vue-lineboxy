import { migratePlans } from './migrate';
import type { WorkoutRepository } from './repository';
import {
  WORKOUT_SCHEMA_VERSION,
  type BackupFile,
  type DateString,
  type ExerciseDef,
  type Id,
  type WorkoutLog,
  type WorkoutMeta,
  type WorkoutPlan,
} from './types';

const KEY_META = 'lineboxy.workout.meta';
const KEY_EXERCISES = 'lineboxy.workout.exercises';
const KEY_PLANS = 'lineboxy.workout.plans';
const KEY_LOGS = 'lineboxy.workout.logs';

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
 * 所有讀取課表的入口。舊版格式在此就地升級並回寫，
 * 讓其餘程式碼永遠只看得到目前版本的形狀。
 */
function readPlans(): WorkoutPlan[] {
  const raw = read<unknown[]>(KEY_PLANS, []);
  const { plans, changed } = migratePlans(raw);
  if (changed) write(KEY_PLANS, plans);
  return plans;
}

export class LocalWorkoutRepository implements WorkoutRepository {
  // --- 動作庫 -------------------------------------------------------------

  async listExercises(): Promise<ExerciseDef[]> {
    return read<ExerciseDef[]>(KEY_EXERCISES, []);
  }

  async getExercise(id: Id): Promise<ExerciseDef | null> {
    const all = await this.listExercises();
    return all.find((item) => item.id === id) ?? null;
  }

  async upsertExercise(input: Partial<ExerciseDef> & { name: string }): Promise<ExerciseDef> {
    const all = await this.listExercises();
    const now = new Date().toISOString();
    const found = input.id
      ? all.find((item) => item.id === input.id)
      : all.find((item) => item.name === input.name);

    if (found) {
      const updated: ExerciseDef = { ...found, ...input, id: found.id, updatedAt: now };
      write(
        KEY_EXERCISES,
        all.map((item) => (item.id === found.id ? updated : item)),
      );
      return updated;
    }

    const created: ExerciseDef = {
      id: input.id ?? newId(),
      name: input.name,
      nameEn: input.nameEn,
      targetMuscles: input.targetMuscles ?? [],
      equipment: input.equipment ?? [],
      steps: input.steps ?? [],
      cautions: input.cautions ?? [],
      videoUrl: input.videoUrl,
      createdAt: now,
      updatedAt: now,
    };
    write(KEY_EXERCISES, [...all, created]);
    return created;
  }

  // --- 課表 ---------------------------------------------------------------

  async listPlans(): Promise<WorkoutPlan[]> {
    const plans = readPlans();
    // 生效日新到舊；同日則版次大的在前
    return plans.sort((a, b) =>
      a.effectiveFrom === b.effectiveFrom
        ? b.version - a.version
        : b.effectiveFrom.localeCompare(a.effectiveFrom),
    );
  }

  async getPlan(id: Id): Promise<WorkoutPlan | null> {
    const all = await this.listPlans();
    return all.find((plan) => plan.id === id) ?? null;
  }

  async getPlanForDate(date: DateString): Promise<WorkoutPlan | null> {
    const all = await this.listPlans();
    return all.find((plan) => plan.effectiveFrom <= date) ?? null;
  }

  async savePlan(plan: WorkoutPlan): Promise<WorkoutPlan> {
    const all = readPlans();
    const existing = all.find((item) => item.id === plan.id);

    if (existing?.locked) {
      throw new Error('此課表版本已有打卡紀錄引用，不可修改；請改為匯入新版本。');
    }

    const next = existing
      ? all.map((item) => (item.id === plan.id ? plan : item))
      : [...all, plan];
    write(KEY_PLANS, next);
    return plan;
  }

  async updateEffectiveFrom(id: Id, effectiveFrom: DateString): Promise<WorkoutPlan> {
    const all = readPlans();
    const target = all.find((plan) => plan.id === id);
    if (!target) throw new Error('找不到這份課表。');

    const updated = { ...target, effectiveFrom };
    write(
      KEY_PLANS,
      all.map((plan) => (plan.id === id ? updated : plan)),
    );
    return updated;
  }

  // --- 打卡 ---------------------------------------------------------------

  async listLogs(from: DateString, to: DateString): Promise<WorkoutLog[]> {
    const all = read<WorkoutLog[]>(KEY_LOGS, []);
    return all
      .filter((log) => log.date >= from && log.date <= to)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async getLogsByDate(date: DateString): Promise<WorkoutLog[]> {
    return this.listLogs(date, date);
  }

  async saveLog(log: WorkoutLog): Promise<WorkoutLog> {
    const all = read<WorkoutLog[]>(KEY_LOGS, []);
    const exists = all.some((item) => item.id === log.id);
    write(KEY_LOGS, exists ? all.map((item) => (item.id === log.id ? log : item)) : [...all, log]);

    // 被打卡引用的課表版本自此鎖定，確保歷史紀錄不會被竄改
    if (log.planId) await this.lockPlan(log.planId);
    return log;
  }

  async deleteLog(id: Id): Promise<void> {
    const all = read<WorkoutLog[]>(KEY_LOGS, []);
    write(
      KEY_LOGS,
      all.filter((item) => item.id !== id),
    );
  }

  private async lockPlan(planId: Id): Promise<void> {
    const all = readPlans();
    const target = all.find((plan) => plan.id === planId);
    if (!target || target.locked) return;
    write(
      KEY_PLANS,
      all.map((plan) => (plan.id === planId ? { ...plan, locked: true } : plan)),
    );
  }

  // --- 備份 ---------------------------------------------------------------

  async getMeta(): Promise<WorkoutMeta> {
    return read<WorkoutMeta>(KEY_META, { schemaVersion: WORKOUT_SCHEMA_VERSION });
  }

  async markBackedUp(at: string): Promise<void> {
    const meta = await this.getMeta();
    write(KEY_META, { ...meta, schemaVersion: WORKOUT_SCHEMA_VERSION, lastBackupAt: at });
  }

  async exportAll(): Promise<BackupFile> {
    return {
      schemaVersion: WORKOUT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      exercises: await this.listExercises(),
      plans: readPlans(),
      logs: read<WorkoutLog[]>(KEY_LOGS, []),
    };
  }

  async importAll(backup: BackupFile): Promise<void> {
    // 舊版備份檔可以升級後匯入；比目前新的則無從得知未來格式，只能擋下
    if (backup.schemaVersion > WORKOUT_SCHEMA_VERSION) {
      throw new Error(
        `備份檔格式版本為 ${backup.schemaVersion}，高於目前支援的 ${WORKOUT_SCHEMA_VERSION}，無法匯入。請先更新 app。`,
      );
    }
    write(KEY_EXERCISES, clone(backup.exercises));
    write(KEY_PLANS, migratePlans(clone(backup.plans)).plans);
    write(KEY_LOGS, clone(backup.logs));
  }
}

/** 批次 A 使用的預設實作。日後接後端時改為匯出 apiRepository 即可 */
export const workoutRepository: WorkoutRepository = new LocalWorkoutRepository();
