<script setup lang="ts">
import { ref } from 'vue';
import type {
  ChecklistItem,
  ChecklistStage,
  ItemState,
  ItemStateMap,
} from '@/services/workout/checklist';
import { fromDurationInput, toDurationInput } from '@/services/workout/checklist';
import type { DisplayItem } from '@/services/workout/display';
import { formatRange } from '@/services/workout/schedule';

interface Props {
  stages: ChecklistStage[];
  states: ItemStateMap;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  toggle: [stageItemId: string];
  update: [stageItemId: string, patch: Partial<ItemState>];
  detail: [item: DisplayItem];
}>();

/** 使用者明確展開／收起過的項目。沒有鍵代表沿用預設 */
const expanded = ref<Record<string, boolean>>({});

/**
 * 時間型（time / hold）預設展開：只有一個數字要填，
 * 而且單位可能是分也可能是秒，收起來最容易填錯。
 * 次數型維持收起，照表操課的日子才不用展開任何一項。
 */
const isExpanded = (item: ChecklistItem) =>
  expanded.value[item.stageItemId] ?? item.measureType !== 'reps';

const toggleExpanded = (item: ChecklistItem) => {
  expanded.value = { ...expanded.value, [item.stageItemId]: !isExpanded(item) };
};

const stateOf = (stageItemId: string): ItemState => props.states[stageItemId] ?? { done: false };

/** 輸入框留空 = 照課表做，因此以課表規格當 placeholder，不預填成實際值 */
const setsPlaceholder = (item: ChecklistItem) => (item.sets ? `${item.sets}` : '組數');

const repsPlaceholder = (item: ChecklistItem) =>
  item.reps ? formatRange(item.reps, '').trim() : '次數';

const durationLabel = (item: ChecklistItem) => (item.measureType === 'hold' ? '停留' : '時間');

/**
 * 單位做成輸入框內的後綴，不能只放在小小的欄位標題上——
 * MV 舞蹈的欄位是「分鐘」，看漏了就會把 300 秒填成 300 分鐘。
 */
const durationUnitLabel = (item: ChecklistItem) =>
  item.measureType === 'hold' ? '秒' : item.durationUnit === 'minute' ? '分' : '秒';

const durationPlaceholder = (item: ChecklistItem) => {
  if (item.measureType === 'hold') return item.holdSeconds ? `${item.holdSeconds}` : '';
  if (!item.durationSeconds) return '';
  const min = toDurationInput(item.durationSeconds.min, item.durationUnit);
  const max = toDurationInput(item.durationSeconds.max, item.durationUnit);
  return max && max !== min ? `${min}–${max}` : `${min}`;
};

const durationInputValue = (item: ChecklistItem) =>
  toDurationInput(stateOf(item.stageItemId).actualDurationSeconds, item.durationUnit) ?? '';

const handleNumberInput = (
  stageItemId: string,
  key: 'actualSets' | 'actualReps' | 'actualWeightKg',
  event: Event,
) => {
  const raw = (event.target as HTMLInputElement).value;
  emit('update', stageItemId, { [key]: raw === '' ? undefined : Number(raw) });
};

const handleDurationInput = (item: ChecklistItem, event: Event) => {
  const raw = (event.target as HTMLInputElement).value;
  // hold 一律以秒輸入；time 依數量級可能是分鐘，一律換算回秒儲存
  const unit = item.measureType === 'hold' ? 'second' : item.durationUnit;
  emit('update', item.stageItemId, {
    actualDurationSeconds: raw === '' ? undefined : fromDurationInput(Number(raw), unit),
  });
};
</script>

<template>
  <div class="checklist">
    <section v-for="stage in props.stages" :key="stage.key" class="stage-block">
      <header class="stage-head">
        <h3>{{ stage.name }}</h3>
        <span v-if="stage.estimatedMinutes" class="stage-minutes">
          {{ formatRange(stage.estimatedMinutes, '分') }}
        </span>
      </header>

      <div v-if="stage.rounds || stage.selection === 'choose-one'" class="badge-row">
        <span v-if="stage.rounds" class="round-badge">
          循環 {{ formatRange(stage.rounds, '組') }}
        </span>
        <span v-if="stage.selection === 'choose-one'" class="choose-one-badge"> 擇一即可 </span>
      </div>

      <p v-if="stage.note" class="stage-note">{{ stage.note }}</p>

      <!-- 沒有可勾項目的階段（NEAT）：只顯示說明，不進完成判定 -->
      <p v-if="stage.descriptive" class="descriptive-hint">
        此階段沒有可勾選的項目，依上方說明進行即可，不影響完成判定。
      </p>

      <ul v-else class="item-list">
        <li
          v-for="item in stage.items"
          :key="item.stageItemId"
          class="item-row"
          :class="{ 'item-done': stateOf(item.stageItemId).done }"
        >
          <label class="item-check">
            <input
              type="checkbox"
              :checked="stateOf(item.stageItemId).done"
              @change="emit('toggle', item.stageItemId)"
            />
            <span class="item-main">
              <span class="item-name">{{ item.display.name }}</span>
              <span class="item-spec">
                {{ item.display.specText || '—' }}
                <span v-if="item.perSide" class="mini-tag">兩邊各做</span>
                <span v-if="item.display.resistance" class="mini-tag">
                  阻力 {{ item.display.resistance }}
                </span>
              </span>
            </span>
          </label>

          <!-- 防護重點只有在做的當下看到才有用，不能只藏在詳情頁 -->
          <ul v-if="item.display.cautions.length > 0" class="item-cautions">
            <li v-for="(caution, index) in item.display.cautions" :key="index">⚠️ {{ caution }}</li>
          </ul>

          <div class="item-tools">
            <button class="tool-btn" type="button" @click="toggleExpanded(item)">
              {{ isExpanded(item) ? '▴ 收起' : '▾ 調整實際數值' }}
            </button>
            <button class="tool-btn" type="button" @click="emit('detail', item.display)">
              動作詳情
            </button>
          </div>

          <div v-if="isExpanded(item)" class="actual-row">
            <label v-if="item.sets !== undefined" class="actual-field">
              <span>組數</span>
              <span class="input-wrap">
                <input
                  class="actual-input"
                  type="number"
                  min="0"
                  inputmode="numeric"
                  :placeholder="setsPlaceholder(item)"
                  :value="stateOf(item.stageItemId).actualSets ?? ''"
                  @input="handleNumberInput(item.stageItemId, 'actualSets', $event)"
                />
                <span class="input-unit">組</span>
              </span>
            </label>

            <label v-if="item.measureType === 'reps'" class="actual-field">
              <span>次數</span>
              <span class="input-wrap">
                <input
                  class="actual-input"
                  type="number"
                  min="0"
                  inputmode="numeric"
                  :placeholder="repsPlaceholder(item)"
                  :value="stateOf(item.stageItemId).actualReps ?? ''"
                  @input="handleNumberInput(item.stageItemId, 'actualReps', $event)"
                />
                <span class="input-unit">次</span>
              </span>
            </label>

            <label v-if="item.measureType !== 'reps'" class="actual-field">
              <span>{{ durationLabel(item) }}</span>
              <span class="input-wrap">
                <input
                  class="actual-input"
                  type="number"
                  min="0"
                  inputmode="decimal"
                  :placeholder="durationPlaceholder(item)"
                  :value="durationInputValue(item)"
                  @input="handleDurationInput(item, $event)"
                />
                <span class="input-unit input-unit-strong">{{ durationUnitLabel(item) }}</span>
              </span>
            </label>

            <label class="actual-field">
              <span>重量</span>
              <span class="input-wrap">
                <input
                  class="actual-input"
                  type="number"
                  min="0"
                  step="0.5"
                  inputmode="decimal"
                  :placeholder="item.weightKg ? `${item.weightKg}` : '選填'"
                  :value="stateOf(item.stageItemId).actualWeightKg ?? ''"
                  @input="handleNumberInput(item.stageItemId, 'actualWeightKg', $event)"
                />
                <span class="input-unit">kg</span>
              </span>
            </label>

            <p class="actual-hint">
              留空 = 照課表做<template v-if="item.display.specText">
                （課表：{{ item.display.specText }}）</template
              >
            </p>
          </div>
        </li>
      </ul>
    </section>

    <p v-if="props.stages.length === 0" class="empty-hint">此選項沒有可打卡的項目。</p>
  </div>
</template>

<style scoped>
.checklist {
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

.badge-row {
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

.stage-note {
  margin: 0.5rem 0 0;
  font-size: 0.86rem;
  color: #64748b;
  line-height: 1.5;
}

.descriptive-hint {
  margin: 0.55rem 0 0;
  padding: 0.55rem 0.7rem;
  border: 1px dashed #cbd5e1;
  border-radius: 10px;
  background: #f8fafc;
  color: #64748b;
  font-size: 0.86rem;
  line-height: 1.5;
}

.item-list {
  list-style: none;
  margin: 0.6rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.item-row {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
  padding: 0.5rem 0.65rem;
  transition:
    background-color 0.18s ease,
    border-color 0.18s ease;
}

.item-done {
  background: #f0fdfa;
  border-color: #99f6e4;
}

.item-check {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  min-height: 40px;
  cursor: pointer;
}

.item-check input {
  accent-color: #0f766e;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  margin-top: 0.15rem;
}

.item-main {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}

.item-name {
  font-weight: 700;
  font-size: 0.95rem;
  color: #1f2937;
}

.item-spec {
  font-size: 0.84rem;
  color: #0f766e;
  font-weight: 600;
}

.mini-tag {
  margin-left: 0.3rem;
  padding: 0.05rem 0.35rem;
  border-radius: 6px;
  background: #ecfeff;
  color: #0f766e;
  font-size: 0.72rem;
  font-weight: 700;
}

.item-cautions {
  margin: 0.45rem 0 0;
  padding: 0.45rem 0.6rem;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 8px;
  color: #78350f;
  font-size: 0.82rem;
  line-height: 1.5;
}

.item-tools {
  margin-top: 0.5rem;
  display: flex;
  gap: 0.5rem;
}

/* 有框而非純文字連結：夾在動作名與注意事項之間，
   純文字會整個融進背景，使用者找不到 */
.tool-btn {
  min-height: 36px;
  padding: 0.3rem 0.7rem;
  border: 1px solid #99f6e4;
  border-radius: 8px;
  background: #ffffff;
  color: #0f766e;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  touch-action: manipulation;
  transition:
    background-color 0.18s ease,
    border-color 0.18s ease;
}

.tool-btn:hover {
  background: #ecfeff;
  border-color: #0f766e;
}

.actual-row {
  margin-top: 0.5rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: flex-end;
}

.actual-field {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  font-size: 0.78rem;
  color: #64748b;
  font-weight: 600;
  flex: 1 1 5.5rem;
  min-width: 5.5rem;
}

.input-wrap {
  position: relative;
  display: block;
}

.actual-input {
  width: 100%;
  box-sizing: border-box;
  min-height: 44px;
  border-radius: 10px;
  border: 1px solid #cbd5e1;
  padding: 0.45rem 2.2rem 0.45rem 0.55rem;
  color: #1f2937;
  font-size: 0.95rem;
  outline: none;
}

.actual-input:focus {
  border-color: #0f766e;
  box-shadow: 0 0 0 3px rgba(15, 118, 110, 0.12);
}

.input-unit {
  position: absolute;
  right: 0.55rem;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  font-size: 0.82rem;
  font-weight: 700;
  color: #94a3b8;
}

/* 時間單位可能是分也可能是秒，看錯就差 60 倍，用主色讓它跳出來 */
.input-unit-strong {
  color: #0f766e;
}

.actual-hint {
  flex: 1 1 100%;
  margin: 0;
  color: #94a3b8;
  font-size: 0.78rem;
}

.empty-hint {
  margin: 0;
  color: #94a3b8;
  font-size: 0.88rem;
}
</style>
