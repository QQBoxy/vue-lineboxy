<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { usePersonStore } from '@/stores/person';
import { workoutRepository } from '@/services/workout/localRepository';
import { daysSinceBackup, exportBackup, importBackup } from '@/services/workout/backup';
import {
  WEEKDAY_LABELS,
  formatRange,
  getGroupForDate,
  isoWeekdayOf,
  listRecentDates,
  todayString,
} from '@/services/workout/schedule';
import type { DateString, WorkoutLog, WorkoutMeta, WorkoutPlan } from '@/services/workout/types';

/** 首頁顯示的補登範圍，涵蓋完整的上一週 */
const RECENT_DAYS = 14;

const personStore = usePersonStore();

const plans = ref<WorkoutPlan[]>([]);
const todayPlan = ref<WorkoutPlan | null>(null);
const meta = ref<WorkoutMeta | null>(null);
const recentLogs = ref<WorkoutLog[]>([]);
const recentPlans = ref<Record<string, WorkoutPlan | null>>({});
const isLoading = ref(true);
const message = ref('');
const errorMessage = ref('');
const backupInput = ref<HTMLInputElement | null>(null);

const today = todayString();
const todayWeekday = isoWeekdayOf(today);
const recentDates = listRecentDates(RECENT_DAYS, today);

const loadAll = async () => {
  isLoading.value = true;
  try {
    plans.value = await workoutRepository.listPlans();
    todayPlan.value = await workoutRepository.getPlanForDate(today);
    meta.value = await workoutRepository.getMeta();

    recentLogs.value = await workoutRepository.listLogs(
      recentDates[recentDates.length - 1],
      today,
    );
    // 每天各自查生效課表，跨越生效日的日子才會對應到正確版本
    const pairs = await Promise.all(
      recentDates.map(
        async (date) => [date, await workoutRepository.getPlanForDate(date)] as const,
      ),
    );
    recentPlans.value = Object.fromEntries(pairs);
  } catch (e) {
    console.error('載入運動計畫失敗：', e);
    errorMessage.value = '載入運動計畫資料失敗。';
  } finally {
    isLoading.value = false;
  }
};

onMounted(loadAll);

const todayGroup = computed(() => getGroupForDate(todayPlan.value, today));

const todayFallbacks = computed(() => todayPlan.value?.fallbackRoutines ?? []);

interface RecentRow {
  date: DateString;
  weekdayLabel: string;
  planLabel: string;
  isRest: boolean;
  logged: boolean;
  logLabel: string;
}

const recentRows = computed<RecentRow[]>(() =>
  recentDates.map((date) => {
    const plan = recentPlans.value[date] ?? null;
    const group = getGroupForDate(plan, date);
    const log = recentLogs.value.find((entry) => entry.date === date);
    return {
      date,
      weekdayLabel: WEEKDAY_LABELS[isoWeekdayOf(date)],
      planLabel: group?.label ?? (plan ? '休息日' : '無課表'),
      isRest: !group,
      logged: !!log,
      logLabel: log
        ? `${log.source === 'fallback' ? '微型' : log.source === 'freeform' ? '自由' : ''}${
            log.status === 'partial' ? '部分完成' : '已完成'
          }${log.totalMinutes ? ` · ${log.totalMinutes} 分` : ''}`
        : '',
    };
  }),
);

const loggedCount = computed(() => recentRows.value.filter((row) => row.logged).length);

const backupHint = computed(() => {
  const days = daysSinceBackup(meta.value?.lastBackupAt);
  if (days === null) return { text: '尚未備份', warn: true };
  if (days === 0) return { text: '今天已備份', warn: false };
  return { text: `${days} 天前`, warn: days > 30 };
});

const handleExport = async () => {
  message.value = '';
  errorMessage.value = '';
  try {
    const fileName = await exportBackup(workoutRepository);
    meta.value = await workoutRepository.getMeta();
    message.value = `已匯出 ${fileName}`;
  } catch (e) {
    errorMessage.value = `匯出失敗：${(e as Error).message}`;
  }
};

const handleImportClick = () => {
  backupInput.value?.click();
};

const handleImportFile = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;

  message.value = '';
  errorMessage.value = '';
  try {
    await importBackup(workoutRepository, file);
    await loadAll();
    message.value = '備份已還原。';
  } catch (e) {
    errorMessage.value = `還原失敗：${(e as Error).message}`;
  }
};
</script>

<template>
  <main class="workout-page">
    <header class="page-header">
      <h1>Workout</h1>
      <p>運動課表、每日打卡與達成統計</p>
    </header>

    <template v-if="personStore.person.isActive">
      <div v-if="isLoading" class="state-card">
        <p>載入運動計畫中…</p>
      </div>

      <template v-else>
        <p v-if="message" class="flash flash-ok">{{ message }}</p>
        <p v-if="errorMessage" class="flash flash-error">{{ errorMessage }}</p>

        <!-- 今天 -->
        <section class="today-card">
          <span class="today-date">
            今天 · {{ today }}（{{ WEEKDAY_LABELS[todayWeekday] }}）
          </span>

          <template v-if="todayGroup">
            <h2>{{ todayGroup.label }}</h2>
            <p class="today-minutes">
              預計 {{ formatRange(todayGroup.estimatedMinutes, '分鐘') }}
              <span v-if="todayGroup.requirement === 'any-one'" class="pick-one-tag">本週擇一</span>
            </p>
            <p v-if="todayGroup.summary" class="today-summary">{{ todayGroup.summary }}</p>
            <p v-if="todayGroup.variants.length > 1" class="today-variants">
              二選一：{{ todayGroup.variants.map((variant) => variant.label).join(' 或 ') }}
            </p>
            <ul v-if="todayGroup.cautions.length > 0" class="caution-list">
              <li v-for="(caution, index) in todayGroup.cautions" :key="index">⚠️ {{ caution }}</li>
            </ul>

            <div class="today-actions">
              <RouterLink class="action-btn" :to="`/workout/log?date=${today}`">
                開始打卡
              </RouterLink>
              <RouterLink
                v-if="todayPlan"
                class="action-btn action-btn-outline"
                :to="`/workout/plan/${todayPlan.id}?group=${todayGroup.id}`"
              >
                查看今日課表
              </RouterLink>
            </div>

            <RouterLink
              v-for="fallback in todayFallbacks"
              :key="fallback.id"
              class="fallback-btn"
              :to="`/workout/log?date=${today}`"
            >
              今天很忙 → 改做 {{ fallback.label }}
            </RouterLink>
          </template>

          <template v-else-if="todayPlan">
            <h2>休息日</h2>
            <p class="today-summary">今天沒有排定課表，好好休息。</p>
            <div class="today-actions">
              <RouterLink class="action-btn action-btn-outline" :to="`/workout/log?date=${today}`">
                還是動了一下 → 打卡
              </RouterLink>
            </div>
          </template>

          <template v-else>
            <h2>尚未匯入課表</h2>
            <p class="today-summary">先匯入一份課表，就能看到每天該做什麼。</p>
            <RouterLink class="action-btn" to="/workout/import">匯入課表</RouterLink>
          </template>
        </section>

        <!-- 最近 14 天：補登入口 -->
        <section class="list-card">
          <h2>最近 {{ RECENT_DAYS }} 天 · 已記錄 {{ loggedCount }} 天</h2>
          <p class="empty-hint">點任一天可補登或修改紀錄。</p>
          <ul class="recent-list">
            <li v-for="row in recentRows" :key="row.date">
              <RouterLink
                class="recent-row"
                :class="{ 'recent-logged': row.logged }"
                :to="`/workout/log?date=${row.date}`"
              >
                <span class="recent-mark">{{ row.logged ? '✅' : row.isRest ? '·' : '○' }}</span>
                <span class="recent-main">
                  <span class="recent-date">
                    {{ row.date.slice(5) }}（{{ row.weekdayLabel.slice(1) }}）
                    <span v-if="row.date === today" class="today-tag">今天</span>
                  </span>
                  <span class="recent-plan" :class="{ 'recent-rest': row.isRest }">
                    {{ row.planLabel }}
                  </span>
                </span>
                <span class="recent-log">{{ row.logLabel }}</span>
                <span class="chevron">›</span>
              </RouterLink>
            </li>
          </ul>
        </section>

        <!-- 課表管理 -->
        <section class="list-card">
          <h2>課表</h2>

          <template v-if="plans.length > 0">
            <ul class="plan-list">
              <li v-for="plan in plans" :key="plan.id">
                <RouterLink class="plan-row" :to="`/workout/plan/${plan.id}`">
                  <span class="plan-main">
                    <span class="plan-name">{{ plan.name }}</span>
                    <span class="plan-meta">
                      v{{ plan.version }} · {{ plan.effectiveFrom }} 起
                      <span v-if="plan.id === todayPlan?.id" class="current-tag">現行</span>
                      <span v-if="plan.locked" class="locked-tag">已鎖定</span>
                    </span>
                  </span>
                  <span class="chevron">›</span>
                </RouterLink>
              </li>
            </ul>
          </template>
          <p v-else class="empty-hint">尚未匯入任何課表。</p>

          <div class="card-actions">
            <RouterLink class="action-btn" to="/workout/import">匯入新課表</RouterLink>
          </div>
        </section>

        <!-- 備份 -->
        <section class="list-card">
          <h2>備份</h2>
          <p class="backup-hint" :class="{ 'backup-warn': backupHint.warn }">
            上次備份：{{ backupHint.text }}
            <span v-if="backupHint.warn">⚠</span>
          </p>
          <p class="empty-hint">
            資料目前存在這台裝置的瀏覽器中，清除瀏覽資料或換機會遺失，請定期匯出。
          </p>
          <div class="card-actions">
            <button class="action-btn" type="button" @click="handleExport">匯出備份</button>
            <button class="action-btn action-btn-outline" type="button" @click="handleImportClick">
              還原備份
            </button>
            <input
              ref="backupInput"
              class="hidden-input"
              type="file"
              accept="application/json,.json"
              @change="handleImportFile"
            />
          </div>
        </section>
      </template>
    </template>

    <template v-else>
      <section class="state-card">
        <p>Please Login.</p>
      </section>
    </template>
  </main>
</template>

<style scoped>
.workout-page {
  max-width: 860px;
  margin: 0 auto;
  padding: 1rem 0.9rem 2rem;
  color: #1f2937;
}

.page-header {
  margin-bottom: 1rem;
}

.page-header h1 {
  margin: 0;
  font-size: clamp(1.55rem, 2.6vw, 2rem);
}

.page-header p {
  margin: 0.45rem 0 0;
  color: #64748b;
  font-size: 0.95rem;
}

.state-card,
.today-card,
.list-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 1rem;
  margin-top: 0.85rem;
  box-shadow: 0 6px 22px -16px rgba(15, 23, 42, 0.38);
}

.state-card {
  text-align: center;
  color: #64748b;
}

.state-card p {
  margin: 0;
}

.today-card {
  border-color: #99f6e4;
  background: linear-gradient(180deg, #f0fdfa 0%, #ffffff 60%);
}

.today-date {
  font-size: 0.85rem;
  font-weight: 700;
  color: #0f766e;
}

.today-card h2 {
  margin: 0.35rem 0 0;
  font-size: 1.25rem;
  color: #0f172a;
}

.today-minutes {
  margin: 0.3rem 0 0;
  font-size: 0.92rem;
  color: #475569;
  font-weight: 600;
}

.pick-one-tag {
  margin-left: 0.35rem;
  padding: 0.1rem 0.4rem;
  border-radius: 6px;
  background: #ccfbf1;
  color: #0f766e;
  font-size: 0.75rem;
  font-weight: 700;
}

.today-summary {
  margin: 0.45rem 0 0;
  font-size: 0.92rem;
  color: #475569;
  line-height: 1.55;
}

.today-variants {
  margin: 0.45rem 0 0;
  font-size: 0.9rem;
  font-weight: 600;
  color: #0f766e;
  line-height: 1.55;
}

.caution-list {
  margin: 0.55rem 0 0;
  padding-left: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.88rem;
  color: #78350f;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 10px;
  padding: 0.55rem 0.7rem;
  line-height: 1.5;
}

.today-actions,
.card-actions {
  margin-top: 0.85rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  padding: 0.55rem 1rem;
  border-radius: 12px;
  border: 1px solid #0f766e;
  background: #0f766e;
  color: #ffffff;
  font-size: 0.95rem;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
  touch-action: manipulation;
  transition: background-color 0.18s ease;
}

.action-btn:hover:not(:disabled) {
  background: #115e59;
}

.action-btn-outline {
  background: #ffffff;
  color: #0f766e;
}

.action-btn-outline:hover:not(:disabled) {
  background: #ecfeff;
}

.action-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.fallback-btn {
  margin-top: 0.6rem;
  width: 100%;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  border: 1px dashed #94a3b8;
  background: #f8fafc;
  color: #475569;
  font-size: 0.9rem;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  transition: background-color 0.18s ease, border-color 0.18s ease;
}

.fallback-btn:hover {
  background: #ecfeff;
  border-color: #0f766e;
  color: #0f766e;
}

.recent-list {
  list-style: none;
  margin: 0.6rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.recent-row {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  min-height: 46px;
  padding: 0.4rem 0.6rem;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
  color: #1f2937;
  text-decoration: none;
  transition: background-color 0.18s ease, border-color 0.18s ease;
}

.recent-row:hover {
  background: #ecfeff;
  border-color: #0f766e;
}

.recent-logged {
  background: #f0fdfa;
  border-color: #99f6e4;
}

.recent-mark {
  width: 1.3rem;
  text-align: center;
  color: #94a3b8;
  flex-shrink: 0;
}

.recent-main {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}

.recent-date {
  font-size: 0.86rem;
  font-weight: 700;
  color: #334155;
}

.recent-plan {
  font-size: 0.8rem;
  color: #0f766e;
}

.recent-rest {
  color: #94a3b8;
}

.recent-log {
  margin-left: auto;
  font-size: 0.78rem;
  color: #115e59;
  font-weight: 600;
  white-space: nowrap;
}

.today-tag {
  margin-left: 0.2rem;
  padding: 0 0.3rem;
  border-radius: 6px;
  background: #0f766e;
  color: #ffffff;
  font-size: 0.68rem;
  font-weight: 700;
}

.list-card h2 {
  margin: 0 0 0.75rem;
  font-size: 1.05rem;
  color: #0f172a;
}

.plan-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.plan-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  min-height: 52px;
  padding: 0.55rem 0.7rem;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
  color: #1f2937;
  text-decoration: none;
  transition: background-color 0.18s ease, border-color 0.18s ease;
}

.plan-row:hover {
  background: #ecfeff;
  border-color: #0f766e;
}

.plan-main {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
}

.plan-name {
  font-weight: 700;
  font-size: 0.95rem;
}

.plan-meta {
  font-size: 0.82rem;
  color: #64748b;
}

.current-tag,
.locked-tag {
  margin-left: 0.3rem;
  padding: 0.05rem 0.35rem;
  border-radius: 6px;
  font-size: 0.72rem;
  font-weight: 700;
}

.current-tag {
  background: #0f766e;
  color: #ffffff;
}

.locked-tag {
  background: #e2e8f0;
  color: #475569;
}

.chevron {
  color: #94a3b8;
  font-size: 1.2rem;
  line-height: 1;
}

.backup-hint {
  margin: 0 0 0.3rem;
  font-size: 0.92rem;
  font-weight: 600;
  color: #475569;
}

.backup-warn {
  color: #b45309;
}

.empty-hint {
  margin: 0;
  color: #94a3b8;
  font-size: 0.88rem;
  line-height: 1.55;
}

.flash {
  margin: 0.85rem 0 0;
  padding: 0.65rem 0.8rem;
  border-radius: 10px;
  font-size: 0.9rem;
  font-weight: 600;
}

.flash-ok {
  background: #f0fdfa;
  border: 1px solid #99f6e4;
  color: #115e59;
}

.flash-error {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #7f1d1d;
}

.hidden-input {
  display: none;
}

@media (max-width: 640px) {
  .today-actions .action-btn,
  .card-actions .action-btn {
    flex: 1 1 100%;
  }
}
</style>
