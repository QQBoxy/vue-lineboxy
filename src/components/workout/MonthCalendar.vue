<script setup lang="ts">
import type { CalendarDay } from '@/services/workout/calendar';
import { ALL_WEEKDAYS, WEEKDAY_LABELS } from '@/services/workout/schedule';

interface Props {
  weeks: CalendarDay[][];
}

const props = defineProps<Props>();
const emit = defineEmits<{ select: [date: string] }>();

/** 未來的日子不能打卡，點了只會讓人以為壞掉 */
const handleSelect = (day: CalendarDay) => {
  if (day.isFuture) return;
  emit('select', day.date);
};
</script>

<template>
  <div class="calendar">
    <div class="weekday-row">
      <span v-for="weekday in ALL_WEEKDAYS" :key="weekday" class="weekday-cell">
        {{ WEEKDAY_LABELS[weekday].slice(1) }}
      </span>
    </div>

    <div v-for="(week, index) in props.weeks" :key="index" class="week-row">
      <button
        v-for="day in week"
        :key="day.date"
        class="day-cell"
        :class="[
          `status-${day.status}`,
          {
            'day-outside': !day.inMonth,
            'day-today': day.isToday,
            'day-future': day.isFuture,
          },
        ]"
        type="button"
        :disabled="day.isFuture"
        :title="day.groupLabel"
        @click="handleSelect(day)"
      >
        <span class="day-number">{{ day.dayOfMonth }}</span>
        <span class="day-dot"></span>
        <span v-if="day.logCount > 1" class="day-count">{{ day.logCount }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.calendar {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.weekday-row,
.week-row {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.25rem;
}

.weekday-cell {
  text-align: center;
  font-size: 0.76rem;
  font-weight: 700;
  color: #94a3b8;
  padding-bottom: 0.15rem;
}

.day-cell {
  position: relative;
  aspect-ratio: 1;
  min-height: 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #ffffff;
  color: #334155;
  font-size: 0.85rem;
  cursor: pointer;
  touch-action: manipulation;
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease;
}

.day-cell:hover:not(:disabled) {
  border-color: #0f766e;
}

.day-number {
  font-weight: 700;
  line-height: 1;
}

.day-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: transparent;
}

.day-count {
  position: absolute;
  top: 2px;
  right: 4px;
  font-size: 0.62rem;
  font-weight: 700;
  color: #0f766e;
}

.day-outside {
  opacity: 0.38;
}

.day-future {
  cursor: not-allowed;
  color: #cbd5e1;
}

.day-today {
  outline: 2px solid #0f766e;
  outline-offset: -2px;
}

/* 應運動日尚未打卡：虛線框，刻意不配色，避免看起來像一種成績 */
.status-none {
  border-style: dashed;
  border-color: #cbd5e1;
}

.status-rest {
  background: #f1f5f9;
  color: #94a3b8;
}

.status-plan-done {
  background: #0f766e;
  border-color: #0f766e;
  color: #ffffff;
}

.status-plan-done .day-dot {
  background: #99f6e4;
}

.status-plan-done .day-count {
  color: #ccfbf1;
}

.status-partial {
  background: #ccfbf1;
  border-color: #5eead4;
  color: #115e59;
}

.status-partial .day-dot {
  background: #0f766e;
}

/* 彈性日（NEAT）：與課表達成刻意用不同色系，兩者意義不同 */
.status-flex {
  background: #fef3c7;
  border-color: #fcd34d;
  color: #92400e;
}

.status-flex .day-dot {
  background: #d97706;
}

.status-flex .day-count {
  color: #92400e;
}
</style>
