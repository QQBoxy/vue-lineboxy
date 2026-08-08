<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { usePersonStore } from '@/stores/person';
import ExerciseDetail from '@/components/workout/ExerciseDetail.vue';
import StageList from '@/components/workout/StageList.vue';
import WeekOverview from '@/components/workout/WeekOverview.vue';
import { workoutRepository } from '@/services/workout/localRepository';
import {
  fallbackToDisplay,
  planToWeekGroups,
  variantsToDisplay,
  type DisplayStage,
  type DisplayVariant,
} from '@/services/workout/display';
import {
  formatRange,
  formatWeekdays,
  getGroupForDate,
  isoWeekdayOf,
  todayString,
} from '@/services/workout/schedule';
import type { ExerciseDef, WorkoutPlan } from '@/services/workout/types';

const route = useRoute();
const personStore = usePersonStore();

const plan = ref<WorkoutPlan | null>(null);
const exercises = ref<ExerciseDef[]>([]);
const selectedGroupId = ref('');
/** 空字串 = 尚未選擇，顯示第一個選項 */
const selectedVariantKey = ref('');
const selectedItemKey = ref('');
const isLoading = ref(true);
const errorMessage = ref('');

const today = todayString();
const todayWeekday = isoWeekdayOf(today);

const loadExercises = async () => {
  exercises.value = await workoutRepository.listExercises();
};

onMounted(async () => {
  try {
    const id = String(route.params.id);
    plan.value = await workoutRepository.getPlan(id);
    if (!plan.value) {
      errorMessage.value = '找不到這份課表。';
      return;
    }
    await loadExercises();

    const requested = String(route.query.group ?? '');
    const todayGroup = getGroupForDate(plan.value, today);
    selectedGroupId.value =
      plan.value.groups.find((group) => group.id === requested)?.id ??
      todayGroup?.id ??
      plan.value.groups[0]?.id ??
      '';
  } catch (e) {
    console.error('載入課表失敗：', e);
    errorMessage.value = '載入課表失敗。';
  } finally {
    isLoading.value = false;
  }
});

const weekGroups = computed(() => planToWeekGroups(plan.value));

const selectedGroup = computed(
  () => plan.value?.groups.find((group) => group.id === selectedGroupId.value) ?? null,
);

const displayVariants = computed<DisplayVariant[]>(() =>
  selectedGroup.value ? variantsToDisplay(selectedGroup.value.variants, exercises.value) : [],
);

const selectedVariant = computed<DisplayVariant | null>(
  () =>
    displayVariants.value.find((variant) => variant.key === selectedVariantKey.value) ??
    displayVariants.value[0] ??
    null,
);

const displayStages = computed<DisplayStage[]>(() => selectedVariant.value?.stages ?? []);

const fallbackStages = computed<DisplayStage[]>(() =>
  (plan.value?.fallbackRoutines ?? []).map((fallback) =>
    fallbackToDisplay(fallback, exercises.value),
  ),
);

const allDisplayItems = computed(() =>
  [...displayStages.value, ...fallbackStages.value].flatMap((stage) => stage.items),
);

const selectedItem = computed(
  () => allDisplayItems.value.find((item) => item.key === selectedItemKey.value) ?? null,
);

const handleSelectGroup = (key: string) => {
  selectedGroupId.value = key;
  // 換群組時選項也要歸零，否則會停在上一個群組的選項上
  selectedVariantKey.value = '';
  selectedItemKey.value = '';
};

const handleSelectVariant = (key: string) => {
  selectedVariantKey.value = key;
  selectedItemKey.value = '';
};

const handleSelectItem = (key: string) => {
  selectedItemKey.value = key;
};

const handleCloseDetail = () => {
  selectedItemKey.value = '';
};

const editingEffectiveFrom = ref(false);
const effectiveFromInput = ref('');
const effectiveFromMessage = ref('');

const startEditEffectiveFrom = () => {
  effectiveFromInput.value = plan.value?.effectiveFrom ?? today;
  effectiveFromMessage.value = '';
  editingEffectiveFrom.value = true;
};

const submitEffectiveFrom = async () => {
  if (!plan.value || !effectiveFromInput.value) return;
  try {
    plan.value = await workoutRepository.updateEffectiveFrom(
      plan.value.id,
      effectiveFromInput.value,
    );
    effectiveFromMessage.value = `生效日已改為 ${plan.value.effectiveFrom}。`;
    editingEffectiveFrom.value = false;
  } catch (e) {
    effectiveFromMessage.value = `調整失敗：${(e as Error).message}`;
  }
};

const handleUpdateVideo = async (exerciseId: string, videoUrl: string) => {
  const target = exercises.value.find((exercise) => exercise.id === exerciseId);
  if (!target) return;
  await workoutRepository.upsertExercise({ ...target, videoUrl });
  await loadExercises();
};
</script>

<template>
  <main class="plan-page">
    <header class="page-header">
      <RouterLink class="back-link" to="/workout">‹ 返回</RouterLink>
      <h1>{{ plan?.name ?? '課表' }}</h1>
      <p v-if="plan">
        v{{ plan.version }} · {{ plan.effectiveFrom }} 起生效
        <span v-if="plan.locked" class="locked-tag">已鎖定（有打卡紀錄引用）</span>
      </p>
    </header>

    <template v-if="personStore.person.isActive">
      <div v-if="isLoading" class="state-card"><p>載入課表中…</p></div>
      <div v-else-if="errorMessage" class="state-card">
        <p>{{ errorMessage }}</p>
      </div>

      <template v-else-if="plan">
        <p v-if="plan.description" class="plan-description">{{ plan.description }}</p>

        <section class="card">
          <h2>生效日</h2>
          <template v-if="editingEffectiveFrom">
            <p class="hint">
              往前調整可讓更早的日期也對應到這份課表，適合補登開始使用前就已在做的紀錄。
              既有打卡以課表 id 硬連結，調整生效日不會改到任何已存的紀錄。
            </p>
            <div class="effective-row">
              <input v-model="effectiveFromInput" class="field-input" type="date" />
              <button class="action-btn" type="button" @click="submitEffectiveFrom">儲存</button>
              <button
                class="action-btn action-btn-outline"
                type="button"
                @click="editingEffectiveFrom = false"
              >
                取消
              </button>
            </div>
          </template>
          <template v-else>
            <div class="effective-row">
              <span class="effective-value">{{ plan.effectiveFrom }} 起</span>
              <button
                class="action-btn action-btn-outline"
                type="button"
                @click="startEditEffectiveFrom"
              >
                調整生效日
              </button>
            </div>
          </template>
          <p v-if="effectiveFromMessage" class="hint">{{ effectiveFromMessage }}</p>
        </section>

        <section class="card">
          <h2>每週總覽</h2>
          <WeekOverview
            :groups="weekGroups"
            :selectable="true"
            :selected-key="selectedGroupId"
            :today-weekday="todayWeekday"
            @select="handleSelectGroup"
          />
        </section>

        <section v-if="selectedGroup" class="card">
          <header class="group-head">
            <h2>{{ selectedGroup.label }}</h2>
            <span class="group-meta">
              {{ formatWeekdays(selectedGroup.weekdays) }}
              <template v-if="selectedGroup.requirement === 'any-one'">（擇一）</template>
              · {{ formatRange(selectedGroup.estimatedMinutes, '分') }}
            </span>
          </header>

          <p v-if="selectedGroup.summary" class="group-summary">{{ selectedGroup.summary }}</p>

          <p v-if="!selectedGroup.countsTowardQuota" class="flex-note">
            這天不列入達成率的分母，有動就是賺到。
          </p>

          <ul v-if="selectedGroup.cautions.length > 0" class="caution-list">
            <li v-for="(caution, index) in selectedGroup.cautions" :key="index">
              ⚠️ {{ caution }}
            </li>
          </ul>

          <div v-if="displayVariants.length > 1" class="variant-row">
            <button
              v-for="variant in displayVariants"
              :key="variant.key"
              class="variant-btn"
              :class="{ 'variant-btn-active': variant.key === selectedVariant?.key }"
              type="button"
              @click="handleSelectVariant(variant.key)"
            >
              <span class="variant-label">{{ variant.label }}</span>
              <span class="variant-minutes">{{ formatRange(variant.estimatedMinutes, '分') }}</span>
            </button>
          </div>

          <p v-if="selectedVariant?.summary" class="group-summary">{{ selectedVariant.summary }}</p>

          <StageList :stages="displayStages" @select="handleSelectItem" />
        </section>

        <section v-if="fallbackStages.length > 0" class="card">
          <h2>忙碌日備用課表</h2>
          <StageList :stages="fallbackStages" @select="handleSelectItem" />
        </section>

        <section
          v-if="plan.medicalNotes.length > 0 || plan.avoidances.length > 0"
          class="card medical-card"
        >
          <h2>健康提醒</h2>
          <p v-if="plan.avoidances.length > 0" class="avoidance-line">
            全程避開：{{ plan.avoidances.join('、') }}
          </p>
          <ul v-if="plan.medicalNotes.length > 0">
            <li v-for="(note, index) in plan.medicalNotes" :key="index">{{ note }}</li>
          </ul>
        </section>

        <ExerciseDetail
          v-if="selectedItem"
          :item="selectedItem"
          @close="handleCloseDetail"
          @update-video="handleUpdateVideo"
        />
      </template>
    </template>

    <template v-else>
      <section class="state-card"><p>Please Login.</p></section>
    </template>
  </main>
</template>

<style scoped>
.plan-page {
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

.locked-tag {
  margin-left: 0.35rem;
  padding: 0.08rem 0.4rem;
  border-radius: 6px;
  background: #e2e8f0;
  color: #475569;
  font-size: 0.75rem;
  font-weight: 700;
}

.plan-description {
  margin: 0 0 0.85rem;
  color: #475569;
  font-size: 0.93rem;
  line-height: 1.6;
}

.card,
.state-card {
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

.card h2 {
  margin: 0 0 0.75rem;
  font-size: 1.05rem;
  color: #0f172a;
}

.group-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.4rem;
  margin-bottom: 0.5rem;
}

.group-head h2 {
  margin: 0;
}

.group-meta {
  font-size: 0.85rem;
  color: #64748b;
  font-weight: 600;
}

.group-summary {
  margin: 0 0 0.6rem;
  font-size: 0.92rem;
  color: #475569;
  line-height: 1.55;
}

.flex-note {
  margin: 0 0 0.6rem;
  font-size: 0.88rem;
  color: #64748b;
}

.variant-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.85rem;
}

.variant-btn {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.15rem;
  min-height: 48px;
  padding: 0.5rem 0.75rem;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  background: #ffffff;
  cursor: pointer;
  touch-action: manipulation;
  text-align: left;
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease;
}

.variant-btn:hover {
  border-color: #0f766e;
}

.variant-btn-active {
  border-color: #0f766e;
  background: #f0fdfa;
}

.variant-label {
  font-size: 0.92rem;
  font-weight: 700;
  color: #0f766e;
}

.variant-minutes {
  font-size: 0.8rem;
  color: #64748b;
  font-variant-numeric: tabular-nums;
}

.caution-list {
  margin: 0 0 0.85rem;
  padding: 0.6rem 0.75rem;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 10px;
  color: #78350f;
  font-size: 0.88rem;
  line-height: 1.5;
}

.effective-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
}

.effective-value {
  font-size: 1rem;
  font-weight: 700;
  color: #0f766e;
}

.field-input {
  flex: 1 1 10rem;
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
  font-size: 0.93rem;
  font-weight: 700;
  cursor: pointer;
  touch-action: manipulation;
  transition: background-color 0.18s ease;
}

.action-btn:hover {
  background: #115e59;
}

.action-btn-outline {
  background: #ffffff;
  color: #0f766e;
}

.action-btn-outline:hover {
  background: #ecfeff;
}

.hint {
  margin: 0.55rem 0 0;
  color: #64748b;
  font-size: 0.86rem;
  line-height: 1.6;
}

.medical-card {
  background: #f8fafc;
}

.avoidance-line {
  margin: 0 0 0.5rem;
  padding: 0.45rem 0.6rem;
  border-radius: 8px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #7f1d1d;
  font-size: 0.88rem;
  font-weight: 600;
}

.medical-card ul {
  margin: 0;
  padding-left: 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.88rem;
  color: #64748b;
  line-height: 1.6;
}
</style>
