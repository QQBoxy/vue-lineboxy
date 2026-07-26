<script setup lang="ts">
import { computed } from 'vue';
import { ALL_WEEKDAYS, WEEKDAY_LABELS, formatRange } from '@/services/workout/schedule';
import type { WeekGroup } from '@/services/workout/display';
import type { IsoWeekday } from '@/services/workout/types';

interface Props {
  groups: WeekGroup[];
  /** 是否可點選（課表檢視用；匯入預覽為唯讀） */
  selectable?: boolean;
  selectedKey?: string;
  /** 今天是星期幾，會加上標記 */
  todayWeekday?: IsoWeekday;
}

const props = withDefaults(defineProps<Props>(), {
  selectable: false,
  selectedKey: '',
  todayWeekday: undefined,
});

const emit = defineEmits<{ select: [key: string] }>();

interface DayCell {
  weekday: IsoWeekday;
  weekdayLabel: string;
  group: WeekGroup | null;
}

const cells = computed<DayCell[]>(() =>
  ALL_WEEKDAYS.map((weekday) => ({
    weekday,
    weekdayLabel: WEEKDAY_LABELS[weekday],
    group: props.groups.find((group) => group.weekdays.includes(weekday)) ?? null,
  })),
);

const handleSelect = (cell: DayCell) => {
  if (!props.selectable || !cell.group) return;
  emit('select', cell.group.key);
};
</script>

<template>
  <div class="week-overview">
    <div
      v-for="cell in cells"
      :key="cell.weekday"
      class="day-cell"
      :class="{
        'day-cell-rest': !cell.group,
        'day-cell-clickable': props.selectable && !!cell.group,
        'day-cell-selected': !!cell.group && cell.group.key === props.selectedKey,
        'day-cell-today': cell.weekday === props.todayWeekday,
      }"
      @click="handleSelect(cell)"
    >
      <span class="day-name">
        {{ cell.weekdayLabel }}
        <span v-if="cell.weekday === props.todayWeekday" class="today-tag">今天</span>
      </span>

      <template v-if="cell.group">
        <span class="group-label">{{ cell.group.label }}</span>
        <span class="group-minutes">{{ formatRange(cell.group.estimatedMinutes, '分') }}</span>
        <span v-if="cell.group.requirement === 'any-one'" class="pick-one-tag">擇一</span>
      </template>
      <template v-else>
        <span class="rest-label">休息</span>
      </template>
    </div>
  </div>
</template>

<style scoped>
.week-overview {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 0.5rem;
}

.day-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  padding: 0.6rem 0.35rem;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #f0fdfa;
  text-align: center;
  min-height: 104px;
}

.day-cell-rest {
  background: #f8fafc;
}

.day-cell-clickable {
  cursor: pointer;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}

.day-cell-clickable:hover {
  border-color: #0f766e;
  box-shadow: 0 6px 18px -14px rgba(15, 23, 42, 0.6);
}

.day-cell-selected {
  border-color: #0f766e;
  box-shadow: 0 0 0 2px rgba(15, 118, 110, 0.16);
}

.day-cell-today {
  border-color: #0f766e;
}

.day-name {
  font-size: 0.85rem;
  font-weight: 700;
  color: #334155;
}

.today-tag {
  display: inline-block;
  margin-left: 0.15rem;
  padding: 0 0.3rem;
  border-radius: 6px;
  background: #0f766e;
  color: #ffffff;
  font-size: 0.68rem;
  font-weight: 700;
}

.group-label {
  font-size: 0.82rem;
  font-weight: 700;
  color: #0f766e;
  line-height: 1.25;
}

.group-minutes {
  font-size: 0.78rem;
  color: #64748b;
  font-variant-numeric: tabular-nums;
}

.pick-one-tag {
  padding: 0.05rem 0.35rem;
  border-radius: 6px;
  background: #ccfbf1;
  color: #0f766e;
  font-size: 0.7rem;
  font-weight: 700;
}

.rest-label {
  font-size: 0.82rem;
  color: #94a3b8;
  font-weight: 600;
}

@media (max-width: 640px) {
  /* 手機改為七列，比橫向捲動好讀 */
  .week-overview {
    grid-template-columns: minmax(0, 1fr);
  }

  .day-cell {
    flex-direction: row;
    align-items: center;
    justify-content: flex-start;
    gap: 0.55rem;
    min-height: 48px;
    padding: 0.55rem 0.7rem;
    text-align: left;
  }

  .day-name {
    min-width: 4.4rem;
  }

  .group-minutes {
    margin-left: auto;
  }

  .pick-one-tag {
    margin-left: 0.2rem;
  }
}
</style>
