/**
 * 備份匯出／匯入。
 * localStorage 會因清除瀏覽資料或換機而遺失，匯入課表是有成本的工，
 * 因此備份在批次 A 就做完。
 */
import type { WorkoutRepository } from './repository';
import { todayString } from './schedule';
import { WORKOUT_SCHEMA_VERSION, type BackupFile } from './types';

export async function exportBackup(repository: WorkoutRepository): Promise<string> {
  const backup = await repository.exportAll();
  const fileName = `lineboxy-workout-${todayString()}.json`;
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);

  await repository.markBackedUp(new Date().toISOString());
  return fileName;
}

export async function importBackup(repository: WorkoutRepository, file: File): Promise<void> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error(`備份檔無法解析：${(e as Error).message}`);
  }

  const backup = parsed as Partial<BackupFile>;
  if (
    typeof backup.schemaVersion !== 'number' ||
    !Array.isArray(backup.exercises) ||
    !Array.isArray(backup.plans) ||
    !Array.isArray(backup.logs)
  ) {
    throw new Error('備份檔缺少必要欄位，可能不是本功能匯出的檔案。');
  }

  await repository.importAll({
    schemaVersion: backup.schemaVersion,
    exportedAt: backup.exportedAt ?? '',
    exercises: backup.exercises,
    plans: backup.plans,
    logs: backup.logs,
  });
}

/** 距離上次備份的天數；從未備份回傳 null */
export function daysSinceBackup(lastBackupAt: string | undefined): number | null {
  if (!lastBackupAt) return null;
  const last = new Date(lastBackupAt).getTime();
  if (Number.isNaN(last)) return null;
  return Math.floor((Date.now() - last) / (24 * 60 * 60 * 1000));
}

export { WORKOUT_SCHEMA_VERSION };
