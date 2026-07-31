<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { usePersonStore } from '@/stores/person';
import ExerciseDetail from '@/components/workout/ExerciseDetail.vue';
import LogChecklist from '@/components/workout/LogChecklist.vue';
import { newId, workoutRepository } from '@/services/workout/localRepository';
import {
  buildFallbackChecklist,
  buildStageChecklist,
  clearAll,
  countDone,
  countRequired,
  deriveStatus,
  markAllDone,
  statesFromLog,
  statesToLogItems,
  type ItemState,
  type ItemStateMap,
} from '@/services/workout/checklist';
import type { DisplayItem } from '@/services/workout/display';
import {
  WEEKDAY_LABELS,
  formatRange,
  getGroupForDate,
  isoWeekdayOf,
  todayString,
} from '@/services/workout/schedule';
import type {
  ExerciseDef,
  LogSource,
  LogStatus,
  WorkoutLog,
  WorkoutPlan,
} from '@/services/workout/types';

const route = useRoute();
const router = useRouter();
const personStore = usePersonStore();

const today = todayString();

const date = ref(String(route.query.date ?? today));
const plan = ref<WorkoutPlan | null>(null);
const exercises = ref<ExerciseDef[]>([]);
const dayLogs = ref<WorkoutLog[]>([]);
/** null = 正在新增一筆 */
const activeLogId = ref<string | null>(null);
const isLoading = ref(true);
const isSaving = ref(false);
const message = ref('');
const errorMessage = ref('');

// 表單狀態
const source = ref<LogSource>('group');
const totalMinutes = ref<number | null>(null);
const rpe = ref<number | null>(null);
const note = ref('');
const freeformName = ref('');
/** 自由運動沒有 checklist 可推導，只有這個來源才手動選狀態 */
const freeformStatus = ref<LogStatus>('done');
const selectedFallbackId = ref('');
/** 空字串 = 尚未選擇。多 variant 時**不**預選第一個 */
const selectedVariantId = ref('');
const itemStates = ref<ItemStateMap>({});
const detailItem = ref<DisplayItem | null>(null);

const group = computed(() => getGroupForDate(plan.value, date.value));
const variants = computed(() => group.value?.variants ?? []);
const fallbacks = computed(() => plan.value?.fallbackRoutines ?? []);
const weekdayLabel = computed(() => WEEKDAY_LABELS[isoWeekdayOf(date.value)]);
const isFuture = computed(() => date.value > today);

const activeLog = computed(
  () => dayLogs.value.find((log) => log.id === activeLogId.value) ?? null,
);

/** 目前這筆是當日的第幾筆（1 起算）。新增中回傳 dayLogs.length + 1 */
const activeIndex = computed(() => {
  const found = dayLogs.value.findIndex((log) => log.id === activeLogId.value);
  return found === -1 ? dayLogs.value.length + 1 : found + 1;
});

/**
 * 預設開啟最近更新的那筆，而不是建立順序的第一筆。
 * 同一天存了兩筆時，剛存完的那筆才是使用者心裡「這天的紀錄」。
 */
const latestLog = (logs: WorkoutLog[]): WorkoutLog | null =>
  logs.reduce<WorkoutLog | null>(
    (best, log) => (!best || log.updatedAt > best.updatedAt ? log : best),
    null,
  );

const selectedFallback = computed(
  () => fallbacks.value.find((item) => item.id === selectedFallbackId.value) ?? null,
);

/**
 * 只有一種內容時自動取用；多 variant 未選時回傳 null。
 * variantId 是「當天實際做了哪一節課」的歷史事實，不能預設猜一個。
 */
const selectedVariant = computed(() => {
  if (variants.value.length === 1) return variants.value[0];
  return variants.value.find((variant) => variant.id === selectedVariantId.value) ?? null;
});

const needsVariantChoice = computed(
  () => source.value === 'group' && variants.value.length > 1 && !selectedVariant.value,
);

const checklistStages = computed(() => {
  if (source.value === 'group' && selectedVariant.value) {
    return buildStageChecklist(selectedVariant.value.stages, exercises.value);
  }
  if (source.value === 'fallback' && selectedFallback.value) {
    return buildFallbackChecklist(selectedFallback.value, exercises.value);
  }
  return [];
});

const requiredCount = computed(() => countRequired(checklistStages.value));
const doneCount = computed(() => countDone(checklistStages.value, itemStates.value));
const derivedStatus = computed(() => deriveStatus(checklistStages.value, itemStates.value));

const status = computed<LogStatus | null>(() =>
  source.value === 'freeform' ? freeformStatus.value : derivedStatus.value,
);

const statusLabel = computed(() => {
  if (status.value === 'done') return '已完成';
  if (status.value === 'partial') return '部分完成';
  return '尚未勾選任何項目';
});

/** 依來源決定耗時的預設值 */
const defaultMinutes = computed(() => {
  if (source.value === 'fallback') return selectedFallback.value?.estimatedMinutes.min ?? null;
  if (source.value === 'group') return selectedVariant.value?.estimatedMinutes.min ?? null;
  return null;
});

/** 換選項時重建勾選狀態：對得上的沿用既有紀錄，對不上的視為未勾 */
const refreshStates = () => {
  itemStates.value = statesFromLog(checklistStages.value, activeLog.value?.items ?? []);
};

const applyLog = (log: WorkoutLog | null) => {
  activeLogId.value = log?.id ?? null;
  if (!log) {
    source.value = group.value ? 'group' : 'freeform';
    selectedVariantId.value = '';
    selectedFallbackId.value = '';
    freeformName.value = '';
    freeformStatus.value = 'done';
    rpe.value = null;
    note.value = '';
  } else {
    source.value = log.source;
    selectedVariantId.value = log.variantId ?? '';
    selectedFallbackId.value = log.fallbackId ?? '';
    freeformName.value = log.source === 'freeform' ? (log.items[0]?.name ?? '') : '';
    freeformStatus.value = log.status === 'partial' ? 'partial' : 'done';
    rpe.value = log.rpe ?? null;
    note.value = log.note ?? '';
  }
  refreshStates();
  totalMinutes.value = log?.totalMinutes ?? defaultMinutes.value;
};

/** 換日期時整份重載：課表、動作庫、當日全部紀錄 */
const loadDate = async () => {
  isLoading.value = true;
  errorMessage.value = '';
  try {
    plan.value = await workoutRepository.getPlanForDate(date.value);
    exercises.value = await workoutRepository.listExercises();
    dayLogs.value = await workoutRepository.getLogsByDate(date.value);
    applyLog(latestLog(dayLogs.value));
  } catch (e) {
    console.error('載入打卡資料失敗：', e);
    errorMessage.value = '載入打卡資料失敗。';
  } finally {
    isLoading.value = false;
  }
};

onMounted(loadDate);

const handleDateChange = () => {
  if (!date.value) return;
  message.value = '';
  loadDate();
};

/** 切換當日紀錄是元件內狀態，不動路由 */
const handleSelectLog = (log: WorkoutLog) => {
  message.value = '';
  applyLog(log);
};

const handleNewLog = () => {
  message.value = '';
  applyLog(null);
};

const handleSelectVariant = (id: string) => {
  selectedVariantId.value = id;
  source.value = 'group';
  refreshStates();
  totalMinutes.value = defaultMinutes.value;
};

const handleSelectFallback = (id: string) => {
  selectedFallbackId.value = id;
  source.value = 'fallback';
  refreshStates();
  totalMinutes.value = defaultMinutes.value;
};

const handleSelectFreeform = () => {
  source.value = 'freeform';
  itemStates.value = {};
  totalMinutes.value = defaultMinutes.value;
};

const handleToggleItem = (stageItemId: string) => {
  const current = itemStates.value[stageItemId] ?? { done: false };
  itemStates.value = {
    ...itemStates.value,
    [stageItemId]: { ...current, done: !current.done },
  };
};

const handleUpdateItem = (stageItemId: string, patch: Partial<ItemState>) => {
  const current = itemStates.value[stageItemId] ?? { done: false };
  itemStates.value = { ...itemStates.value, [stageItemId]: { ...current, ...patch } };
};

const handleMarkAll = () => {
  itemStates.value = markAllDone(checklistStages.value, itemStates.value);
};

const handleClearAll = () => {
  itemStates.value = clearAll(checklistStages.value, itemStates.value);
};

const handleUpdateVideo = async (exerciseId: string, videoUrl: string) => {
  try {
    await workoutRepository.upsertExercise({
      id: exerciseId,
      name: detailItem.value?.name ?? '',
      videoUrl: videoUrl || undefined,
    });
    exercises.value = await workoutRepository.listExercises();
    detailItem.value = null;
    message.value = '影片連結已更新。';
  } catch (e) {
    errorMessage.value = `更新影片連結失敗：${(e as Error).message}`;
  }
};

const canSave = computed(() => {
  if (isFuture.value || isSaving.value) return false;
  if (source.value === 'freeform') return freeformName.value.trim() !== '';
  if (source.value === 'group' && !selectedVariant.value) return false;
  if (source.value === 'fallback' && !selectedFallback.value) return false;
  return derivedStatus.value !== null;
});

const handleSave = async () => {
  if (!canSave.value || !status.value) return;
  isSaving.value = true;
  errorMessage.value = '';
  message.value = '';
  try {
    const now = new Date().toISOString();
    const existing = activeLog.value;
    const log: WorkoutLog = {
      id: existing?.id ?? newId(),
      date: date.value,
      planId: plan.value?.id,
      planVersion: plan.value?.version,
      source: source.value,
      groupId: source.value === 'group' ? group.value?.id : undefined,
      variantId: source.value === 'group' ? selectedVariant.value?.id : undefined,
      fallbackId: source.value === 'fallback' ? selectedFallbackId.value : undefined,
      status: status.value,
      totalMinutes: totalMinutes.value ?? undefined,
      rpe: rpe.value ?? undefined,
      note: note.value.trim() || undefined,
      items:
        source.value === 'freeform'
          ? [{ id: newId(), name: freeformName.value.trim(), done: true }]
          : statesToLogItems(checklistStages.value, itemStates.value),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await workoutRepository.saveLog(log);
    router.push(`/workout?saved=${existing ? 'updated' : 'created'}`);
  } catch (e) {
    errorMessage.value = `儲存失敗：${(e as Error).message}`;
  } finally {
    isSaving.value = false;
  }
};

const handleDelete = async () => {
  const existing = activeLog.value;
  if (!existing) return;
  isSaving.value = true;
  errorMessage.value = '';
  try {
    await workoutRepository.deleteLog(existing.id);
    router.push('/workout?saved=deleted');
  } catch (e) {
    errorMessage.value = `刪除失敗：${(e as Error).message}`;
  } finally {
    isSaving.value = false;
  }
};

/** 當日紀錄清單的摘要文字 */
const logSummary = (log: WorkoutLog): string => {
  const kind =
    log.source === 'fallback' ? '備用課表' : log.source === 'freeform' ? '自由運動' : '當日課表';
  const state = log.status === 'partial' ? '部分完成' : '已完成';
  const minutes = log.totalMinutes ? ` · ${log.totalMinutes} 分` : '';
  return `${kind} · ${state}${minutes}`;
};
</script>

<template>
  <main class="log-page">
    <header class="page-header">
      <RouterLink class="back-link" to="/workout">‹ 返回</RouterLink>
      <h1>{{ activeLog ? '編輯打卡' : '打卡' }}</h1>
      <p>可補登過去的日期，紀錄會連結到該日期生效的課表</p>
    </header>

    <template v-if="personStore.person.isActive">
      <section class="card">
        <label class="field-label" for="log-date">日期</label>
        <input
          id="log-date"
          v-model="date"
          class="field-input"
          type="date"
          :max="today"
          @change="handleDateChange"
        />
        <p class="date-hint">
          {{ date }}（{{ weekdayLabel }}）
          <span v-if="date === today">· 今天</span>
        </p>

      </section>

      <!-- 一天可以有多筆（早上課表 + 晚上散步）。刻意做成明顯橫幅，
           否則使用者會在不知道已有紀錄的情況下又存一筆 -->
      <section v-if="dayLogs.length > 0" class="card multi-card">
        <p class="multi-banner">
          <span class="multi-icon">📌</span>
          <span v-if="activeLog">
            這天已經有 <strong>{{ dayLogs.length }}</strong> 筆紀錄，
            目前正在<strong>編輯第 {{ activeIndex }} 筆</strong>。
          </span>
          <span v-else>
            這天已經有 <strong>{{ dayLogs.length }}</strong> 筆紀錄，
            現在要新增的是<strong>第 {{ activeIndex }} 筆</strong>。
          </span>
        </p>

        <ul class="switch-list">
          <li v-for="(log, index) in dayLogs" :key="log.id">
            <button
              class="switch-btn"
              :class="{ 'switch-active': log.id === activeLogId }"
              type="button"
              @click="handleSelectLog(log)"
            >
              <span class="switch-index">{{ index + 1 }}</span>
              <span>{{ logSummary(log) }}</span>
            </button>
          </li>
        </ul>

        <button
          class="switch-btn switch-new"
          :class="{ 'switch-active': activeLogId === null }"
          type="button"
          @click="handleNewLog"
        >
          ＋ 再記一筆（早上／晚上分開記）
        </button>
      </section>

      <div v-if="isLoading" class="card state-card"><p>載入中…</p></div>

      <template v-else>
        <p v-if="message" class="flash flash-ok">{{ message }}</p>
        <p v-if="errorMessage" class="flash flash-error">{{ errorMessage }}</p>

        <!-- 沒有生效課表 -->
        <section v-if="!plan" class="card warn-card">
          <h2>這天沒有生效的課表</h2>
          <p>
            課表的生效日晚於這一天。若這份課表當時就已經在做，
            可以到課表頁把生效日往前調，補登的紀錄就會連結到它。
          </p>
          <p class="sub-hint">也可以直接記成「自由運動」，之後再調整。</p>
        </section>

        <!-- 做了什麼：兩個入口刻意分開，source 由入口決定 -->
        <section class="card">
          <h2>做了什麼</h2>

          <div class="option-list">
            <label
              v-for="variant in variants"
              :key="variant.id"
              class="option-row"
              :class="{
                'option-active': source === 'group' && selectedVariant?.id === variant.id,
              }"
            >
              <input
                type="radio"
                :checked="source === 'group' && selectedVariant?.id === variant.id"
                @change="handleSelectVariant(variant.id)"
              />
              <span class="option-main">
                <span class="option-title">
                  {{ variants.length > 1 ? variant.label : group?.label }}
                </span>
                <span class="option-sub">
                  當日課表<template v-if="variants.length > 1">
                    （{{ variants.length }} 選 1）</template
                  >
                  · 預計 {{ formatRange(variant.estimatedMinutes, '分') }}
                </span>
              </span>
            </label>

            <label
              v-for="fallback in fallbacks"
              :key="fallback.id"
              class="option-row"
              :class="{
                'option-active': source === 'fallback' && selectedFallbackId === fallback.id,
              }"
            >
              <input
                type="radio"
                :checked="source === 'fallback' && selectedFallbackId === fallback.id"
                @change="handleSelectFallback(fallback.id)"
              />
              <span class="option-main">
                <span class="option-title">{{ fallback.label }}</span>
                <span class="option-sub">
                  備用課表 · 預計 {{ formatRange(fallback.estimatedMinutes, '分') }}
                </span>
              </span>
            </label>

            <label class="option-row" :class="{ 'option-active': source === 'freeform' }">
              <input
                type="radio"
                :checked="source === 'freeform'"
                @change="handleSelectFreeform"
              />
              <span class="option-main">
                <span class="option-title">自由運動</span>
                <span class="option-sub">不在課表內的運動，例如散步、伸展</span>
              </span>
            </label>
          </div>

          <div v-if="source === 'freeform'" class="field-row">
            <label class="field-label" for="log-freeform">運動名稱</label>
            <input
              id="log-freeform"
              v-model="freeformName"
              class="field-input"
              type="text"
              placeholder="例如：散步 30 分鐘"
            />
          </div>

          <ul v-if="source === 'group' && group && group.cautions.length > 0" class="caution-list">
            <li v-for="(caution, index) in group.cautions" :key="index">⚠️ {{ caution }}</li>
          </ul>
        </section>

        <!-- checklist -->
        <section v-if="source !== 'freeform'" class="card">
          <div class="checklist-head">
            <h2>項目</h2>
            <span v-if="requiredCount > 0" class="progress-tag">
              {{ doneCount }} / {{ requiredCount }}
            </span>
          </div>

          <p v-if="needsVariantChoice" class="pick-hint">
            今天有兩節不同的課，請先在上方選一節，才能開始打勾。
          </p>

          <template v-else>
            <div v-if="requiredCount > 0" class="bulk-actions">
              <button class="action-btn" type="button" @click="handleMarkAll">
                ✓ 一鍵全部完成
              </button>
              <button class="action-btn action-btn-outline" type="button" @click="handleClearAll">
                清除
              </button>
            </div>

            <LogChecklist
              :stages="checklistStages"
              :states="itemStates"
              @toggle="handleToggleItem"
              @update="handleUpdateItem"
              @detail="detailItem = $event"
            />
          </template>
        </section>

        <!-- 完成狀況 -->
        <section class="card">
          <h2>完成狀況</h2>

          <template v-if="source === 'freeform'">
            <div class="status-row">
              <label class="status-btn" :class="{ 'status-active': freeformStatus === 'done' }">
                <input v-model="freeformStatus" type="radio" value="done" />
                <span>完成</span>
              </label>
              <label class="status-btn" :class="{ 'status-active': freeformStatus === 'partial' }">
                <input v-model="freeformStatus" type="radio" value="partial" />
                <span>部分完成</span>
              </label>
            </div>
          </template>

          <p v-else class="derived-status" :class="{ 'derived-pending': status === null }">
            狀態：{{ statusLabel }}
            <span class="derived-hint">（由勾選結果自動判定）</span>
          </p>

          <div class="field-row">
            <label class="field-label" for="log-minutes">實際耗時（分鐘）</label>
            <input
              id="log-minutes"
              v-model.number="totalMinutes"
              class="field-input"
              type="number"
              min="0"
              max="600"
              inputmode="numeric"
            />
          </div>

          <div class="field-row">
            <label class="field-label" for="log-rpe">自覺強度（1–10，選填）</label>
            <input
              id="log-rpe"
              v-model.number="rpe"
              class="field-input"
              type="number"
              min="1"
              max="10"
              inputmode="numeric"
            />
          </div>

          <div class="field-row">
            <label class="field-label" for="log-note">備註</label>
            <input
              id="log-note"
              v-model="note"
              class="field-input"
              type="text"
              placeholder="今天的身體狀況、調整了什麼…"
            />
          </div>

          <div class="card-actions">
            <button class="action-btn" type="button" :disabled="!canSave" @click="handleSave">
              {{ isSaving ? '儲存中…' : activeLog ? '更新這筆' : '儲存打卡' }}
            </button>
            <button
              v-if="activeLog"
              class="action-btn action-btn-danger"
              type="button"
              :disabled="isSaving"
              @click="handleDelete"
            >
              刪除這筆
            </button>
          </div>
        </section>
      </template>

      <!-- v-if 放在呼叫端：掛載 = 彈窗開著，元件內才能直接鎖解捲動 -->
      <ExerciseDetail
        v-if="detailItem"
        :item="detailItem"
        @close="detailItem = null"
        @update-video="handleUpdateVideo"
      />
    </template>

    <template v-else>
      <section class="card state-card"><p>Please Login.</p></section>
    </template>
  </main>
</template>

<style scoped>
.log-page {
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

.warn-card {
  background: #fffbeb;
  border-color: #fde68a;
  color: #78350f;
}

.warn-card h2 {
  color: #78350f;
}

.warn-card p {
  margin: 0 0 0.4rem;
  font-size: 0.9rem;
  line-height: 1.6;
}

.sub-hint {
  font-size: 0.86rem;
  opacity: 0.85;
}

.card h2 {
  margin: 0 0 0.75rem;
  font-size: 1.05rem;
  color: #0f172a;
}

.field-row {
  margin-top: 0.8rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.field-label {
  font-size: 0.9rem;
  font-weight: 700;
  color: #0f172a;
}

.field-input {
  width: 100%;
  box-sizing: border-box;
  min-height: 48px;
  border-radius: 10px;
  border: 1px solid #cbd5e1;
  padding: 0.55rem 0.7rem;
  color: #1f2937;
  font-size: 1rem;
  outline: none;
}

.field-input:focus {
  border-color: #0f766e;
  box-shadow: 0 0 0 3px rgba(15, 118, 110, 0.12);
}

.date-hint {
  margin: 0.5rem 0 0;
  font-size: 0.9rem;
  font-weight: 600;
  color: #0f766e;
}

.multi-card {
  background: #fffbeb;
  border-color: #fde68a;
}

.multi-banner {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  margin: 0;
  color: #78350f;
  font-size: 0.92rem;
  line-height: 1.55;
}

.multi-icon {
  flex-shrink: 0;
}

.switch-list {
  list-style: none;
  margin: 0.7rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.switch-btn {
  width: 100%;
  min-height: 46px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.6rem;
  border: 1px solid #fde68a;
  border-radius: 10px;
  background: #ffffff;
  color: #475569;
  font-size: 0.88rem;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  touch-action: manipulation;
}

.switch-btn:hover {
  border-color: #0f766e;
}

.switch-active {
  border-color: #0f766e;
  background: #f0fdfa;
  color: #115e59;
}

.switch-index {
  width: 1.35rem;
  height: 1.35rem;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #e2e8f0;
  color: #475569;
  font-size: 0.75rem;
}

.switch-new {
  margin-top: 0.5rem;
  min-height: 48px;
  border-style: dashed;
  border-color: #d97706;
  color: #92400e;
  font-weight: 700;
  justify-content: center;
}

.option-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.option-row {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.65rem 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
  cursor: pointer;
  transition: border-color 0.18s ease, background-color 0.18s ease;
}

.option-row:hover {
  border-color: #0f766e;
}

.option-active {
  border-color: #0f766e;
  background: #f0fdfa;
}

.option-row input {
  accent-color: #0f766e;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.option-main {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}

.option-title {
  font-weight: 700;
  font-size: 0.95rem;
}

.option-sub {
  font-size: 0.82rem;
  color: #64748b;
}

.caution-list {
  margin: 0.8rem 0 0;
  padding: 0.6rem 0.75rem;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 10px;
  color: #78350f;
  font-size: 0.87rem;
  line-height: 1.5;
}

.checklist-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.checklist-head h2 {
  margin: 0;
}

.progress-tag {
  padding: 0.2rem 0.55rem;
  border-radius: 8px;
  background: #ccfbf1;
  color: #115e59;
  font-size: 0.85rem;
  font-weight: 700;
}

.pick-hint {
  margin: 0;
  padding: 0.7rem 0.8rem;
  border: 1px dashed #fbbf24;
  border-radius: 10px;
  background: #fffbeb;
  color: #92400e;
  font-size: 0.9rem;
  line-height: 1.55;
}

.bulk-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.85rem;
}

.status-row {
  display: flex;
  gap: 0.6rem;
}

.status-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  background: #ffffff;
  font-weight: 700;
  font-size: 0.95rem;
  color: #475569;
  cursor: pointer;
}

.status-btn input {
  display: none;
}

.status-active {
  border-color: #0f766e;
  background: #0f766e;
  color: #ffffff;
}

.derived-status {
  margin: 0;
  padding: 0.6rem 0.75rem;
  border-radius: 10px;
  background: #f0fdfa;
  border: 1px solid #99f6e4;
  color: #115e59;
  font-size: 0.92rem;
  font-weight: 700;
}

.derived-pending {
  background: #f8fafc;
  border-color: #e2e8f0;
  color: #64748b;
}

.derived-hint {
  margin-left: 0.3rem;
  font-weight: 600;
  font-size: 0.8rem;
  opacity: 0.8;
}

.card-actions {
  margin-top: 1rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  padding: 0.55rem 1rem;
  border-radius: 12px;
  border: 1px solid #0f766e;
  background: #0f766e;
  color: #ffffff;
  font-size: 0.95rem;
  font-weight: 700;
  cursor: pointer;
  touch-action: manipulation;
  transition: background-color 0.18s ease;
}

.action-btn:hover:not(:disabled) {
  background: #115e59;
}

.action-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.action-btn-outline {
  background: #ffffff;
  color: #0f766e;
}

.action-btn-outline:hover:not(:disabled) {
  background: #ecfeff;
}

.action-btn-danger {
  background: #ffffff;
  border-color: #fecaca;
  color: #b91c1c;
}

.action-btn-danger:hover:not(:disabled) {
  background: #fef2f2;
}

.flash {
  margin: 0.85rem 0 0;
  padding: 0.65rem 0.8rem;
  border-radius: 10px;
  font-size: 0.9rem;
  font-weight: 600;
}

.flash-ok {
  background: #f0fdfa;
  border: 1px solid #99f6e4;
  color: #115e59;
}

.flash-error {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #7f1d1d;
}

@media (max-width: 640px) {
  .card-actions .action-btn,
  .bulk-actions .action-btn {
    flex: 1 1 100%;
  }
}
</style>
