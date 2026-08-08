import type { ExerciseDef, IsoWeekday, WorkoutPlan } from './types';
import type { DraftPlan } from './parsePlan';

export type DiffAction = 'added' | 'removed' | 'modified' | 'unchanged';

export interface ExerciseDiff {
  exerciseName: string;
  action: DiffAction;
  changes: string[];
}

export interface VariantDiff {
  weekdays: IsoWeekday[];
  variantLabel: string;
  exercises: ExerciseDiff[];
}

export interface PlanDiff {
  oldName: string;
  oldVersion: number;
  newName: string;
  newVersion: number;
  variants: VariantDiff[];
  avoidanceChanges: { action: 'added' | 'removed'; text: string }[];
  avoidanceWarnings: string[];
}

export function diffPlans(
  oldPlan: WorkoutPlan,
  newPlan: DraftPlan,
  exercises: ExerciseDef[],
): PlanDiff {
  const variants: VariantDiff[] = [];

  const oldVariantsMap = new Map<string, { groupIndex: number; variantIndex: number }>();

  oldPlan.groups.forEach((g, gIdx) => {
    const keyPrefix = g.weekdays.join(',');
    g.variants.forEach((v, vIdx) => {
      oldVariantsMap.set(`${keyPrefix}|${v.label}`, { groupIndex: gIdx, variantIndex: vIdx });
    });
  });

  const oldVisitedVariantKeys = new Set<string>();

  newPlan.groups.forEach((g) => {
    const keyPrefix = g.weekdays.join(',');
    g.variants.forEach((newVariant) => {
      const key = `${keyPrefix}|${newVariant.label}`;
      oldVisitedVariantKeys.add(key);
      const match = oldVariantsMap.get(key);
      const exercisesDiff: ExerciseDiff[] = [];

      const newItems = newVariant.stages.flatMap((s) => s.items);

      if (match) {
        const oldGroup = oldPlan.groups[match.groupIndex];
        const oldVariant = oldGroup.variants[match.variantIndex];

        const oldItems = oldVariant.stages.flatMap((s) => s.items);

        const visited = new Set<string>();

        newItems.forEach((newItem) => {
          const newItemName = newItem.exerciseName;

          // find the matching oldItem by name matching the existing exercise definitions
          const oldItem = oldItems.find((oi) => {
            const def = exercises.find((e) => e.id === oi.exerciseId);
            return def && def.name === newItemName;
          });

          if (!oldItem) {
            exercisesDiff.push({
              exerciseName: newItemName,
              action: 'added',
              changes: ['新增動作'],
            });
          } else {
            visited.add(oldItem.exerciseId);
            const changes: string[] = [];
            if (oldItem.specText !== newItem.specText) {
              changes.push(`規格：${oldItem.specText} → ${newItem.specText}`);
            }
            if (oldItem.sets !== newItem.sets) {
              changes.push(`組數：${oldItem.sets ?? '無'} → ${newItem.sets ?? '無'}`);
            }
            if (oldItem.weightKg !== newItem.weightKg) {
              changes.push(`重量：${oldItem.weightKg ?? '無'} → ${newItem.weightKg ?? '無'}`);
            }

            if (changes.length > 0) {
              exercisesDiff.push({ exerciseName: newItemName, action: 'modified', changes });
            } else {
              exercisesDiff.push({ exerciseName: newItemName, action: 'unchanged', changes: [] });
            }
          }
        });

        oldItems.forEach((oldItem) => {
          if (!visited.has(oldItem.exerciseId)) {
            const exerciseName =
              exercises.find((e) => e.id === oldItem.exerciseId)?.name ?? oldItem.exerciseId;
            exercisesDiff.push({ exerciseName, action: 'removed', changes: ['動作被移除'] });
          }
        });
      } else {
        newItems.forEach((newItem) => {
          exercisesDiff.push({
            exerciseName: newItem.exerciseName,
            action: 'added',
            changes: ['新增動作'],
          });
        });
      }

      variants.push({
        weekdays: g.weekdays,
        variantLabel: newVariant.label,
        exercises: exercisesDiff,
      });
    });
  });

  // Variants that were removed
  oldPlan.groups.forEach((g) => {
    const keyPrefix = g.weekdays.join(',');
    g.variants.forEach((v) => {
      const key = `${keyPrefix}|${v.label}`;
      if (!oldVisitedVariantKeys.has(key)) {
        const oldItems = v.stages.flatMap((s) => s.items);
        const exercisesDiff = oldItems.map((oldItem) => {
          const exerciseName =
            exercises.find((e) => e.id === oldItem.exerciseId)?.name ?? oldItem.exerciseId;
          return { exerciseName, action: 'removed' as DiffAction, changes: ['動作被移除'] };
        });
        variants.push({
          weekdays: g.weekdays,
          variantLabel: v.label,
          exercises: exercisesDiff,
        });
      }
    });
  });

  const avoidanceChanges: { action: 'added' | 'removed'; text: string }[] = [];
  const oldAv = new Set(oldPlan.avoidances);
  const newAv = new Set(newPlan.avoidances);

  newPlan.avoidances.forEach((a) => {
    if (!oldAv.has(a)) avoidanceChanges.push({ action: 'added', text: a });
  });
  oldPlan.avoidances.forEach((a) => {
    if (!newAv.has(a)) avoidanceChanges.push({ action: 'removed', text: a });
  });

  const avoidanceWarnings: string[] = [];
  if (newPlan.avoidances.length > 0) {
    const allNewItems = newPlan.groups.flatMap((g) =>
      g.variants.flatMap((v) => v.stages.flatMap((s) => s.items)),
    );
    const allNewExerciseNames = Array.from(new Set(allNewItems.map((i) => i.exerciseName)));
    const newExDefs = exercises.filter((e) => allNewExerciseNames.includes(e.name));

    newPlan.avoidances.forEach((word) => {
      const hits = newExDefs
        .filter((def) => def.name.includes(word) || def.steps.some((step) => step.includes(word)))
        .map((d) => d.name);
      if (hits.length > 0) {
        avoidanceWarnings.push(
          `課表宣告避開「${word}」，但 ${hits.join('、')} 的名稱或步驟提到了它。`,
        );
      }
    });
  }

  return {
    oldName: oldPlan.name,
    oldVersion: oldPlan.version,
    newName: newPlan.name,
    newVersion: newPlan.version,
    variants,
    avoidanceChanges,
    avoidanceWarnings,
  };
}
