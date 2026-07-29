/**
 * schema v1 → v2 遷移。純函式、無副作用，方便以腳本單獨驗證。
 *
 * v1 的差異：
 * - PlanGroup 直接持有 stages，沒有 variants
 * - PlanGroup 沒有 countsTowardQuota
 * - Stage 沒有 selection
 * - StageItem.durationSeconds 是數字而非 NumRange
 * - WorkoutPlan 沒有 avoidances
 *
 * 遷移只補結構、不改內容，鎖定狀態也原樣保留。
 */
import {
  WORKOUT_SCHEMA_VERSION,
  type NumRange,
  type PlanGroup,
  type PlanVariant,
  type Stage,
  type StageItem,
  type WorkoutPlan,
} from './types';

type Raw = Record<string, unknown>;

function isObject(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** v1 的 durationSeconds 是數字，v2 是 NumRange */
function toRange(value: unknown): NumRange | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return { min: value };
  if (!isObject(value)) return undefined;
  const min = value.min;
  if (typeof min !== 'number' || !Number.isFinite(min)) return undefined;
  const max = value.max;
  return typeof max === 'number' && Number.isFinite(max) && max !== min ? { min, max } : { min };
}

function migrateItem(raw: unknown): StageItem {
  const item = isObject(raw) ? raw : {};
  return {
    ...(item as unknown as StageItem),
    durationSeconds: toRange(item.durationSeconds),
  };
}

function migrateStage(raw: unknown): Stage {
  const stage = isObject(raw) ? raw : {};
  return {
    ...(stage as unknown as Stage),
    // v1 沒有擇一的概念，一律視為全做
    selection: stage.selection === 'choose-one' ? 'choose-one' : 'all',
    items: asArray(stage.items).map(migrateItem),
  };
}

/**
 * v1 群組的 stages 包成單一 variant。
 * label 沿用群組名稱——當時本來就只有一種內容，沒有另一個名字可用。
 */
function migrateGroup(raw: unknown): PlanGroup {
  const group = isObject(raw) ? raw : {};
  const estimatedMinutes = toRange(group.estimatedMinutes) ?? { min: 0 };
  const label = typeof group.label === 'string' ? group.label : '未命名群組';

  const variants: PlanVariant[] = Array.isArray(group.variants)
    ? group.variants.map((raw): PlanVariant => {
        const variant = isObject(raw) ? raw : {};
        return {
          ...(variant as unknown as PlanVariant),
          stages: asArray(variant.stages).map(migrateStage),
        };
      })
    : [
        {
          id: `${typeof group.id === 'string' ? group.id : 'group'}-v1`,
          label,
          summary: typeof group.summary === 'string' ? group.summary : undefined,
          estimatedMinutes,
          stages: asArray(group.stages).map(migrateStage),
        },
      ];

  const migrated: PlanGroup = {
    ...(group as unknown as PlanGroup),
    label,
    estimatedMinutes,
    // v1 的每個群組都計入配額
    countsTowardQuota: group.countsTowardQuota === false ? false : true,
    variants,
  };
  // v1 的 stages 已併入 variants，留著會與 variants 不同步
  delete (migrated as unknown as Raw).stages;
  return migrated;
}

/** 單份課表。已是 v2 就原樣回傳 */
export function migratePlan(raw: unknown): WorkoutPlan {
  const plan = isObject(raw) ? raw : {};
  if (plan.schemaVersion === WORKOUT_SCHEMA_VERSION) return plan as unknown as WorkoutPlan;

  return {
    ...(plan as unknown as WorkoutPlan),
    schemaVersion: WORKOUT_SCHEMA_VERSION,
    groups: asArray(plan.groups).map(migrateGroup),
    fallbackRoutines: asArray(plan.fallbackRoutines).map((raw) => {
      const fallback = isObject(raw) ? raw : {};
      return {
        ...(fallback as unknown as WorkoutPlan['fallbackRoutines'][number]),
        items: asArray(fallback.items).map(migrateItem),
      };
    }),
    avoidances: Array.isArray(plan.avoidances)
      ? plan.avoidances.filter((item): item is string => typeof item === 'string')
      : [],
  };
}

/** 整批課表。changed 為 false 時呼叫端不必回寫 */
export function migratePlans(raws: unknown[]): { plans: WorkoutPlan[]; changed: boolean } {
  const changed = raws.some(
    (raw) => !isObject(raw) || raw.schemaVersion !== WORKOUT_SCHEMA_VERSION,
  );
  return { plans: raws.map(migratePlan), changed };
}
