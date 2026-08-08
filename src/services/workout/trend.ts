import type { Id, StageItem, WorkoutLog, WorkoutPlan } from './types';

export interface TrendPoint {
  date: string;
  weightKg?: number;
  reps?: number;
  durationSeconds?: number;
  isSpec: boolean;
}

export interface SpecRange {
  date: string;
  min: number;
  max?: number;
}

export interface TrendData {
  points: TrendPoint[];
  repsSpecs: SpecRange[];
  weightSpecs: SpecRange[];
  durationSpecs: SpecRange[];
}

export function extractTrendData(
  exerciseId: Id,
  logs: WorkoutLog[],
  plans: WorkoutPlan[],
): TrendData {
  const stageItemMap = new Map<Id, StageItem>();
  for (const p of plans) {
    for (const g of p.groups) {
      for (const v of g.variants) {
        for (const s of v.stages) {
          for (const i of s.items) {
            stageItemMap.set(i.id, i);
          }
        }
      }
    }
  }

  const repsSpecs: SpecRange[] = [];
  const weightSpecs: SpecRange[] = [];
  const durationSpecs: SpecRange[] = [];
  const pointsArray: TrendPoint[] = [];

  for (const log of logs) {
    if (log.status === 'rest') continue;

    const items = log.items.filter((i) => i.exerciseId === exerciseId && i.done);
    if (items.length === 0) continue;

    for (const item of items) {
      const stageItem = item.stageItemId ? stageItemMap.get(item.stageItemId) : undefined;

      const isSpec =
        item.actualReps === undefined &&
        item.actualWeightKg === undefined &&
        item.actualDurationSeconds === undefined;

      const point: TrendPoint = {
        date: log.date,
        isSpec,
      };

      if (item.actualWeightKg !== undefined) {
        point.weightKg = item.actualWeightKg;
      } else if (stageItem?.weightKg !== undefined) {
        point.weightKg = stageItem.weightKg;
      }

      if (item.actualReps !== undefined) {
        point.reps = item.actualReps;
      } else if (stageItem?.reps) {
        point.reps = stageItem.reps.min;
      }

      if (item.actualDurationSeconds !== undefined) {
        point.durationSeconds = item.actualDurationSeconds;
      } else if (stageItem?.durationSeconds) {
        point.durationSeconds = stageItem.durationSeconds.min;
      }

      pointsArray.push(point);

      if (stageItem) {
        if (stageItem.reps && !repsSpecs.find((s) => s.date === log.date)) {
          repsSpecs.push({ date: log.date, min: stageItem.reps.min, max: stageItem.reps.max });
        }
        if (stageItem.durationSeconds && !durationSpecs.find((s) => s.date === log.date)) {
          durationSpecs.push({
            date: log.date,
            min: stageItem.durationSeconds.min,
            max: stageItem.durationSeconds.max,
          });
        }
        if (stageItem.weightKg !== undefined && !weightSpecs.find((s) => s.date === log.date)) {
          weightSpecs.push({ date: log.date, min: stageItem.weightKg, max: stageItem.weightKg });
        }
      }
    }
  }

  repsSpecs.sort((a, b) => a.date.localeCompare(b.date));
  weightSpecs.sort((a, b) => a.date.localeCompare(b.date));
  durationSpecs.sort((a, b) => a.date.localeCompare(b.date));

  return { points: pointsArray, repsSpecs, weightSpecs, durationSpecs };
}
