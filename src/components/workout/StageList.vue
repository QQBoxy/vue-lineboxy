<script setup lang="ts">
import type { DisplayStage } from '@/services/workout/display';
import { formatRange } from '@/services/workout/schedule';
import type { NumRange } from '@/services/workout/types';

interface Props {
  stages: DisplayStage[];
}

const props = defineProps<Props>();
const emit = defineEmits<{ select: [key: string] }>();

/** 秒數超過一分鐘時改以分鐘顯示，避免「休息 120 秒」這種不好讀的寫法 */
const formatRest = (range: NumRange | undefined): string => {
  if (!range) return '';
  if (range.min >= 60 && (range.max ?? range.min) % 60 === 0 && range.min % 60 === 0) {
    const minutes: NumRange = {
      min: range.min / 60,
      max: range.max === undefined ? undefined : range.max / 60,
    };
    return formatRange(minutes, '分');
  }
  return formatRange(range, '秒');
};

const findItem = (stageKey: string, itemKey: string) => {
  const stage = props.stages.find((entry) => entry.key === stageKey);
  return stage?.items.find((item) => item.key === itemKey);
};

const handleSelect = (stageKey: string, itemKey: string) => {
  if (!findItem(stageKey, itemKey)) return;
  emit('select', itemKey);
};
</script>

<template>
  <div class="stage-list">
    <section v-for="stage in props.stages" :key="stage.key" class="stage-block">
      <header class="stage-head">
        <h3>{{ stage.name }}</h3>
        <span v-if="stage.estimatedMinutes" class="stage-minutes">
          {{ formatRange(stage.estimatedMinutes, '分') }}
        </span>
      </header>

      <div
        v-if="stage.rounds || stage.restBetweenRoundsSeconds || stage.selection === 'choose-one'"
        class="round-row"
      >
        <span v-if="stage.rounds" class="round-badge">
          循環 {{ formatRange(stage.rounds, '組') }}
        </span>
        <span v-if="stage.selection === 'choose-one'" class="choose-one-badge"> 以下擇一即可 </span>
        <span v-if="stage.restBetweenRoundsSeconds" class="round-rest">
          組間休息 {{ formatRest(stage.restBetweenRoundsSeconds) }}
        </span>
      </div>

      <p v-if="stage.note" class="stage-note">{{ stage.note }}</p>

      <ul v-if="stage.items.length > 0" class="item-list">
        <li v-for="item in stage.items" :key="item.key">
          <button class="item-btn" type="button" @click="handleSelect(stage.key, item.key)">
            <span class="item-main">
              <span class="item-name">{{ item.name }}</span>
              <span v-if="item.cautions.length > 0" class="caution-dot" title="有注意事項">⚠️</span>
            </span>
            <span class="item-side">
              <span class="item-spec">{{ item.specText || '—' }}</span>
              <span class="chevron">›</span>
            </span>
          </button>
        </li>
      </ul>
      <p v-else class="empty-hint">此階段沒有列出動作。</p>
    </section>

    <p v-if="props.stages.length === 0" class="empty-hint">此群組沒有詳細課表內容。</p>
  </div>
</template>

<style scoped>
.stage-list {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.stage-block {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 0.8rem 0.85rem;
  background: #ffffff;
}

.stage-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
}

.stage-head h3 {
  margin: 0;
  font-size: 0.98rem;
  color: #0f172a;
}

.stage-minutes {
  font-size: 0.85rem;
  color: #64748b;
  font-weight: 600;
  white-space: nowrap;
}

.round-row {
  margin-top: 0.5rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  align-items: center;
}

.round-badge {
  padding: 0.2rem 0.5rem;
  border-radius: 8px;
  background: #ccfbf1;
  color: #115e59;
  font-size: 0.8rem;
  font-weight: 700;
}

/* 擇一階段用琥珀色與循環組數區隔，兩者意義相反、不該長得一樣 */
.choose-one-badge {
  padding: 0.2rem 0.5rem;
  border-radius: 8px;
  background: #fef3c7;
  color: #92400e;
  font-size: 0.8rem;
  font-weight: 700;
}

.round-rest {
  font-size: 0.82rem;
  color: #64748b;
}

.stage-note {
  margin: 0.5rem 0 0;
  font-size: 0.86rem;
  color: #64748b;
  line-height: 1.5;
}

.item-list {
  list-style: none;
  margin: 0.6rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.item-btn {
  width: 100%;
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  padding: 0.5rem 0.65rem;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
  color: #1f2937;
  font-size: 0.92rem;
  text-align: left;
  cursor: pointer;
  touch-action: manipulation;
  transition:
    background-color 0.18s ease,
    border-color 0.18s ease;
}

.item-btn:hover {
  background: #ecfeff;
  border-color: #0f766e;
}

.item-main {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
}

.item-name {
  font-weight: 700;
}

.caution-dot {
  font-size: 0.85rem;
}

.item-side {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-shrink: 0;
}

.item-spec {
  font-size: 0.84rem;
  color: #0f766e;
  font-weight: 600;
  white-space: nowrap;
}

.chevron {
  color: #94a3b8;
  font-size: 1.1rem;
  line-height: 1;
}

.empty-hint {
  margin: 0.5rem 0 0;
  color: #94a3b8;
  font-size: 0.88rem;
}
</style>
