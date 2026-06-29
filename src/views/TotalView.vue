<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import axios from 'axios';
import { usePersonStore } from '@/stores/person';

interface MonthTotal {
  month: number;
  total: number;
}

const personStore = usePersonStore();
const totals = ref<MonthTotal[]>([]);
const isLoading = ref(true);
const hasError = ref(false);
const chartReady = ref(false);

const fetchTotals = async () => {
  isLoading.value = true;
  hasError.value = false;
  chartReady.value = false;
  try {
    const res = await axios.get<MonthTotal[]>('/api/transaction/total');
    totals.value = res.data;
    // Trigger animation after DOM renders
    setTimeout(() => {
      chartReady.value = true;
    }, 150);
  } catch (e) {
    console.error('Failed to fetch transaction totals:', e);
    hasError.value = true;
  } finally {
    isLoading.value = false;
  }
};

const yearlySum = computed(() => {
  return totals.value.reduce((sum, item) => sum + item.total, 0);
});

const monthlyAverage = computed(() => {
  return totals.value.length ? yearlySum.value / totals.value.length : 0;
});

const maxMonthTotal = computed(() => {
  return Math.max(...totals.value.map((item) => item.total), 0);
});

const peakMonth = computed(() => {
  const maxVal = maxMonthTotal.value;
  if (maxVal === 0) return null;
  const found = totals.value.find((item) => item.total === maxVal);
  return found ? found.month : null;
});

const getMonthName = (monthNum: number) => {
  // Return month names or abbreviation, e.g. 1月, 2月...
  return `${monthNum}月`;
};

watch(
  () => personStore.person.isActive,
  (isActive) => {
    if (!isActive) {
      totals.value = [];
      isLoading.value = false;
      hasError.value = false;
      chartReady.value = false;
      return;
    }

    fetchTotals();
  },
  { immediate: true },
);
</script>

<template>
  <main class="total-page">
    <header class="page-header">
      <h1>Total</h1>
      <p>年度帳務統計與月度支出趨勢</p>
    </header>

    <template v-if="personStore.person.isActive">
      <!-- Loading State -->
      <div v-if="isLoading" class="state-card loading-state">
        <div class="spinner"></div>
        <p>載入帳務資料中...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="hasError" class="state-card error-state">
        <p class="error-text">無法取得帳務資料，請稍後再試。</p>
        <button class="action-btn" @click="fetchTotals">重新整理</button>
      </div>

      <!-- Main Dashboard Content -->
      <template v-else>
        <!-- Stat Cards Grid -->
        <section class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon-wrapper">💰</div>
            <div class="stat-content">
              <span class="stat-label">年度總支出</span>
              <span class="stat-value">$ {{ yearlySum.toLocaleString() }}</span>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon-wrapper">📅</div>
            <div class="stat-content">
              <span class="stat-label">月平均支出</span>
              <span class="stat-value">$ {{ Math.round(monthlyAverage).toLocaleString() }}</span>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon-wrapper">🔥</div>
            <div class="stat-content">
              <span class="stat-label">最高支出月份</span>
              <span class="stat-value">
                {{ peakMonth ? `${peakMonth}月 ($ ${maxMonthTotal.toLocaleString()})` : '無支出' }}
              </span>
            </div>
          </div>
        </section>

        <!-- Chart Visualization -->
        <section class="chart-card">
          <h2>月度支出趨勢圖</h2>
          <div class="chart-wrapper">
            <div class="chart-container">
              <div v-for="item in totals" :key="item.month" class="chart-column">
                <div class="tooltip">$ {{ item.total.toLocaleString() }}</div>
                <div class="bar-wrapper">
                  <div
                    class="chart-bar"
                    :class="{ 'has-value': item.total > 0 }"
                    :style="{
                      height:
                        chartReady && maxMonthTotal > 0
                          ? `${(item.total / maxMonthTotal) * 100}%`
                          : '0%',
                    }"
                  ></div>
                </div>
                <span class="month-label">{{ getMonthName(item.month) }}</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Detailed List Table -->
        <section class="list-card">
          <h2>年度收支明細</h2>
          <div class="table-container">
            <div class="table-header">
              <span class="col-month">月份</span>
              <span class="col-total">支出金額</span>
            </div>
            <div class="table-body">
              <div
                v-for="item in totals"
                :key="item.month"
                class="table-row"
                :class="{ 'row-active': item.total > 0 }"
              >
                <span class="row-month">{{ getMonthName(item.month) }}</span>
                <span class="row-total" :class="{ 'has-value': item.total > 0 }">
                  $ {{ item.total.toLocaleString() }}
                </span>
              </div>
            </div>
          </div>
        </section>
      </template>
    </template>

    <template v-else>
      <section class="profile-card">
        <p class="profile-empty">Please Login.</p>
      </section>
    </template>
  </main>
</template>

<style scoped>
.total-page {
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

/* Profile Empty Card */
.profile-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 1.1rem 0.95rem;
  box-shadow: 0 6px 22px -16px rgba(15, 23, 42, 0.38);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.8rem;
  text-align: center;
}

.profile-empty {
  margin: 0;
  color: #64748b;
  font-size: 1rem;
  font-weight: 500;
}

/* State Cards */
.state-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 3rem 1.5rem;
  text-align: center;
  box-shadow: 0 6px 22px -16px rgba(15, 23, 42, 0.38);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.loading-state p {
  color: #64748b;
  font-weight: 500;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #0f766e;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.error-text {
  color: #ef4444;
  font-weight: 600;
}

.action-btn {
  padding: 0.5rem 1.5rem;
  border-radius: 10px;
  border: 1px solid #0f766e;
  background: #0f766e;
  color: #ffffff;
  font-weight: 700;
  cursor: pointer;
  transition: background-color 0.18s ease;
}

.action-btn:hover {
  background: #115e59;
}

/* Stats Cards */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.stat-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 1.25rem;
  box-shadow: 0 6px 22px -16px rgba(15, 23, 42, 0.38);
  display: flex;
  align-items: center;
  gap: 1rem;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 25px -12px rgba(15, 23, 42, 0.5);
}

.stat-icon-wrapper {
  font-size: 2rem;
  background: #ecfeff;
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
}

.stat-content {
  display: flex;
  flex-direction: column;
}

.stat-label {
  font-size: 0.85rem;
  color: #64748b;
  font-weight: 600;
}

.stat-value {
  font-size: 1.45rem;
  font-weight: 800;
  color: #0f766e;
  margin-top: 0.15rem;
}

/* Chart Styles */
.chart-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 1.25rem;
  margin-top: 1rem;
  box-shadow: 0 6px 22px -16px rgba(15, 23, 42, 0.38);
}

.chart-card h2 {
  margin: 0 0 1rem;
  font-size: 1.05rem;
  color: #0f172a;
}

.chart-wrapper {
  overflow-x: auto;
  padding-bottom: 0.5rem;
}

.chart-container {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  height: 200px;
  min-width: 500px;
  padding: 2rem 0.5rem 0.5rem;
  border-bottom: 2px solid #e2e8f0;
  gap: 0.5rem;
}

.chart-column {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
  justify-content: flex-end;
  position: relative;
}

.bar-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  position: relative;
}

.chart-bar {
  width: 60%;
  max-width: 28px;
  background: #cbd5e1; /* Gray for zero values */
  height: 0;
  border-radius: 6px 6px 0 0;
  position: relative;
  cursor: pointer;
  transition:
    height 0.8s cubic-bezier(0.16, 1, 0.3, 1),
    background-color 0.2s ease,
    transform 0.2s ease;
}

.chart-bar.has-value {
  background: linear-gradient(180deg, #0d9488 0%, #14b8a6 100%);
}

.chart-bar.has-value:hover {
  background: linear-gradient(180deg, #0f766e 0%, #0d9488 100%);
  transform: scaleX(1.05);
}

.tooltip {
  position: absolute;
  bottom: calc(100% + 8px);
  background: #0f172a;
  color: #ffffff;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 4px 8px;
  border-radius: 6px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transform: translateY(4px) translateX(-50%);
  left: 50%;
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
  z-index: 10;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border-width: 4px;
  border-style: solid;
  border-color: #0f172a transparent transparent transparent;
}

.chart-column:hover .tooltip {
  opacity: 1;
  transform: translateY(0) translateX(-50%);
}

.month-label {
  margin-top: 0.5rem;
  font-size: 0.85rem;
  color: #64748b;
  font-weight: 600;
}

/* List Table Styles */
.list-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 1.25rem;
  margin-top: 1rem;
  box-shadow: 0 6px 22px -16px rgba(15, 23, 42, 0.38);
}

.list-card h2 {
  margin: 0 0 1rem;
  font-size: 1.05rem;
  color: #0f172a;
}

.table-container {
  width: 100%;
}

.table-header {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0.75rem;
  font-weight: 700;
  color: #64748b;
  font-size: 0.85rem;
  border-bottom: 2px solid #e2e8f0;
}

.table-body {
  display: flex;
  flex-direction: column;
}

.table-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 0.75rem;
  border-bottom: 1px solid #f1f5f9;
  transition: background-color 0.15s ease;
}

.table-row:last-child {
  border-bottom: none;
}

.table-row:hover {
  background-color: #f8fafc;
}

.row-active {
  background-color: #f0fdfa; /* Teal hue tint for non-zero months */
}

.row-active:hover {
  background-color: #ecfeff;
}

.row-month {
  font-weight: 700;
  color: #334155;
}

.row-total {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: #94a3b8;
}

.row-total.has-value {
  color: #0f766e;
}
</style>
