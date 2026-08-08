/**
 * 打卡 checklist 的中介型別與推導。
 *
 * 顯示欄位（動作名、步驟、注意事項）重用 display.ts，數值規格（組數、次數、
 * 秒數）則是 display 沒有而打卡才需要的，因此在此另外帶出來。
 * 全部為純函式、無副作用，方便單獨驗證。
 *
 * 設計決策見 doc/plan/2026-07-31-workout-batch-b.md 第 2 節。
 */
import { fallbackToDisplay, stagesToDisplay, type DisplayItem } from './display';
import { newId } from './localRepository';
import type {
  ExerciseDef,
  FallbackRoutine,
  Id,
  LogItem,
  LogStatus,
  MeasureType,
  NumRange,
  Stage,
  StageItem,
  StageSelection,
} from './types';

/**
 * 打卡輸入的時間單位。
 * 由 durationSeconds 的數量級推導，不另存欄位（roadmap §3.6）——
 * 多一個欄位反而要維護一致性。
 */
export type DurationUnit = 'minute' | 'second';

/** 超過這個秒數就以分鐘輸入。「MV 舞蹈 10–15 分鐘」不該要人填 600 秒 */
const MINUTE_INPUT_THRESHOLD = 120;

export interface ChecklistItem {
  /** 對應 StageItem.id，寫入 LogItem.stageItemId */
  stageItemId: Id;
  /** 顯示用資料，可直接餵給 ExerciseDetail */
  display: DisplayItem;
  measureType: MeasureType;
  sets?: number;
  reps?: NumRange;
  durationSeconds?: NumRange;
  holdSeconds?: number;
  perSide?: boolean;
  weightKg?: number;
  durationUnit: DurationUnit;
}

export interface ChecklistStage {
  key: string;
  name: string;
  selection: StageSelection;
  estimatedMinutes?: NumRange;
  rounds?: NumRange;
  restBetweenRoundsSeconds?: NumRange;
  note?: string;
  items: ChecklistItem[];
  /**
   * 沒有任何可勾項目的階段（目前僅「NEAT 廚房日常熱量消耗」）。
   * 只顯示說明、不給打勾框，也不進完成判定——
   * 它本來就沒有可計量的內容，逼使用者表態只會產生沒有意義的資料。
   */
  descriptive: boolean;
}

/** 單一項目的打卡狀態。以 stageItemId 為鍵存在 view 的 ref 中 */
export interface ItemState {
  done: boolean;
  actualSets?: number;
  actualReps?: number;
  /** 一律以秒儲存，UI 依 durationUnit 換算後顯示 */
  actualDurationSeconds?: number;
  actualWeightKg?: number;
  note?: string;
}

export type ItemStateMap = Record<Id, ItemState>;

// ---------------------------------------------------------------------------
// 建表
// ---------------------------------------------------------------------------

export function durationUnitOf(range: NumRange | undefined): DurationUnit {
  return range && range.min >= MINUTE_INPUT_THRESHOLD ? 'minute' : 'second';
}

/** 秒 → UI 輸入值 */
export function toDurationInput(
  seconds: number | undefined,
  unit: DurationUnit,
): number | undefined {
  if (seconds === undefined) return undefined;
  return unit === 'minute' ? Math.round((seconds / 60) * 10) / 10 : seconds;
}

/** UI 輸入值 → 秒 */
export function fromDurationInput(
  value: number | undefined,
  unit: DurationUnit,
): number | undefined {
  if (value === undefined || Number.isNaN(value)) return undefined;
  return unit === 'minute' ? Math.round(value * 60) : Math.round(value);
}

function toChecklistItem(item: StageItem, display: DisplayItem): ChecklistItem {
  return {
    stageItemId: item.id,
    display,
    measureType: item.measureType,
    sets: item.sets,
    reps: item.reps,
    durationSeconds: item.durationSeconds,
    holdSeconds: item.holdSeconds,
    perSide: item.perSide,
    weightKg: item.weightKg,
    durationUnit: durationUnitOf(item.durationSeconds),
  };
}

/**
 * 以 DisplayItem.key（已儲存課表即 StageItem.id）對應回原始 StageItem，
 * 避免在此重寫一份動作查表邏輯。
 */
function zipItems(items: StageItem[], displays: DisplayItem[]): ChecklistItem[] {
  const byKey = new Map(displays.map((display) => [display.key, display]));
  return [...items]
    .sort((a, b) => a.order - b.order)
    .flatMap((item) => {
      const display = byKey.get(item.id);
      return display ? [toChecklistItem(item, display)] : [];
    });
}

export function buildStageChecklist(stages: Stage[], exercises: ExerciseDef[]): ChecklistStage[] {
  const displays = stagesToDisplay(stages, exercises);
  const byKey = new Map(stages.map((stage) => [stage.id, stage]));

  return displays.map((display) => {
    const stage = byKey.get(display.key);
    const items = stage ? zipItems(stage.items, display.items) : [];
    return {
      key: display.key,
      name: display.name,
      selection: display.selection,
      estimatedMinutes: display.estimatedMinutes,
      rounds: display.rounds,
      restBetweenRoundsSeconds: display.restBetweenRoundsSeconds,
      note: display.note,
      items,
      descriptive: items.length === 0,
    };
  });
}

/** 備用課表沒有階段層級，整份視為單一 'all' 階段 */
export function buildFallbackChecklist(
  fallback: FallbackRoutine,
  exercises: ExerciseDef[],
): ChecklistStage[] {
  const display = fallbackToDisplay(fallback, exercises);
  const items = zipItems(fallback.items, display.items);
  return [
    {
      key: display.key,
      name: display.name,
      selection: 'all',
      estimatedMinutes: display.estimatedMinutes,
      note: display.note,
      items,
      descriptive: items.length === 0,
    },
  ];
}

// ---------------------------------------------------------------------------
// 勾選與完成判定
// ---------------------------------------------------------------------------

export function emptyState(): ItemState {
  return { done: false };
}

/**
 * 一鍵全部完成。
 *
 * 'choose-one' 階段只勾第一項：全勾會記成「兩個動作都做了」，
 * 這筆假資料會直接進批次 C 的動作進步趨勢圖。
 * descriptive 階段（NEAT）完全略過。
 */
export function markAllDone(stages: ChecklistStage[], states: ItemStateMap): ItemStateMap {
  const next: ItemStateMap = { ...states };
  stages.forEach((stage) => {
    if (stage.descriptive) return;
    const targets = stage.selection === 'choose-one' ? stage.items.slice(0, 1) : stage.items;
    targets.forEach((item) => {
      next[item.stageItemId] = { ...(next[item.stageItemId] ?? emptyState()), done: true };
    });
  });
  return next;
}

/** 一鍵取消。誤按「全部完成」時要有辦法還原，否則只能逐項點掉 */
export function clearAll(stages: ChecklistStage[], states: ItemStateMap): ItemStateMap {
  const next: ItemStateMap = { ...states };
  stages.forEach((stage) => {
    stage.items.forEach((item) => {
      next[item.stageItemId] = { ...(next[item.stageItemId] ?? emptyState()), done: false };
    });
  });
  return next;
}

export function isStageSatisfied(stage: ChecklistStage, states: ItemStateMap): boolean {
  if (stage.descriptive) return true;
  const doneCount = stage.items.filter((item) => states[item.stageItemId]?.done).length;
  return stage.selection === 'choose-one' ? doneCount >= 1 : doneCount === stage.items.length;
}

export function countDone(stages: ChecklistStage[], states: ItemStateMap): number {
  return stages.reduce(
    (total, stage) => total + stage.items.filter((item) => states[item.stageItemId]?.done).length,
    0,
  );
}

/** 所有階段都滿足時需要勾的總項數。choose-one 只算 1，descriptive 算 0 */
export function countRequired(stages: ChecklistStage[]): number {
  return stages.reduce((total, stage) => {
    if (stage.descriptive) return total;
    return total + (stage.selection === 'choose-one' ? 1 : stage.items.length);
  }, 0);
}

/**
 * 由勾選結果推導完成狀態。
 * null 代表一項都沒勾——此時不該產生紀錄，由呼叫端擋下儲存。
 *
 * 不開放手動選 done / partial：批次 C 的嚴格達成率直接吃 status，
 * 讓使用者在只勾三項時按下「完成」會讓那條線失去意義。
 */
export function deriveStatus(stages: ChecklistStage[], states: ItemStateMap): LogStatus | null {
  // 整份都沒有可勾的項目（例如只有 NEAT 描述階段的日子）：
  // 使用者按下儲存這個動作本身就是「我做了」，否則這天永遠打不了卡
  if (countRequired(stages) === 0) return 'done';
  if (countDone(stages, states) === 0) return null;
  return stages.every((stage) => isStageSatisfied(stage, states)) ? 'done' : 'partial';
}

// ---------------------------------------------------------------------------
// 與 WorkoutLog 互轉
// ---------------------------------------------------------------------------

/**
 * 以既有紀錄回填勾選狀態。
 * 找不到對應 stageItemId 的舊項目直接忽略——換 variant 或換課表版本時本來就對不上。
 */
export function statesFromLog(stages: ChecklistStage[], items: LogItem[]): ItemStateMap {
  const byStageItemId = new Map(
    items.flatMap((item) => (item.stageItemId ? [[item.stageItemId, item] as const] : [])),
  );
  const states: ItemStateMap = {};
  stages.forEach((stage) => {
    stage.items.forEach((item) => {
      const logged = byStageItemId.get(item.stageItemId);
      states[item.stageItemId] = logged
        ? {
            done: logged.done,
            actualSets: logged.actualSets,
            actualReps: logged.actualReps,
            actualDurationSeconds: logged.actualDurationSeconds,
            actualWeightKg: logged.actualWeightKg,
            note: logged.note,
          }
        : emptyState();
    });
  });
  return states;
}

/**
 * 產生要寫入 WorkoutLog 的項目。
 * 未勾的項目也一併寫入（done: false），批次 C 才分得出
 * 「這天沒做這一項」與「那份課表根本沒有這一項」。
 */
export function statesToLogItems(stages: ChecklistStage[], states: ItemStateMap): LogItem[] {
  return stages.flatMap((stage) =>
    stage.items.map((item) => {
      const state = states[item.stageItemId] ?? emptyState();
      return {
        id: newId(),
        stageItemId: item.stageItemId,
        exerciseId: item.display.exerciseId,
        name: item.display.name,
        done: state.done,
        actualSets: state.actualSets,
        actualReps: state.actualReps,
        actualDurationSeconds: state.actualDurationSeconds,
        actualWeightKg: state.actualWeightKg,
        note: state.note,
      } satisfies LogItem;
    }),
  );
}
