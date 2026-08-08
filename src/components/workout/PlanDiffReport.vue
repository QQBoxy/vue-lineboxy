<script setup lang="ts">
import type { PlanDiff } from '@/services/workout/diff';
import { WEEKDAY_LABELS } from '@/services/workout/schedule';

interface Props {
  diff: PlanDiff;
}

const props = defineProps<Props>();

const formatWeekdays = (weekdays: number[]) => {
  return weekdays.map((d) => WEEKDAY_LABELS[d]).join('、');
};
</script>

<template>
  <div class="diff-report">
    <div class="diff-header">
      <h3>版本異動比對</h3>
      <p class="diff-version">{{ props.diff.oldVersion }} 版 ➔ {{ props.diff.newVersion }} 版</p>
    </div>

    <div
      v-if="props.diff.avoidanceChanges.length > 0 || props.diff.avoidanceWarnings.length > 0"
      class="diff-section"
    >
      <h4>⚠️ 禁忌動作與警告</h4>
      <ul class="avoidance-list">
        <li
          v-for="change in props.diff.avoidanceChanges"
          :key="change.text"
          :class="`change-${change.action}`"
        >
          <span class="icon">{{ change.action === 'added' ? '+' : '-' }}</span>
          {{ change.action === 'added' ? '新增禁忌：' : '移除禁忌：' }}{{ change.text }}
        </li>
        <li v-for="(warning, idx) in props.diff.avoidanceWarnings" :key="idx" class="warning-item">
          <span class="icon">⚠️</span>
          {{ warning }}
        </li>
      </ul>
    </div>

    <div class="diff-section">
      <h4>📅 課表內容異動</h4>
      <template v-if="props.diff.variants.length > 0">
        <div v-for="(variant, vIdx) in props.diff.variants" :key="vIdx" class="variant-card">
          <div class="variant-header">
            <strong>{{ formatWeekdays(variant.weekdays) }}</strong> - {{ variant.variantLabel }}
          </div>
          <ul class="exercise-list">
            <li v-for="(ex, eIdx) in variant.exercises" :key="eIdx" :class="`action-${ex.action}`">
              <div class="exercise-header">
                <span class="icon" v-if="ex.action === 'added'">+</span>
                <span class="icon" v-else-if="ex.action === 'removed'">-</span>
                <span class="icon" v-else-if="ex.action === 'modified'">~</span>
                <span class="icon" v-else>•</span>
                <span class="name">{{ ex.exerciseName }}</span>
              </div>
              <ul v-if="ex.changes.length > 0" class="change-details">
                <li v-for="(change, cIdx) in ex.changes" :key="cIdx">{{ change }}</li>
              </ul>
            </li>
          </ul>
        </div>
      </template>
      <p v-else class="no-changes">沒有發現任何差異。</p>
    </div>
  </div>
</template>

<style scoped>
.diff-report {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1rem;
  margin: 1rem 0;
}

.diff-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 0.75rem;
  margin-bottom: 1rem;
}

.diff-header h3 {
  margin: 0;
  font-size: 1.1rem;
  color: #0f172a;
}

.diff-version {
  margin: 0;
  font-size: 0.9rem;
  color: #64748b;
  font-weight: 600;
  background: #f1f5f9;
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
}

.diff-section {
  margin-bottom: 1.5rem;
}

.diff-section h4 {
  margin: 0 0 0.75rem 0;
  font-size: 0.95rem;
  color: #334155;
}

.avoidance-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.avoidance-list li {
  margin-bottom: 0.4rem;
  font-size: 0.9rem;
  display: flex;
  align-items: flex-start;
  gap: 0.4rem;
}

.change-added {
  color: #15803d;
}
.change-removed {
  color: #b91c1c;
  text-decoration: line-through;
}
.warning-item {
  color: #b45309;
}

.variant-card {
  border: 1px solid #f1f5f9;
  border-radius: 8px;
  padding: 0.75rem;
  margin-bottom: 0.75rem;
  background: #f8fafc;
}

.variant-header {
  font-size: 0.9rem;
  color: #0f172a;
  margin-bottom: 0.5rem;
}

.exercise-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.exercise-list > li {
  margin-bottom: 0.5rem;
  padding: 0.4rem;
  border-radius: 6px;
  background: #ffffff;
  border-left: 3px solid transparent;
}

.action-added {
  border-left-color: #22c55e !important;
  background: #f0fdf4 !important;
}
.action-removed {
  border-left-color: #ef4444 !important;
  background: #fef2f2 !important;
}
.action-modified {
  border-left-color: #eab308 !important;
  background: #fefce8 !important;
}
.action-unchanged {
  border-left-color: #cbd5e1 !important;
  opacity: 0.6;
}

.exercise-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: #334155;
}

.icon {
  font-family: monospace;
  font-weight: bold;
}

.action-added .icon {
  color: #16a34a;
}
.action-removed .icon {
  color: #dc2626;
}
.action-modified .icon {
  color: #ca8a04;
}
.action-unchanged .icon {
  color: #94a3b8;
}

.change-details {
  list-style: disc inside;
  margin: 0.25rem 0 0 1.25rem;
  padding: 0;
  font-size: 0.8rem;
  color: #64748b;
}

.no-changes {
  color: #94a3b8;
  font-size: 0.9rem;
  font-style: italic;
}
</style>
