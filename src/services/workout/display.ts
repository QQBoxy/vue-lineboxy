/**
 * 畫面用的中介型別與轉換。
 *
 * 課表草稿（匯入預覽）與已儲存課表（課表檢視）的資料形狀不同，
 * 但要用同一組元件呈現，因此在此統一轉成 Display* 形狀。
 * 型別放在 .ts 而非 .vue，是因為 <script setup> 不能 export 型別。
 */
import type {
  DraftFallback,
  DraftGroup,
  DraftItem,
  DraftStage,
  ExerciseDraft,
} from './parsePlan';
import type {
  ExerciseDef,
  FallbackRoutine,
  GroupRequirement,
  Id,
  IsoWeekday,
  MeasureType,
  NumRange,
  Stage,
  StageItem,
  WorkoutPlan,
} from './types';

/** 七天總覽所需的最小群組形狀 */
export interface WeekGroup {
  key: string;
  label: string;
  weekdays: IsoWeekday[];
  requirement: GroupRequirement;
  estimatedMinutes: NumRange;
}

export interface DisplayItem {
  key: string;
  name: string;
  nameEn?: string;
  targetMuscles: string[];
  equipment: string[];
  steps: string[];
  cautions: string[];
  videoUrl?: string;
  specText: string;
  measureType: MeasureType;
  perSide?: boolean;
  resistance?: string;
  /** 已儲存的課表才有；草稿階段為 undefined，此時不可編輯影片連結 */
  exerciseId?: Id;
}

export interface DisplayStage {
  key: string;
  name: string;
  estimatedMinutes?: NumRange;
  rounds?: NumRange;
  restBetweenRoundsSeconds?: NumRange;
  note?: string;
  items: DisplayItem[];
}

// --- 已儲存課表 → Display ---------------------------------------------------

export function planToWeekGroups(plan: WorkoutPlan | null): WeekGroup[] {
  if (!plan) return [];
  return plan.groups.map((group) => ({
    key: group.id,
    label: group.label,
    weekdays: group.weekdays,
    requirement: group.requirement,
    estimatedMinutes: group.estimatedMinutes,
  }));
}

function stageItemToDisplay(item: StageItem, exercises: Map<Id, ExerciseDef>): DisplayItem {
  const def = exercises.get(item.exerciseId);
  return {
    key: item.id,
    name: def?.name ?? '（找不到動作定義）',
    nameEn: def?.nameEn,
    targetMuscles: def?.targetMuscles ?? [],
    equipment: def?.equipment ?? [],
    steps: def?.steps ?? [],
    cautions: def?.cautions ?? [],
    videoUrl: def?.videoUrl,
    specText: item.specText,
    measureType: item.measureType,
    perSide: item.perSide,
    resistance: item.resistance,
    exerciseId: item.exerciseId,
  };
}

export function stagesToDisplay(stages: Stage[], exercises: ExerciseDef[]): DisplayStage[] {
  const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  return [...stages]
    .sort((a, b) => a.order - b.order)
    .map((stage) => ({
      key: stage.id,
      name: stage.name,
      estimatedMinutes: stage.estimatedMinutes,
      rounds: stage.rounds,
      restBetweenRoundsSeconds: stage.restBetweenRoundsSeconds,
      note: stage.note,
      items: [...stage.items]
        .sort((a, b) => a.order - b.order)
        .map((item) => stageItemToDisplay(item, byId)),
    }));
}

export function fallbackToDisplay(
  fallback: FallbackRoutine,
  exercises: ExerciseDef[],
): DisplayStage {
  const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  return {
    key: fallback.id,
    name: fallback.label,
    estimatedMinutes: fallback.estimatedMinutes,
    note: fallback.when,
    items: [...fallback.items]
      .sort((a, b) => a.order - b.order)
      .map((item) => stageItemToDisplay(item, byId)),
  };
}

// --- 匯入草稿 → Display -----------------------------------------------------

export function draftToWeekGroups(groups: DraftGroup[]): WeekGroup[] {
  return groups.map((group, index) => ({
    key: String(index),
    label: group.label,
    weekdays: group.weekdays,
    requirement: group.requirement,
    estimatedMinutes: group.estimatedMinutes,
  }));
}

function draftItemToDisplay(
  item: DraftItem,
  drafts: Map<string, ExerciseDraft>,
  keyPrefix: string,
): DisplayItem {
  const def = drafts.get(item.exerciseName);
  return {
    key: `${keyPrefix}-${item.order}`,
    name: item.exerciseName,
    nameEn: def?.nameEn,
    targetMuscles: def?.targetMuscles ?? [],
    equipment: def?.equipment ?? [],
    steps: def?.steps ?? [],
    cautions: def?.cautions ?? [],
    videoUrl: def?.videoUrl,
    specText: item.specText,
    measureType: item.measureType,
    perSide: item.perSide,
    resistance: item.resistance,
  };
}

export function draftStagesToDisplay(
  stages: DraftStage[],
  exercises: ExerciseDraft[],
  keyPrefix: string,
): DisplayStage[] {
  const byName = new Map(exercises.map((exercise) => [exercise.name, exercise]));
  return stages.map((stage) => ({
    key: `${keyPrefix}-stage-${stage.order}`,
    name: stage.name,
    estimatedMinutes: stage.estimatedMinutes,
    rounds: stage.rounds,
    restBetweenRoundsSeconds: stage.restBetweenRoundsSeconds,
    note: stage.note,
    items: stage.items.map((item) =>
      draftItemToDisplay(item, byName, `${keyPrefix}-stage-${stage.order}`),
    ),
  }));
}

export function draftFallbackToDisplay(
  fallback: DraftFallback,
  exercises: ExerciseDraft[],
  keyPrefix: string,
): DisplayStage {
  const byName = new Map(exercises.map((exercise) => [exercise.name, exercise]));
  return {
    key: keyPrefix,
    name: fallback.label,
    estimatedMinutes: fallback.estimatedMinutes,
    note: fallback.when,
    items: fallback.items.map((item) => draftItemToDisplay(item, byName, keyPrefix)),
  };
}
