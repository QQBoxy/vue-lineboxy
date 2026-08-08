<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { workoutRepository } from '@/services/workout/localRepository';
import { extractTrendData, type TrendData } from '@/services/workout/trend';
import TrendChart from '@/components/workout/TrendChart.vue';
import type { ExerciseDef, WorkoutLog, WorkoutPlan } from '@/services/workout/types';

const route = useRoute();
const router = useRouter();
const exerciseId = route.params.id as string;

const exercise = ref<ExerciseDef | null>(null);
const logs = ref<WorkoutLog[]>([]);
const plans = ref<WorkoutPlan[]>([]);
const trendData = ref<TrendData | null>(null);

onMounted(async () => {
  exercise.value = await workoutRepository.getExercise(exerciseId);
  if (!exercise.value) return;

  // Let's get logs for a long period to show the trend
  const today = new Date();
  const pastYear = new Date();
  pastYear.setFullYear(today.getFullYear() - 1);
  const fromDate = pastYear.toISOString().split('T')[0];
  const toDate = today.toISOString().split('T')[0];

  logs.value = await workoutRepository.listLogs(fromDate, toDate);
  plans.value = await workoutRepository.listPlans();

  trendData.value = extractTrendData(exerciseId, logs.value, plans.value);
});

const hasReps = computed(() => trendData.value?.points.some((p) => p.reps !== undefined));
const hasWeight = computed(() => trendData.value?.points.some((p) => p.weightKg !== undefined));
const hasDuration = computed(() =>
  trendData.value?.points.some((p) => p.durationSeconds !== undefined),
);

const goBack = () => {
  router.back();
};
</script>

<template>
  <div class="workout-trend-view">
    <header class="header">
      <button class="back-button" @click="goBack">‹ 返回</button>
      <h2>📈 {{ exercise?.name || '動作進步趨勢' }}</h2>
      <div style="width: 60px"></div>
      <!-- Spacer -->
    </header>

    <div v-if="!exercise" class="loading">載入中...</div>
    <div v-else-if="!trendData || trendData.points.length === 0" class="empty-state">
      沒有足夠的打卡紀錄來顯示趨勢。
    </div>
    <div v-else-if="!hasWeight && !hasReps && !hasDuration" class="empty-state">
      這個動作沒有重量、次數或時間等可量化的數值，因此無法產生趨勢圖。<br />
      若想追蹤進步，請在打卡時點選「▾ 調整實際數值」填寫。
    </div>
    <div v-else class="charts-container">
      <section class="global-legend">
        <h3 class="legend-title">圖示說明</h3>
        <div class="legend-items">
          <div class="legend-item">
            <span class="legend-icon icon-actual"></span>
            <div class="legend-text">
              <span class="legend-label">實際輸入數值</span>
              <span class="legend-desc">手動填寫的真實數字</span>
            </div>
          </div>
          <div class="legend-item">
            <span class="legend-icon icon-spec"></span>
            <div class="legend-text">
              <span class="legend-label">照表完成預設值</span>
              <span class="legend-desc">留空打勾，帶入最低要求</span>
            </div>
          </div>
          <div class="legend-item">
            <span class="legend-icon icon-band"></span>
            <div class="legend-text">
              <span class="legend-label">課表規定範圍</span>
              <span class="legend-desc">最高與最低要求區間</span>
            </div>
          </div>
        </div>
      </section>

      <div class="chart-card" v-if="hasWeight">
        <TrendChart :data="trendData" metric="weight" title="重量變化 (Kg)" />
      </div>
      <div class="chart-card" v-if="hasReps">
        <TrendChart :data="trendData" metric="reps" title="次數變化 (Reps)" />
      </div>
      <div class="chart-card" v-if="hasDuration">
        <TrendChart :data="trendData" metric="duration" title="時間變化 (秒)" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.workout-trend-view {
  padding: 1rem;
  max-width: 700px;
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

.loading,
.empty-state {
  text-align: center;
  padding: 3rem;
  color: #64748b;
  background: #f8fafc;
  border-radius: 12px;
}

.charts-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.chart-card {
  background: white;
  border-radius: 12px;
  padding: 1.25rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid #e2e8f0;
}

.global-legend {
  background: white;
  border-radius: 12px;
  padding: 1rem 1.25rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid #e2e8f0;
  margin-bottom: 0.2rem;
}

.legend-title {
  margin: 0 0 0.8rem;
  font-size: 0.95rem;
  color: #475569;
  font-weight: 700;
}

.legend-items {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.legend-item {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.legend-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  border-radius: 50%;
  margin-top: 0.15rem;
}

.icon-actual {
  background: #0f766e;
}

.icon-spec {
  background: transparent;
  border: 2px solid #0f766e;
  border-radius: 4px;
}

.icon-band {
  background: rgba(20, 184, 166, 0.15);
  border-radius: 4px;
}

.legend-text {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.legend-label {
  font-size: 0.9rem;
  font-weight: 700;
  color: #1f2937;
}

.legend-desc {
  font-size: 0.8rem;
  color: #64748b;
}

@media (min-width: 560px) {
  .legend-items {
    flex-direction: row;
    flex-wrap: wrap;
    gap: 1.5rem;
  }
}
</style>
