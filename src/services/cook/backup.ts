/**
 * 備份匯出／匯入。
 * localStorage 會因清除瀏覽資料或換機而遺失，一道一道重打食譜是有成本的工，
 * 因此備份在批次 A 就做完。
 *
 * 與 Workout 維持兩包獨立（lineboxy-workout-*.json / lineboxy-cook-*.json），
 * 不合併成單一備份檔：兩個功能的 schema 版本各自演進，
 * 合併後任一方升版都要動到另一方的匯入邏輯。
 */
// 日期字串工具沿用 Workout 的實作，避免兩份「本地時區 YYYY-MM-DD」邏輯各自漂移。
// 依賴方向為 cook → workout，與 roadmap 第 13 節的約定一致。
import { todayString } from '@/services/workout/schedule';
import type { CookRepository } from './repository';
import { COOK_SCHEMA_VERSION, DEFAULT_COOK_SETTINGS, type CookBackupFile } from './types';

export async function exportCookBackup(repository: CookRepository): Promise<string> {
  const backup = await repository.exportAll();
  const fileName = `lineboxy-cook-${todayString()}.json`;
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

export async function importCookBackup(repository: CookRepository, file: File): Promise<void> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error(`備份檔無法解析：${(e as Error).message}`);
  }

  const backup = parsed as Partial<CookBackupFile>;
  if (
    typeof backup.schemaVersion !== 'number' ||
    !Array.isArray(backup.ingredients) ||
    !Array.isArray(backup.recipes) ||
    !Array.isArray(backup.logs)
  ) {
    throw new Error('備份檔缺少必要欄位，可能不是本功能匯出的檔案。');
  }

  await repository.importAll({
    schemaVersion: backup.schemaVersion,
    exportedAt: backup.exportedAt ?? '',
    ingredients: backup.ingredients,
    recipes: backup.recipes,
    logs: backup.logs,
    // 設定是後來才加的欄位，早期備份檔沒有也要能匯入
    settings: { ...DEFAULT_COOK_SETTINGS, ...(backup.settings ?? {}) },
  });
}

/** 距離上次備份的天數；從未備份回傳 null */
export function daysSinceCookBackup(lastBackupAt: string | undefined): number | null {
  if (!lastBackupAt) return null;
  const last = new Date(lastBackupAt).getTime();
  if (Number.isNaN(last)) return null;
  return Math.floor((Date.now() - last) / (24 * 60 * 60 * 1000));
}

export { COOK_SCHEMA_VERSION };
