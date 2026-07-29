<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { usePersonStore } from '@/stores/person';
import { newId, workoutRepository } from '@/services/workout/localRepository';
import {
  WEEKDAY_LABELS,
  formatRange,
  getGroupForDate,
  isoWeekdayOf,
  todayString,
} from '@/services/workout/schedule';
import type { LogSource, LogStatus, WorkoutLog, WorkoutPlan } from '@/services/workout/types';

const route = useRoute();
const router = useRouter();
const personStore = usePersonStore();

const today = todayString();

const date = ref(String(route.query.date ?? today));
const plan = ref<WorkoutPlan | null>(null);
const existingLog = ref<WorkoutLog | null>(null);
const isLoading = ref(true);
const isSaving = ref(false);
const errorMessage = ref('');

// 表單狀態
const source = ref<LogSource>('group');
const status = ref<LogStatus>('done');
const totalMinutes = ref<number | null>(null);
const note = ref('');
const freeformName = ref('');
const selectedFallbackId = ref('');
/** 空字串 = 尚未選擇，視為第一個選項 */
const selectedVariantId = ref('');

const group = computed(() => getGroupForDate(plan.value, date.value));
const variants = computed(() => group.value?.variants ?? []);
const fallbacks = computed(() => plan.value?.fallbackRoutines ?? []);
const weekdayLabel = computed(() => WEEKDAY_LABELS[isoWeekdayOf(date.value)]);
const isFuture = computed(() => date.value > today);

const selectedFallback = computed(
  () => fallbacks.value.find((item) => item.id === selectedFallbackId.value) ?? null,
);

const selectedVariant = computed(
  () =>
    variants.value.find((variant) => variant.id === selectedVariantId.value) ??
    variants.value[0] ??
    null,
);

/** 依來源決定耗時的預設值 */
const defaultMinutes = computed(() => {
  if (source.value === 'fallback') return selectedFallback.value?.estimatedMinutes.min ?? null;
  if (source.value === 'group') return selectedVariant.value?.estimatedMinutes.min ?? null;
  return null;
});

const applyLogToForm = (log: WorkoutLog | null) => {
  if (!log) {
    source.value = group.value ? 'group' : 'freeform';
    status.value = 'done';
    selectedVariantId.value = '';
    totalMinutes.value = defaultMinutes.value;
    note.value = '';
    freeformName.value = '';
    selectedFallbackId.value = '';
    return;
  }
  source.value = log.source;
  status.value = log.status;
  totalMinutes.value = log.totalMinutes ?? null;
  note.value = log.note ?? '';
  freeformName.value = log.items[0]?.name ?? '';
  selectedFallbackId.value = log.fallbackId ?? '';
  selectedVariantId.value = log.variantId ?? '';
};

/** 換日期時整份重載：課表、既有紀錄、表單預設值 */
const loadDate = async () => {
  isLoading.value = true;
  errorMessage.value = '';
  try {
    plan.value = await workoutRepository.getPlanForDate(date.value);
    const logs = await workoutRepository.getLogsByDate(date.value);
    existingLog.value = logs[0] ?? null;
    applyLogToForm(existingLog.value);
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
  loadDate();
};

const handleSourceChange = () => {
  totalMinutes.value = defaultMinutes.value;
};

const handleSelectFallback = (id: string) => {
  selectedFallbackId.value = id;
  source.value = 'fallback';
  totalMinutes.value = defaultMinutes.value;
};

const handleSelectVariant = (id: string) => {
  selectedVariantId.value = id;
  source.value = 'group';
  totalMinutes.value = defaultMinutes.value;
};

const canSave = computed(() => {
  if (isFuture.value || isSaving.value) return false;
  if (source.value === 'group') return !!selectedVariant.value;
  if (source.value === 'fallback') return !!selectedFallback.value;
  return freeformName.value.trim() !== '';
});

const handleSave = async () => {
  if (!canSave.value) return;
  isSaving.value = true;
  errorMessage.value = '';
  try {
    const now = new Date().toISOString();
    const log: WorkoutLog = {
      id: existingLog.value?.id ?? newId(),
      date: date.value,
      planId: plan.value?.id,
      planVersion: plan.value?.version,
      source: source.value,
      groupId: source.value === 'group' ? group.value?.id : undefined,
      variantId: source.value === 'group' ? selectedVariant.value?.id : undefined,
      fallbackId: source.value === 'fallback' ? selectedFallbackId.value : undefined,
      status: status.value,
      totalMinutes: totalMinutes.value ?? undefined,
      note: note.value.trim() || undefined,
      items:
        source.value === 'freeform'
          ? [{ id: newId(), name: freeformName.value.trim(), done: true }]
          : [],
      createdAt: existingLog.value?.createdAt ?? now,
      updatedAt: now,
    };
    await workoutRepository.saveLog(log);
    router.push('/workout');
  } catch (e) {
    errorMessage.value = `儲存失敗：${(e as Error).message}`;
  } finally {
    isSaving.value = false;
  }
};

const handleDelete = async () => {
  if (!existingLog.value) return;
  isSaving.value = true;
  try {
    await workoutRepository.deleteLog(existingLog.value.id);
    router.push('/workout');
  } catch (e) {
    errorMessage.value = `刪除失敗：${(e as Error).message}`;
  } finally {
    isSaving.value = false;
  }
};
</script>

<template>
  <main class="log-page">
    <header class="page-header">
      <RouterLink class="back-link" to="/workout">‹ 返回</RouterLink>
      <h1>{{ existingLog ? '編輯打卡' : '打卡' }}</h1>
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

      <div v-if="isLoading" class="card state-card"><p>載入中…</p></div>

      <template v-else>
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

        <!-- 當日內容 -->
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
              :class="{ 'option-active': source === 'fallback' && selectedFallbackId === fallback.id }"
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
              <input v-model="source" type="radio" value="freeform" @change="handleSourceChange" />
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

        <!-- 完成度與耗時 -->
        <section class="card">
          <h2>完成狀況</h2>
          <div class="status-row">
            <label class="status-btn" :class="{ 'status-active': status === 'done' }">
              <input v-model="status" type="radio" value="done" />
              <span>完成</span>
            </label>
            <label class="status-btn" :class="{ 'status-active': status === 'partial' }">
              <input v-model="status" type="radio" value="partial" />
              <span>部分完成</span>
            </label>
          </div>

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
              {{ isSaving ? '儲存中…' : existingLog ? '更新打卡' : '儲存打卡' }}
            </button>
            <button
              v-if="existingLog"
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

.flash-error {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #7f1d1d;
}

@media (max-width: 640px) {
  .card-actions .action-btn {
    flex: 1 1 100%;
  }
}
</style>
