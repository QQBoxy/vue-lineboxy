/**
 * 匯入：JSON 文字 → 驗證 → 正規化草稿。
 * 對應計畫文件第 4 節。錯誤會阻擋匯入，警告只提示。
 */
import { newId } from './localRepository';
import type { WorkoutRepository } from './repository';
import { ALL_WEEKDAYS, WEEKDAY_LABELS, formatWeekdays, todayString } from './schedule';
import {
  WORKOUT_SCHEMA_VERSION,
  type DateString,
  type ExerciseDef,
  type FallbackRoutine,
  type GroupRequirement,
  type IsoWeekday,
  type MeasureType,
  type NumRange,
  type PlanGroup,
  type Stage,
  type StageItem,
  type WorkoutPlan,
} from './types';

// ---------------------------------------------------------------------------
// 草稿型別：動作尚未解析成 exerciseId，先以名稱承載
// ---------------------------------------------------------------------------

export interface ExerciseDraft {
  name: string;
  nameEn?: string;
  targetMuscles: string[];
  equipment: string[];
  steps: string[];
  cautions: string[];
  videoUrl?: string;
}

export interface DraftItem {
  order: number;
  exerciseName: string;
  measureType: MeasureType;
  sets?: number;
  reps?: NumRange;
  durationSeconds?: number;
  holdSeconds?: number;
  perSide?: boolean;
  resistance?: string;
  weightKg?: number;
  specText: string;
  note?: string;
}

export interface DraftStage {
  order: number;
  name: string;
  estimatedMinutes?: NumRange;
  rounds?: NumRange;
  restBetweenRoundsSeconds?: NumRange;
  note?: string;
  items: DraftItem[];
}

export interface DraftGroup {
  label: string;
  weekdays: IsoWeekday[];
  requirement: GroupRequirement;
  summary?: string;
  cautions: string[];
  estimatedMinutes: NumRange;
  stages: DraftStage[];
}

export interface DraftFallback {
  label: string;
  when?: string;
  estimatedMinutes: NumRange;
  items: DraftItem[];
}

export interface DraftPlan {
  name: string;
  description?: string;
  effectiveFrom: DateString;
  groups: DraftGroup[];
  fallbackRoutines: DraftFallback[];
  medicalNotes: string[];
  sourceText: string;
}

export interface Issue {
  path: string;
  message: string;
}

/** 匯入的動作與現有動作庫的比對結果 */
export interface ExerciseMatch {
  name: string;
  /** 名稱完全相同的既有動作 */
  existingId?: string;
  /** 名稱相近、需人工確認是否為同一動作的動作名稱 */
  similarTo?: string;
  /** 相近對象來自既有動作庫，或是同一份匯入中的另一個動作 */
  similarSource?: 'library' | 'import';
}

export interface ParseResult {
  ok: boolean;
  errors: Issue[];
  warnings: Issue[];
  plan?: DraftPlan;
  exercises: ExerciseDraft[];
  matches: ExerciseMatch[];
  /** 未被任何群組涵蓋的星期（休息日） */
  restWeekdays: IsoWeekday[];
}

export interface ParseContext {
  existingPlans: WorkoutPlan[];
  existingExercises: ExerciseDef[];
}

// ---------------------------------------------------------------------------
// 欄位讀取工具
// ---------------------------------------------------------------------------

type Raw = Record<string, unknown>;

function isObject(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(source: Raw, key: string): string | undefined {
  const value = source[key];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

function readStringArray(source: Raw, key: string): string[] {
  const value = source[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim() !== '');
}

function readNumber(source: Raw, key: string): number | undefined {
  const value = source[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readBoolean(source: Raw, key: string): boolean | undefined {
  const value = source[key];
  return typeof value === 'boolean' ? value : undefined;
}

/** 接受 30 或 { min: 20, max: 30 } 兩種寫法 */
function readRange(source: Raw, key: string): NumRange | undefined {
  const value = source[key];
  if (typeof value === 'number' && Number.isFinite(value)) return { min: value };
  if (!isObject(value)) return undefined;
  const min = readNumber(value, 'min');
  if (min === undefined) return undefined;
  const max = readNumber(value, 'max');
  return max === undefined || max === min ? { min } : { min, max };
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const MEASURE_TYPES: MeasureType[] = ['reps', 'time', 'hold'];

// ---------------------------------------------------------------------------
// 名稱相似度（字元 Dice 係數）
// ---------------------------------------------------------------------------

function normalizeName(name: string): string {
  return name.replace(/[\s()（）·・\-_/]/g, '').toLowerCase();
}

function similarity(a: string, b: string): number {
  const left = new Set(normalizeName(a));
  const right = new Set(normalizeName(b));
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  left.forEach((ch) => {
    if (right.has(ch)) shared += 1;
  });
  return (2 * shared) / (left.size + right.size);
}

const SIMILARITY_THRESHOLD = 0.6;

// ---------------------------------------------------------------------------
// 主解析流程
// ---------------------------------------------------------------------------

export function parsePlanJson(text: string, context: ParseContext): ParseResult {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const exercises = new Map<string, ExerciseDraft>();

  const empty: ParseResult = {
    ok: false,
    errors,
    warnings,
    exercises: [],
    matches: [],
    restWeekdays: [],
  };

  let root: unknown;
  try {
    root = JSON.parse(stripCodeFence(text));
  } catch (e) {
    errors.push({ path: '(root)', message: `JSON 無法解析：${(e as Error).message}` });
    return empty;
  }

  if (!isObject(root)) {
    errors.push({ path: '(root)', message: 'JSON 最外層必須是物件 {}。' });
    return empty;
  }

  const name = readString(root, 'name');
  if (!name) errors.push({ path: 'name', message: '缺少課表名稱 name。' });

  const effectiveFrom = readString(root, 'effectiveFrom') ?? todayString();
  if (!DATE_PATTERN.test(effectiveFrom)) {
    errors.push({ path: 'effectiveFrom', message: '生效日格式須為 YYYY-MM-DD。' });
  }

  const rawGroups = Array.isArray(root.groups) ? root.groups : [];
  if (rawGroups.length === 0) {
    errors.push({ path: 'groups', message: '至少需要一個運動群組。' });
  }

  const groups: DraftGroup[] = [];
  rawGroups.forEach((rawGroup, groupIndex) => {
    const path = `groups[${groupIndex}]`;
    if (!isObject(rawGroup)) {
      errors.push({ path, message: '群組必須是物件。' });
      return;
    }

    const label = readString(rawGroup, 'label');
    if (!label) errors.push({ path: `${path}.label`, message: '缺少群組名稱 label。' });

    const weekdays = parseWeekdays(rawGroup.weekdays, path, errors);
    const requirement = parseRequirement(rawGroup, path, warnings, weekdays);
    const estimatedMinutes = readRange(rawGroup, 'estimatedMinutes');
    if (!estimatedMinutes) {
      errors.push({ path: `${path}.estimatedMinutes`, message: '缺少預計耗時 estimatedMinutes。' });
    }

    const stages = parseStages(rawGroup.stages, path, errors, warnings, exercises);
    if (stages.length === 0) {
      warnings.push({
        path: `${path}.stages`,
        message: `群組「${label ?? path}」沒有任何階段內容，將僅顯示描述。`,
      });
    }
    checkStageMinutes(stages, estimatedMinutes, label ?? path, path, warnings);

    groups.push({
      label: label ?? `群組 ${groupIndex + 1}`,
      weekdays,
      requirement,
      summary: readString(rawGroup, 'summary'),
      cautions: readStringArray(rawGroup, 'cautions'),
      estimatedMinutes: estimatedMinutes ?? { min: 0 },
      stages,
    });
  });

  checkWeekdayOverlap(groups, errors);
  const restWeekdays = findRestWeekdays(groups);
  if (restWeekdays.length > 0) {
    warnings.push({
      path: 'groups',
      message: `${restWeekdays.map((day) => WEEKDAY_LABELS[day]).join('、')} 未被任何群組涵蓋，將視為休息日。`,
    });
  }

  const rawFallbacks = Array.isArray(root.fallbackRoutines) ? root.fallbackRoutines : [];
  const fallbackRoutines: DraftFallback[] = [];
  rawFallbacks.forEach((rawFallback, index) => {
    const path = `fallbackRoutines[${index}]`;
    if (!isObject(rawFallback)) {
      errors.push({ path, message: '備用課表必須是物件。' });
      return;
    }
    const label = readString(rawFallback, 'label');
    if (!label) errors.push({ path: `${path}.label`, message: '缺少備用課表名稱 label。' });
    fallbackRoutines.push({
      label: label ?? `備用課表 ${index + 1}`,
      when: readString(rawFallback, 'when'),
      estimatedMinutes: readRange(rawFallback, 'estimatedMinutes') ?? { min: 0 },
      items: parseItems(rawFallback.items, path, errors, warnings, exercises),
    });
  });

  checkEffectiveFrom(effectiveFrom, context.existingPlans, warnings);

  const exerciseList = [...exercises.values()];
  checkExerciseDetails(exerciseList, warnings);
  const matches = matchExercises(exerciseList, context.existingExercises);

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    plan:
      errors.length === 0
        ? {
            name: name as string,
            description: readString(root, 'description'),
            effectiveFrom,
            groups,
            fallbackRoutines,
            medicalNotes: readStringArray(root, 'medicalNotes'),
            sourceText: text,
          }
        : undefined,
    exercises: exerciseList,
    matches,
    restWeekdays,
  };
}

/** 容忍 AI 回覆時包上 ```json 圍欄 */
function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith('```')) return trimmed;
  return trimmed
    .replace(/^```[a-zA-Z]*\s*/, '')
    .replace(/```$/, '')
    .trim();
}

function parseWeekdays(value: unknown, path: string, errors: Issue[]): IsoWeekday[] {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push({ path: `${path}.weekdays`, message: '缺少 weekdays，須為 1–7 的陣列。' });
    return [];
  }
  const result: IsoWeekday[] = [];
  value.forEach((item, index) => {
    if (typeof item !== 'number' || !Number.isInteger(item) || item < 1 || item > 7) {
      errors.push({
        path: `${path}.weekdays[${index}]`,
        message: `weekdays 只接受 1–7（1=週一、7=週日），收到 ${JSON.stringify(item)}。`,
      });
      return;
    }
    if (!result.includes(item as IsoWeekday)) result.push(item as IsoWeekday);
  });
  return result.sort((a, b) => a - b);
}

function parseRequirement(
  rawGroup: Raw,
  path: string,
  warnings: Issue[],
  weekdays: IsoWeekday[],
): GroupRequirement {
  const value = readString(rawGroup, 'requirement');
  const requirement: GroupRequirement = value === 'any-one' ? 'any-one' : 'all';
  if (value !== undefined && value !== 'all' && value !== 'any-one') {
    warnings.push({
      path: `${path}.requirement`,
      message: `requirement 只接受 "all" 或 "any-one"，收到「${value}」，已視為 "all"。`,
    });
  }
  if (requirement === 'any-one' && weekdays.length < 2) {
    warnings.push({
      path: `${path}.requirement`,
      message: '設為 any-one（擇一）但只涵蓋一天，設定沒有意義。',
    });
  }
  return requirement;
}

function parseStages(
  value: unknown,
  parentPath: string,
  errors: Issue[],
  warnings: Issue[],
  exercises: Map<string, ExerciseDraft>,
): DraftStage[] {
  if (!Array.isArray(value)) return [];
  const stages: DraftStage[] = [];
  value.forEach((rawStage, index) => {
    const path = `${parentPath}.stages[${index}]`;
    if (!isObject(rawStage)) {
      errors.push({ path, message: '階段必須是物件。' });
      return;
    }
    const stageName = readString(rawStage, 'name');
    if (!stageName) errors.push({ path: `${path}.name`, message: '缺少階段名稱 name。' });
    stages.push({
      order: index + 1,
      name: stageName ?? `第 ${index + 1} 階段`,
      estimatedMinutes: readRange(rawStage, 'estimatedMinutes'),
      rounds: readRange(rawStage, 'rounds'),
      restBetweenRoundsSeconds: readRange(rawStage, 'restBetweenRoundsSeconds'),
      note: readString(rawStage, 'note'),
      items: parseItems(rawStage.items, path, errors, warnings, exercises),
    });
  });
  return stages;
}

function parseItems(
  value: unknown,
  parentPath: string,
  errors: Issue[],
  warnings: Issue[],
  exercises: Map<string, ExerciseDraft>,
): DraftItem[] {
  if (!Array.isArray(value)) return [];
  const items: DraftItem[] = [];

  value.forEach((rawItem, index) => {
    const path = `${parentPath}.items[${index}]`;
    if (!isObject(rawItem)) {
      errors.push({ path, message: '動作必須是物件。' });
      return;
    }

    const exerciseName = readString(rawItem, 'name');
    if (!exerciseName) {
      errors.push({ path: `${path}.name`, message: '缺少動作名稱 name。' });
      return;
    }

    const rawMeasure = readString(rawItem, 'measureType');
    const measureType = MEASURE_TYPES.includes(rawMeasure as MeasureType)
      ? (rawMeasure as MeasureType)
      : 'reps';
    if (rawMeasure === undefined || !MEASURE_TYPES.includes(rawMeasure as MeasureType)) {
      warnings.push({
        path: `${path}.measureType`,
        message: `動作「${exerciseName}」的 measureType 未提供或不合法，已預設為 reps（次數型）。`,
      });
    }

    const specText = readString(rawItem, 'specText');
    if (!specText) {
      warnings.push({
        path: `${path}.specText`,
        message: `動作「${exerciseName}」缺少規格原文 specText。`,
      });
    }

    // 步驟屬於動作定義，同名動作只要有一處提供即可，
    // 因此缺漏與否統一在收集完成後檢查（見 checkExerciseDetails）
    const steps = readStringArray(rawItem, 'steps');

    collectExercise(exercises, {
      name: exerciseName,
      nameEn: readString(rawItem, 'nameEn'),
      targetMuscles: readStringArray(rawItem, 'targetMuscles'),
      equipment: readStringArray(rawItem, 'equipment'),
      steps,
      cautions: readStringArray(rawItem, 'cautions'),
      videoUrl: readString(rawItem, 'videoUrl'),
    });

    items.push({
      order: index + 1,
      exerciseName,
      measureType,
      sets: readNumber(rawItem, 'sets'),
      reps: readRange(rawItem, 'reps'),
      durationSeconds: readNumber(rawItem, 'durationSeconds'),
      holdSeconds: readNumber(rawItem, 'holdSeconds'),
      perSide: readBoolean(rawItem, 'perSide'),
      resistance: readString(rawItem, 'resistance'),
      weightKg: readNumber(rawItem, 'weightKg'),
      specText: specText ?? '',
      note: readString(rawItem, 'note'),
    });
  });

  return items;
}

/** 同一份匯入中的同名動作合併為一筆，缺漏欄位互相補齊 */
function collectExercise(exercises: Map<string, ExerciseDraft>, draft: ExerciseDraft): void {
  const found = exercises.get(draft.name);
  if (!found) {
    exercises.set(draft.name, draft);
    return;
  }
  exercises.set(draft.name, {
    name: found.name,
    nameEn: found.nameEn ?? draft.nameEn,
    targetMuscles: found.targetMuscles.length > 0 ? found.targetMuscles : draft.targetMuscles,
    equipment: found.equipment.length > 0 ? found.equipment : draft.equipment,
    steps: found.steps.length > 0 ? found.steps : draft.steps,
    cautions: found.cautions.length > 0 ? found.cautions : draft.cautions,
    videoUrl: found.videoUrl ?? draft.videoUrl,
  });
}

// ---------------------------------------------------------------------------
// 驗證規則
// ---------------------------------------------------------------------------

function checkWeekdayOverlap(groups: DraftGroup[], errors: Issue[]): void {
  for (let i = 0; i < groups.length; i += 1) {
    for (let j = i + 1; j < groups.length; j += 1) {
      const overlap = groups[i].weekdays.filter((day) => groups[j].weekdays.includes(day));
      if (overlap.length === 0) continue;
      errors.push({
        path: `groups[${i}] / groups[${j}]`,
        message: `「${groups[i].label}」與「${groups[j].label}」在 ${overlap
          .map((day) => WEEKDAY_LABELS[day])
          .join('、')} 重疊，同一天不能屬於兩個群組。`,
      });
    }
  }
}

function findRestWeekdays(groups: DraftGroup[]): IsoWeekday[] {
  const covered = new Set(groups.flatMap((group) => group.weekdays));
  return ALL_WEEKDAYS.filter((day) => !covered.has(day));
}

function checkStageMinutes(
  stages: DraftStage[],
  declared: NumRange | undefined,
  label: string,
  path: string,
  warnings: Issue[],
): void {
  if (!declared || stages.length === 0) return;
  const known = stages.filter((stage) => stage.estimatedMinutes);
  if (known.length === 0) return;

  const sumMin = known.reduce((sum, stage) => sum + (stage.estimatedMinutes?.min ?? 0), 0);
  const sumMax = known.reduce(
    (sum, stage) => sum + (stage.estimatedMinutes?.max ?? stage.estimatedMinutes?.min ?? 0),
    0,
  );
  const declaredMin = declared.min;
  const declaredMax = declared.max ?? declared.min;

  // 有交集就視為一致
  if (sumMin <= declaredMax && sumMax >= declaredMin) return;

  warnings.push({
    path: `${path}.estimatedMinutes`,
    message: `「${label}」各階段時間加總為 ${formatSum(sumMin, sumMax)} 分，與宣稱的 ${formatSum(
      declaredMin,
      declaredMax,
    )} 分不符，請確認原始課表。`,
  });
}

function formatSum(min: number, max: number): string {
  return min === max ? String(min) : `${min}–${max}`;
}

function checkEffectiveFrom(
  effectiveFrom: DateString,
  existingPlans: WorkoutPlan[],
  warnings: Issue[],
): void {
  const latest = existingPlans
    .map((plan) => plan.effectiveFrom)
    .sort((a, b) => b.localeCompare(a))[0];
  if (latest && effectiveFrom < latest) {
    warnings.push({
      path: 'effectiveFrom',
      message: `生效日 ${effectiveFrom} 早於現行課表的生效日 ${latest}，匯入後將只影響 ${effectiveFrom} 至 ${latest} 之間的日期。`,
    });
  }
}

/**
 * 動作定義的缺漏，以合併後的結果為準（同名動作只要有一處提供即可）。
 * 逐一列出會太吵，故彙整成單則警告。
 */
function checkExerciseDetails(drafts: ExerciseDraft[], warnings: Issue[]): void {
  const noSteps = drafts.filter((draft) => draft.steps.length === 0).map((draft) => draft.name);
  if (noSteps.length > 0) {
    warnings.push({
      path: '動作步驟',
      message: `${noSteps.join('、')} 缺少動作步驟 steps，課表詳情頁會空白。`,
    });
  }

  const noVideo = drafts.filter((draft) => !draft.videoUrl).map((draft) => draft.name);
  if (noVideo.length > 0) {
    warnings.push({
      path: '參考影片',
      message: `有 ${noVideo.length} 個動作未附參考影片，可於匯入後在動作詳情頁逐一補上。`,
    });
  }
}

/**
 * 比對動作名稱。
 * 完全相同 → 沿用既有動作；名稱相近 → 交由使用者確認是否合併。
 * 相近的對象同時檢查既有動作庫與「同一份匯入中較早出現的動作」，
 * 例如同一份課表裡的「胸部與手臂伸展」與「坐姿胸部伸展」。
 */
function matchExercises(drafts: ExerciseDraft[], existing: ExerciseDef[]): ExerciseMatch[] {
  return drafts.map((draft, index) => {
    const sameName = existing.find((item) => item.name === draft.name);
    if (sameName) return { name: draft.name, existingId: sameName.id };

    const candidates = [
      ...existing.map((item) => ({ name: item.name, source: 'library' as const })),
      // 只比對較早出現者，避免同一組相近名稱互相標記兩次
      ...drafts.slice(0, index).map((item) => ({ name: item.name, source: 'import' as const })),
    ];

    const similar = candidates
      .map((candidate) => ({ ...candidate, score: similarity(candidate.name, draft.name) }))
      .filter((candidate) => candidate.score >= SIMILARITY_THRESHOLD)
      .sort((a, b) => b.score - a.score)[0];

    return similar
      ? { name: draft.name, similarTo: similar.name, similarSource: similar.source }
      : { name: draft.name };
  });
}

// ---------------------------------------------------------------------------
// 提交：草稿 → 正式課表
// ---------------------------------------------------------------------------

/**
 * 將草稿寫入儲存層。
 *
 * @param aliases 使用者在預覽頁決定的動作合併對照，
 *                key 為匯入名稱、value 為要沿用的既有動作名稱。
 */
export async function commitDraftPlan(
  repository: WorkoutRepository,
  result: ParseResult,
  aliases: Record<string, string> = {},
): Promise<WorkoutPlan> {
  if (!result.plan) throw new Error('草稿尚未通過驗證，無法匯入。');
  const draft = result.plan;

  const idByName = new Map<string, string>();
  for (const exercise of result.exercises) {
    const canonical = aliases[exercise.name];
    if (canonical) {
      // 合併只解析 id，不覆寫既有定義 —— 被合併的那筆通常較不完整，
      // 覆寫會把正本的步驟、器材等內容洗掉
      const merged = idByName.get(canonical) ?? (await findExerciseIdByName(repository, canonical));
      if (merged) {
        idByName.set(exercise.name, merged);
        continue;
      }
    }
    const saved = await repository.upsertExercise(exercise);
    idByName.set(exercise.name, saved.id);
  }

  const resolveItem = (item: DraftItem): StageItem => {
    const exerciseId = idByName.get(item.exerciseName);
    if (!exerciseId) throw new Error(`找不到動作「${item.exerciseName}」的定義。`);
    return {
      id: newId(),
      order: item.order,
      exerciseId,
      measureType: item.measureType,
      sets: item.sets,
      reps: item.reps,
      durationSeconds: item.durationSeconds,
      holdSeconds: item.holdSeconds,
      perSide: item.perSide,
      resistance: item.resistance,
      weightKg: item.weightKg,
      specText: item.specText,
      note: item.note,
    };
  };

  const existingPlans = await repository.listPlans();
  const version =
    existingPlans
      .filter((plan) => plan.name === draft.name)
      .reduce((max, plan) => Math.max(max, plan.version), 0) + 1;

  const groups: PlanGroup[] = draft.groups.map((group) => ({
    id: newId(),
    label: group.label,
    weekdays: group.weekdays,
    requirement: group.requirement,
    summary: group.summary,
    cautions: group.cautions,
    estimatedMinutes: group.estimatedMinutes,
    stages: group.stages.map(
      (stage): Stage => ({
        id: newId(),
        order: stage.order,
        name: stage.name,
        estimatedMinutes: stage.estimatedMinutes,
        rounds: stage.rounds,
        restBetweenRoundsSeconds: stage.restBetweenRoundsSeconds,
        note: stage.note,
        items: stage.items.map(resolveItem),
      }),
    ),
  }));

  const fallbackRoutines: FallbackRoutine[] = draft.fallbackRoutines.map((fallback) => ({
    id: newId(),
    label: fallback.label,
    when: fallback.when,
    estimatedMinutes: fallback.estimatedMinutes,
    items: fallback.items.map(resolveItem),
  }));

  const plan: WorkoutPlan = {
    id: newId(),
    schemaVersion: WORKOUT_SCHEMA_VERSION,
    name: draft.name,
    description: draft.description,
    version,
    effectiveFrom: draft.effectiveFrom,
    groups,
    fallbackRoutines,
    medicalNotes: draft.medicalNotes,
    sourceText: draft.sourceText,
    locked: false,
    createdAt: new Date().toISOString(),
  };

  return repository.savePlan(plan);
}

async function findExerciseIdByName(
  repository: WorkoutRepository,
  name: string,
): Promise<string | undefined> {
  const all = await repository.listExercises();
  return all.find((exercise) => exercise.name === name)?.id;
}

/** 供匯入頁顯示群組標籤，例如「週一、三、五」 */
export function describeGroupDays(group: DraftGroup): string {
  const days = formatWeekdays(group.weekdays);
  return group.requirement === 'any-one' ? `${days}（擇一）` : days;
}
