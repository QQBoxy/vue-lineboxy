<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { workoutRepository } from '@/services/workout/localRepository';
import type { WorkoutPlan, WorkoutLog } from '@/services/workout/types';
import { todayString } from '@/services/workout/schedule';
import { buildYearHeatmap, computeYearStats } from '@/services/workout/heatmap';
import YearHeatmap from '@/components/workout/YearHeatmap.vue';
const router = useRouter();

const today = todayString();
const currentYear = Number(today.slice(0, 4));

const selectedYear = ref(currentYear);

const plans = ref<WorkoutPlan[]>([]);
const logs = ref<WorkoutLog[]>([]);

const loadData = async (year: number) => {
  plans.value = await workoutRepository.listPlans();
  logs.value = await workoutRepository.listLogs(`${year}-01-01`, `${year}-12-31`);
};

const goPrevYear = async () => {
  selectedYear.value -= 1;
  await loadData(selectedYear.value);
};

const goNextYear = async () => {
  selectedYear.value += 1;
  await loadData(selectedYear.value);
};

onMounted(async () => {
  await loadData(selectedYear.value);
});

const heatmapGrid = computed(() => {
  return buildYearHeatmap(plans.value, logs.value, selectedYear.value, today);
});

const yearStats = computed(() => {
  return computeYearStats(plans.value, logs.value, selectedYear.value, today);
});

const handleDayClick = (date: string) => {
  router.push(`/workout/log?date=${date}`);
};

const goBack = () => {
  router.back();
};
</script>

<template>
  <div class="workout-year-view">
    <header class="header">
      <button class="back-button" @click="goBack">‹ 返回</button>
      <h2>年度總覽</h2>
      <div style="width: 60px"></div>
      <!-- Spacer for flex alignment -->
    </header>

    <div class="year-selector">
      <button @click="goPrevYear" class="arrow-btn">‹</button>
      <span class="year-label">{{ selectedYear }}</span>
      <button @click="goNextYear" class="arrow-btn" :disabled="selectedYear >= currentYear">
        ›
      </button>
    </div>

    <div class="heatmap-section">
      <YearHeatmap :grid="heatmapGrid" @day-click="handleDayClick" />
      <div class="heatmap-legend">
        <span class="legend-title">圖例：</span>
        <div class="legend-item"><span class="swatch swatch-done"></span>照表完成</div>
        <div class="legend-item"><span class="swatch swatch-partial"></span>備用／部分完成</div>
        <div class="legend-item"><span class="swatch swatch-flex"></span>彈性日</div>
        <div class="legend-item"><span class="swatch swatch-rest"></span>休息日</div>
        <div class="legend-item"><span class="swatch swatch-none"></span>未打卡</div>
      </div>
    </div>

    <div class="stats-section">
      <div class="stat-card">
        <div class="stat-value">{{ yearStats.activeDays }} / {{ yearStats.countedDays }}</div>
        <div class="stat-label">活動天數</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ yearStats.planDoneDays }}</div>
        <div class="stat-label">照表完成</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ yearStats.currentStreak }}</div>
        <div class="stat-label">當前連續天數</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ yearStats.longestStreak }}</div>
        <div class="stat-label">最長連續天數</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.workout-year-view {
  padding: 1rem;
  max-width: 600px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.header h2 {
  margin: 0;
  font-size: 1.25rem;
  color: #0f172a;
}

.back-button {
  background: none;
  border: none;
  color: #0f766e;
  font-weight: 600;
  cursor: pointer;
  padding: 0.5rem;
}

.year-selector {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.year-label {
  font-size: 1.5rem;
  font-weight: 700;
  color: #334155;
}

.arrow-btn {
  background: #f1f5f9;
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  font-size: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #0f766e;
  cursor: pointer;
}

.arrow-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.heatmap-section {
  background: white;
  border-radius: 12px;
  padding: 1rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  margin-bottom: 1.5rem;
}

.stats-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.stat-card {
  background: white;
  border-radius: 12px;
  padding: 1.25rem;
  text-align: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.stat-value {
  font-size: 1.75rem;
  font-weight: 800;
  color: #0f766e;
  margin-bottom: 0.25rem;
}

.stat-label {
  font-size: 0.875rem;
  color: #64748b;
  font-weight: 500;
}

.heatmap-legend {
  margin-top: 1rem;
  padding-top: 0.75rem;
  border-top: 1px dashed #e2e8f0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.4rem 0.8rem;
  font-size: 0.75rem;
  color: #64748b;
}

.legend-title {
  font-weight: 700;
  color: #94a3b8;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.swatch {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  border: 1px solid transparent;
}

.swatch-done {
  background: #0f766e;
}

.swatch-partial {
  background: #5eead4;
}

.swatch-flex {
  background: #fcd34d;
}

.swatch-rest {
  background: #f1f5f9;
}

.swatch-none {
  background: #ffffff;
  border: 1px dashed #cbd5e1;
}
</style>
