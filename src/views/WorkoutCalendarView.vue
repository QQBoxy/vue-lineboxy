<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { usePersonStore } from '@/stores/person';
import MonthCalendar from '@/components/workout/MonthCalendar.vue';
import { useRouter } from 'vue-router';
import { workoutRepository } from '@/services/workout/localRepository';
import { buildMonthCalendar, resolvePlanForDate, shiftMonth } from '@/services/workout/calendar';
import {
  addDays,
  computeMonthStats,
  listMonthDates,
  todayString,
} from '@/services/workout/schedule';
import type { WorkoutLog, WorkoutPlan } from '@/services/workout/types';

const personStore = usePersonStore();
const router = useRouter();

const today = todayString();
const todayYear = Number(today.slice(0, 4));
const todayMonth = Number(today.slice(5, 7));

const year = ref(todayYear);
const month = ref(todayMonth);
const plans = ref<WorkoutPlan[]>([]);
const logs = ref<WorkoutLog[]>([]);
const isLoading = ref(true);
const errorMessage = ref('');

const monthLabel = computed(() => `${year.value} 年 ${month.value} 月`);

/** 不讓使用者往未來翻太多，空月曆沒有意義 */
const canGoNext = computed(() => year.value * 12 + month.value < todayYear * 12 + todayMonth);

const loadMonth = async () => {
  isLoading.value = true;
  errorMessage.value = '';
  try {
    plans.value = await workoutRepository.listPlans();
    const dates = listMonthDates(year.value, month.value);
    // 月曆格線含前後補格，紀錄要多抓一週
    logs.value = await workoutRepository.listLogs(
      addDays(dates[0], -7),
      addDays(dates[dates.length - 1], 7),
    );
  } catch (e) {
    console.error('載入月曆失敗：', e);
    errorMessage.value = '載入月曆資料失敗。';
  } finally {
    isLoading.value = false;
  }
};

onMounted(loadMonth);

const handleShift = (amount: number) => {
  const next = shiftMonth(year.value, month.value, amount);
  year.value = next.year;
  month.value = next.month;
  loadMonth();
};

const weeks = computed(() =>
  buildMonthCalendar(plans.value, logs.value, year.value, month.value, today),
);

/**
 * 統計用的課表取「該月最後一天適用者」。
 * 月中換課表版本時以新版為準——舊版的配額本來就只剩幾天，
 * 用新版才反映當下實際要求。
 */
const monthPlan = computed(() => {
  const dates = listMonthDates(year.value, month.value);
  return resolvePlanForDate(plans.value, dates[dates.length - 1]);
});

const stats = computed(() =>
  computeMonthStats(monthPlan.value, logs.value, year.value, month.value, today),
);

const strictPercent = computed(() => Math.round(stats.value.strictAchievementRate * 100));
const activePercent = computed(() => Math.round(stats.value.achievementRate * 100));
const activeDayPercent = computed(() => Math.round(stats.value.activeDayRate * 100));

const handleSelectDate = (date: string) => {
  router.push(`/workout/log?date=${date}`);
};
</script>

<template>
  <main class="calendar-page">
    <header class="page-header">
      <RouterLink class="back-link" to="/workout">‹ 返回</RouterLink>
      <h1>月曆</h1>
      <p>點任一天可補登或修改紀錄</p>
    </header>

    <template v-if="personStore.person.isActive">
      <p v-if="errorMessage" class="flash flash-error">{{ errorMessage }}</p>

      <section class="card">
        <div class="month-nav">
          <button class="nav-btn" type="button" @click="handleShift(-1)">‹</button>
          <span class="month-label">{{ monthLabel }}</span>
          <button class="nav-btn" type="button" :disabled="!canGoNext" @click="handleShift(1)">
            ›
          </button>
        </div>

        <div v-if="isLoading" class="loading-hint">載入中…</div>
        <MonthCalendar v-else :weeks="weeks" @select="handleSelectDate" />

        <p class="legend-title">圖例</p>
        <ul class="legend">
          <li><span class="swatch swatch-done"></span>照表完成</li>
          <li><span class="swatch swatch-partial"></span>備用／部分完成</li>
          <li><span class="swatch swatch-flex"></span>彈性日（不計配額）</li>
          <li><span class="swatch swatch-rest"></span>休息日</li>
          <li><span class="swatch swatch-none"></span>應運動日未打卡</li>
        </ul>
      </section>

      <section class="card">
        <h2>{{ monthLabel }}統計</h2>

        <template v-if="stats.expectedTotal > 0">
          <div class="bar">
            <div class="bar-active" :style="{ width: `${activePercent}%` }"></div>
            <div class="bar-strict" :style="{ width: `${strictPercent}%` }"></div>
          </div>
          <p class="bar-caption">
            照表 {{ stats.strictAchievedTotal }}/{{ stats.expectedTotal }}
            <span class="dot-sep">・</span>
            有動 {{ stats.achievedTotal }}/{{ stats.expectedTotal }}
          </p>
          <p class="bar-note">
            深色是照表操課完成的配額，淺色是加上備用課表與部分完成後的結果。
            淺色段長代表你其實很努力，同時看得到離照表操課還有多遠。
          </p>
        </template>
        <p v-else class="empty-hint">這個月還沒有結算的應運動日配額。</p>

        <p class="stat-row">
          運動日佔比：{{ stats.activeDays }} / {{ stats.countedDays }} 天（{{ activeDayPercent }}%）
        </p>

        <RouterLink class="year-btn" to="/workout/year">📊 年度總覽</RouterLink>
      </section>
    </template>

    <template v-else>
      <section class="card state-card"><p>Please Login.</p></section>
    </template>
  </main>
</template>

<style scoped>
.calendar-page {
  max-width: 860px;
  margin: 0 auto;
  padding: 1rem 0.9rem 2rem;
  color: #1f2937;
}

.page-header {
  margin-bottom: 1rem;
}

.back-link {
  display: inline-block;
  margin-bottom: 0.4rem;
  color: #0f766e;
  font-weight: 700;
  font-size: 0.9rem;
  text-decoration: none;
}

.back-link:hover {
  text-decoration: underline;
}

.page-header h1 {
  margin: 0;
  font-size: clamp(1.4rem, 2.4vw, 1.85rem);
}

.page-header p {
  margin: 0.4rem 0 0;
  color: #64748b;
  font-size: 0.9rem;
}

.card {
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

.card h2 {
  margin: 0 0 0.75rem;
  font-size: 1.05rem;
  color: #0f172a;
}

.month-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-bottom: 0.85rem;
}

.nav-btn {
  width: 44px;
  height: 44px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #ffffff;
  color: #0f766e;
  font-size: 1.25rem;
  font-weight: 700;
  cursor: pointer;
  touch-action: manipulation;
}

.nav-btn:hover:not(:disabled) {
  background: #ecfeff;
  border-color: #0f766e;
}

.nav-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.month-label {
  font-size: 1.05rem;
  font-weight: 700;
  color: #0f172a;
  min-width: 8.5rem;
  text-align: center;
}

.loading-hint {
  text-align: center;
  color: #64748b;
  padding: 2rem 0;
}

.legend-title {
  margin: 0.9rem 0 0.35rem;
  padding-top: 0.7rem;
  border-top: 1px dashed #e2e8f0;
  font-size: 0.8rem;
  font-weight: 700;
  color: #94a3b8;
}

.legend {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem 0.9rem;
  font-size: 0.8rem;
  color: #64748b;
}

.legend li {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.swatch {
  width: 14px;
  height: 14px;
  border-radius: 4px;
  border: 1px solid #e2e8f0;
  flex-shrink: 0;
}

.swatch-done {
  background: #0f766e;
  border-color: #0f766e;
}

.swatch-partial {
  background: #ccfbf1;
  border-color: #5eead4;
}

.swatch-flex {
  background: #fef3c7;
  border-color: #fcd34d;
}

.swatch-rest {
  background: #f1f5f9;
}

.swatch-none {
  background: #ffffff;
  border-style: dashed;
  border-color: #cbd5e1;
}

/* 一條進度條的兩段，不並排兩個百分比——
   並排會讓人只挑好看的那個看，心理暗示反而變成自欺 */
.bar {
  position: relative;
  height: 14px;
  border-radius: 999px;
  background: #f1f5f9;
  overflow: hidden;
}

.bar-active,
.bar-strict {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: 999px;
}

.bar-active {
  background: #99f6e4;
}

.bar-strict {
  background: #0f766e;
}

.bar-caption {
  margin: 0.5rem 0 0;
  font-size: 0.92rem;
  font-weight: 700;
  color: #115e59;
}

.dot-sep {
  color: #94a3b8;
}

.bar-note {
  margin: 0.4rem 0 0;
  font-size: 0.83rem;
  color: #64748b;
  line-height: 1.55;
}

.stat-row {
  margin: 0.85rem 0 0;
  padding-top: 0.7rem;
  border-top: 1px dashed #e2e8f0;
  font-size: 0.92rem;
  font-weight: 600;
  color: #475569;
}

.empty-hint {
  margin: 0;
  color: #94a3b8;
  font-size: 0.88rem;
}

.year-btn {
  display: block;
  width: 100%;
  margin-top: 1rem;
  padding: 0.75rem;
  background: #f1f5f9;
  color: #0f766e;
  text-align: center;
  border-radius: 10px;
  text-decoration: none;
  font-weight: 700;
  font-size: 0.95rem;
  transition: background-color 0.2s;
}

.year-btn:hover {
  background: #e2e8f0;
}

.flash {
  margin: 0.85rem 0 0;
  padding: 0.65rem 0.8rem;
  border-radius: 10px;
  font-size: 0.9rem;
  font-weight: 600;
}

.flash-error {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #7f1d1d;
}
</style>
