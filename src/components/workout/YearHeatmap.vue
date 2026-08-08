<script setup lang="ts">
import { computed } from 'vue';
import type { HeatmapGrid } from '@/services/workout/heatmap';

interface Props {
  grid: HeatmapGrid;
}

const props = defineProps<Props>();
const emit = defineEmits<{ 'day-click': [date: string] }>();

// Calculate width needed based on columns (each column is e.g. 12px wide + 2px gap)
const cellWidth = 12;
const gap = 3;
const totalWidth = computed(() => props.grid.columns.length * (cellWidth + gap));
</script>

<template>
  <div class="year-heatmap-container">
    <!-- Month labels row -->
    <div class="month-labels-row" :style="{ width: `${totalWidth}px` }">
      <div
        v-for="tick in props.grid.monthTicks"
        :key="tick.month"
        class="month-label"
        :style="{ left: `${tick.columnIndex * (cellWidth + gap)}px` }"
      >
        {{ tick.month }}月
      </div>
    </div>

    <!-- Grid body -->
    <div class="heatmap-body" :style="{ width: `${totalWidth}px` }">
      <div class="heatmap-columns">
        <div
          v-for="(column, colIndex) in props.grid.columns"
          :key="colIndex"
          class="heatmap-column"
        >
          <div
            v-for="day in column"
            :key="day.date"
            class="heatmap-cell"
            :class="[
              `status-${day.status}`,
              {
                'cell-outside': !day.inYear,
                'cell-today': day.isToday,
                'cell-future': day.isFuture,
              },
            ]"
            :title="`${day.date} ${day.logCount > 0 ? day.logCount + ' 筆紀錄' : ''}`"
            @click="!day.isFuture && emit('day-click', day.date)"
          ></div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.year-heatmap-container {
  overflow-x: auto;
  padding-bottom: 0.5rem;
  /* Hide scrollbar for cleaner look but keep it functional */
  scrollbar-width: thin;
  scrollbar-color: #cbd5e1 transparent;
}

.year-heatmap-container::-webkit-scrollbar {
  height: 6px;
}
.year-heatmap-container::-webkit-scrollbar-track {
  background: transparent;
}
.year-heatmap-container::-webkit-scrollbar-thumb {
  background-color: #cbd5e1;
  border-radius: 3px;
}

.month-labels-row {
  position: relative;
  height: 20px;
  margin-bottom: 4px;
}

.month-label {
  position: absolute;
  font-size: 0.75rem;
  color: #64748b;
  font-weight: 600;
  white-space: nowrap;
}

.heatmap-body {
  display: flex;
}

.heatmap-columns {
  display: flex;
  gap: 3px;
}

.heatmap-column {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.heatmap-cell {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  background-color: #f1f5f9; /* Default to empty/rest */
  border: 1px solid transparent;
  cursor: pointer;
  transition:
    transform 0.1s,
    border-color 0.1s;
}

.heatmap-cell:hover:not(.cell-future) {
  transform: scale(1.1);
  border-color: #94a3b8;
  z-index: 1;
}

/* Status colors (Aligned with MonthCalendar.vue) */
.status-none {
  background-color: #ffffff;
  border: 1px dashed #cbd5e1;
}

.status-rest {
  background-color: #f1f5f9;
}

.status-plan-done {
  background-color: #0f766e;
}

.status-partial {
  background-color: #5eead4;
}

.status-flex {
  background-color: #fcd34d;
}

.cell-outside {
  opacity: 0;
  pointer-events: none;
}

.cell-future {
  cursor: not-allowed;
  opacity: 0.5;
}

.cell-today {
  border: 2px solid #3b82f6; /* Emphasize today with blue border */
  box-sizing: border-box;
}
</style>
