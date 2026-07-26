<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { usePersonStore } from '@/stores/person';
import ExerciseDetail from '@/components/workout/ExerciseDetail.vue';
import StageList from '@/components/workout/StageList.vue';
import ValidationReport from '@/components/workout/ValidationReport.vue';
import WeekOverview from '@/components/workout/WeekOverview.vue';
import { workoutRepository } from '@/services/workout/localRepository';
import { commitDraftPlan, parsePlanJson, type ParseResult } from '@/services/workout/parsePlan';
import {
  draftFallbackToDisplay,
  draftStagesToDisplay,
  draftToWeekGroups,
  type DisplayStage,
} from '@/services/workout/display';
import { formatRange, formatWeekdays } from '@/services/workout/schedule';
import type { ExerciseDef, WorkoutPlan } from '@/services/workout/types';

const PROMPT_TEMPLATE = `請依下列 JSON schema 輸出運動課表，只輸出 JSON、不要加說明文字或 markdown 圍欄。

規則：
- weekdays 用 1=週一 … 7=週日
- 若某幾天是「擇一進行」（例如「週六或週日」），該群組設 requirement:"any-one"，否則 "all"
- 各群組的 weekdays 不可重疊；未列出的日子視為休息日
- 每個動作都要有 steps（條列步驟）、specText（規格原文）、
  以及 measureType（reps 次數型 / time 時間型 / hold 持續型）
- 防護與注意事項分兩層：群組層放 cautions，動作層也放 cautions
- 忙碌日的替代方案請放在 fallbackRoutines
- 每個動作請附一則 YouTube 參考影片連結（videoUrl），找不到則留空字串
- 每個動作請列出所需 equipment（器材）
- 相同的動作在不同群組請使用完全一致的名稱
- 請確認各階段 estimatedMinutes 加總等於群組宣稱的 estimatedMinutes

Schema：
{
  "name": "課表名稱",
  "description": "一段整體說明",
  "effectiveFrom": "YYYY-MM-DD",
  "medicalNotes": ["醫療免責或健康提醒"],
  "groups": [
    {
      "label": "群組名稱，例如 核心與上肢強化",
      "weekdays": [1, 3, 5],
      "requirement": "all",
      "summary": "主要內容與防護重點一句話",
      "cautions": ["群組層防護重點"],
      "estimatedMinutes": { "min": 30 },
      "stages": [
        {
          "name": "第一階段：熱身",
          "estimatedMinutes": { "min": 5 },
          "rounds": { "min": 3, "max": 4 },
          "restBetweenRoundsSeconds": { "min": 60, "max": 120 },
          "note": "循環訓練說明（沒有就省略）",
          "items": [
            {
              "name": "動作名稱",
              "nameEn": "English Name",
              "targetMuscles": ["訓練部位"],
              "equipment": ["所需器材"],
              "steps": ["步驟一", "步驟二"],
              "cautions": ["動作層注意事項"],
              "videoUrl": "",
              "measureType": "reps",
              "sets": 3,
              "reps": { "min": 8, "max": 12 },
              "durationSeconds": 45,
              "holdSeconds": 2,
              "perSide": false,
              "resistance": "0",
              "specText": "每組 8-12 次"
            }
          ]
        }
      ]
    }
  ],
  "fallbackRoutines": [
    {
      "label": "10 分鐘微型彈性課表",
      "when": "忙碌日／時間不夠時",
      "estimatedMinutes": { "min": 10 },
      "items": [ 同上動作格式 ]
    }
  ]
}

我的需求：（請在此填寫年齡、身體限制、可用器材、每次可運動時間、目標）`;

const router = useRouter();
const personStore = usePersonStore();

const rawText = ref('');
const result = ref<ParseResult | null>(null);
const existingPlans = ref<WorkoutPlan[]>([]);
const existingExercises = ref<ExerciseDef[]>([]);
const selectedGroupIndex = ref(0);
const selectedItemKey = ref('');
const aliases = ref<Record<string, string>>({});
const showPrompt = ref(false);
const copyHint = ref('');
const importError = ref('');
const isCommitting = ref(false);

onMounted(async () => {
  existingPlans.value = await workoutRepository.listPlans();
  existingExercises.value = await workoutRepository.listExercises();
});

const handleValidate = () => {
  importError.value = '';
  selectedGroupIndex.value = 0;
  selectedItemKey.value = '';
  aliases.value = {};
  result.value = parsePlanJson(rawText.value, {
    existingPlans: existingPlans.value,
    existingExercises: existingExercises.value,
  });
};

const handleClear = () => {
  rawText.value = '';
  result.value = null;
  importError.value = '';
};

const handleCopyPrompt = async () => {
  try {
    await navigator.clipboard.writeText(PROMPT_TEMPLATE);
    copyHint.value = '已複製到剪貼簿';
  } catch {
    copyHint.value = '複製失敗，請手動選取下方文字';
    showPrompt.value = true;
  }
};

const draftGroups = computed(() => result.value?.plan?.groups ?? []);

const weekGroups = computed(() => draftToWeekGroups(draftGroups.value));

const selectedGroup = computed(() => draftGroups.value[selectedGroupIndex.value] ?? null);

const displayStages = computed<DisplayStage[]>(() =>
  selectedGroup.value && result.value
    ? draftStagesToDisplay(
        selectedGroup.value.stages,
        result.value.exercises,
        `g${selectedGroupIndex.value}`,
      )
    : [],
);

const fallbackStages = computed<DisplayStage[]>(() =>
  result.value?.plan
    ? result.value.plan.fallbackRoutines.map((fallback, index) =>
        draftFallbackToDisplay(fallback, result.value!.exercises, `f${index}`),
      )
    : [],
);

const allItems = computed(() =>
  [...displayStages.value, ...fallbackStages.value].flatMap((stage) => stage.items),
);

const selectedItem = computed(
  () => allItems.value.find((item) => item.key === selectedItemKey.value) ?? null,
);

const reusedCount = computed(
  () => result.value?.matches.filter((match) => match.existingId).length ?? 0,
);

const newCount = computed(
  () => result.value?.matches.filter((match) => !match.existingId).length ?? 0,
);

const similarMatches = computed(
  () => result.value?.matches.filter((match) => match.similarTo) ?? [],
);

const handleSelectGroup = (key: string) => {
  selectedGroupIndex.value = Number(key);
  selectedItemKey.value = '';
};

const handleMerge = (name: string, canonical: string) => {
  aliases.value = { ...aliases.value, [name]: canonical };
};

const handleKeepSeparate = (name: string) => {
  const next = { ...aliases.value };
  delete next[name];
  aliases.value = next;
};

const handleCommit = async () => {
  if (!result.value?.ok) return;
  isCommitting.value = true;
  importError.value = '';
  try {
    const plan = await commitDraftPlan(workoutRepository, result.value, aliases.value);
    router.push(`/workout/plan/${plan.id}`);
  } catch (e) {
    importError.value = `匯入失敗：${(e as Error).message}`;
  } finally {
    isCommitting.value = false;
  }
};
</script>

<template>
  <main class="import-page">
    <header class="page-header">
      <RouterLink class="back-link" to="/workout">‹ 返回</RouterLink>
      <h1>匯入課表</h1>
      <p>貼上 JSON → 驗證 → 確認七天預覽 → 匯入</p>
    </header>

    <template v-if="personStore.person.isActive">
      <!-- 步驟 1：貼上 -->
      <section class="card">
        <h2>1. 貼上課表 JSON</h2>
        <textarea
          v-model="rawText"
          class="json-input"
          rows="10"
          placeholder="把 AI 產生的課表 JSON 貼在這裡…"
        ></textarea>
        <div class="card-actions">
          <button class="action-btn" type="button" :disabled="!rawText.trim()" @click="handleValidate">
            驗證並預覽
          </button>
          <button class="action-btn action-btn-outline" type="button" @click="handleClear">
            清空
          </button>
          <button class="action-btn action-btn-outline" type="button" @click="handleCopyPrompt">
            複製提示詞模板
          </button>
        </div>
        <p v-if="copyHint" class="hint">{{ copyHint }}</p>
        <details class="prompt-details" :open="showPrompt">
          <summary>檢視提示詞模板</summary>
          <pre class="prompt-text">{{ PROMPT_TEMPLATE }}</pre>
        </details>
      </section>

      <template v-if="result">
        <!-- 步驟 2：驗證結果 -->
        <section class="card">
          <h2>2. 驗證結果</h2>
          <ValidationReport :errors="result.errors" :warnings="result.warnings" />
        </section>

        <template v-if="result.plan">
          <!-- 步驟 3：七天預覽 -->
          <section class="card">
            <h2>3. 七天預覽</h2>
            <p class="hint">請逐日確認「哪天該做什麼」與原始課表一致。</p>
            <WeekOverview
              :groups="weekGroups"
              :selectable="true"
              :selected-key="String(selectedGroupIndex)"
              @select="handleSelectGroup"
            />

            <div v-if="selectedGroup" class="group-detail">
              <header class="group-head">
                <h3>{{ selectedGroup.label }}</h3>
                <span class="group-meta">
                  {{ formatWeekdays(selectedGroup.weekdays) }}
                  <template v-if="selectedGroup.requirement === 'any-one'">（擇一）</template>
                  · {{ formatRange(selectedGroup.estimatedMinutes, '分') }}
                </span>
              </header>
              <p v-if="selectedGroup.summary" class="group-summary">{{ selectedGroup.summary }}</p>
              <ul v-if="selectedGroup.cautions.length > 0" class="caution-list">
                <li v-for="(caution, index) in selectedGroup.cautions" :key="index">
                  ⚠️ {{ caution }}
                </li>
              </ul>
              <StageList :stages="displayStages" @select="selectedItemKey = $event" />
            </div>

            <div v-if="fallbackStages.length > 0" class="group-detail">
              <h3>忙碌日備用課表</h3>
              <StageList :stages="fallbackStages" @select="selectedItemKey = $event" />
            </div>
          </section>

          <!-- 步驟 4：動作庫比對 -->
          <section class="card">
            <h2>4. 動作庫比對</h2>
            <p class="hint">沿用既有 {{ reusedCount }} 個、新增 {{ newCount }} 個動作。</p>

            <div v-if="similarMatches.length > 0" class="similar-block">
              <p class="similar-title">⚠️ 名稱相近，請確認是否為同一動作：</p>
              <div v-for="match in similarMatches" :key="match.name" class="similar-row">
                <span class="similar-names">
                  「{{ match.name }}」 vs
                  {{ match.similarSource === 'library' ? '既有動作庫的' : '同一份課表的' }}
                  「{{ match.similarTo }}」
                </span>
                <span class="similar-actions">
                  <button
                    class="mini-btn"
                    :class="{ 'mini-btn-active': aliases[match.name] === match.similarTo }"
                    type="button"
                    @click="handleMerge(match.name, match.similarTo as string)"
                  >
                    視為同一個
                  </button>
                  <button
                    class="mini-btn"
                    :class="{ 'mini-btn-active': aliases[match.name] === undefined }"
                    type="button"
                    @click="handleKeepSeparate(match.name)"
                  >
                    分開建立
                  </button>
                </span>
              </div>
            </div>

            <ul class="exercise-list">
              <li v-for="match in result.matches" :key="match.name">
                <span class="exercise-name">{{ aliases[match.name] ?? match.name }}</span>
                <span class="exercise-tag" :class="match.existingId ? 'tag-reuse' : 'tag-new'">
                  {{ match.existingId ? '沿用' : '新增' }}
                </span>
              </li>
            </ul>
          </section>

          <!-- 步驟 5：匯入 -->
          <section class="card">
            <h2>5. 確認匯入</h2>
            <p class="hint">
              匯入後將以「{{ result.plan.effectiveFrom }}」為生效日；
              該日起的打卡會連結到這份新課表，先前的紀錄仍連結舊課表。
            </p>
            <p v-if="importError" class="flash flash-error">{{ importError }}</p>
            <div class="card-actions">
              <button
                class="action-btn"
                type="button"
                :disabled="!result.ok || isCommitting"
                @click="handleCommit"
              >
                {{ isCommitting ? '匯入中…' : '確認匯入' }}
              </button>
            </div>
            <p v-if="!result.ok" class="hint">請先修正上方錯誤。</p>
          </section>
        </template>
      </template>

      <ExerciseDetail :item="selectedItem" @close="selectedItemKey = ''" />
    </template>

    <template v-else>
      <section class="card state-card"><p>Please Login.</p></section>
    </template>
  </main>
</template>

<style scoped>
.import-page {
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

.card h2 {
  margin: 0 0 0.7rem;
  font-size: 1.05rem;
  color: #0f172a;
}

.json-input {
  width: 100%;
  box-sizing: border-box;
  border-radius: 10px;
  border: 1px solid #cbd5e1;
  padding: 0.6rem 0.7rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.85rem;
  line-height: 1.5;
  color: #1f2937;
  outline: none;
  resize: vertical;
}

.json-input:focus {
  border-color: #0f766e;
  box-shadow: 0 0 0 3px rgba(15, 118, 110, 0.12);
}

.card-actions {
  margin-top: 0.75rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
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

.action-btn-outline {
  background: #ffffff;
  color: #0f766e;
}

.action-btn-outline:hover:not(:disabled) {
  background: #ecfeff;
}

.action-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.hint {
  margin: 0.55rem 0 0;
  color: #64748b;
  font-size: 0.87rem;
  line-height: 1.55;
}

.prompt-details {
  margin-top: 0.75rem;
  font-size: 0.88rem;
  color: #475569;
}

.prompt-details summary {
  cursor: pointer;
  font-weight: 600;
}

.prompt-text {
  margin: 0.6rem 0 0;
  padding: 0.7rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  font-size: 0.78rem;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 320px;
  overflow-y: auto;
}

.group-detail {
  margin-top: 1rem;
  padding-top: 0.9rem;
  border-top: 1px solid #e2e8f0;
}

.group-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.4rem;
}

.group-detail h3 {
  margin: 0 0 0.5rem;
  font-size: 1rem;
  color: #0f172a;
}

.group-meta {
  font-size: 0.85rem;
  color: #64748b;
  font-weight: 600;
}

.group-summary {
  margin: 0 0 0.6rem;
  font-size: 0.9rem;
  color: #475569;
  line-height: 1.55;
}

.caution-list {
  margin: 0 0 0.8rem;
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

.similar-block {
  margin-top: 0.7rem;
  padding: 0.7rem 0.8rem;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 10px;
}

.similar-title {
  margin: 0 0 0.5rem;
  font-size: 0.88rem;
  font-weight: 700;
  color: #78350f;
}

.similar-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.4rem 0;
}

.similar-names {
  font-size: 0.87rem;
  color: #78350f;
}

.similar-actions {
  display: flex;
  gap: 0.4rem;
}

.mini-btn {
  min-height: 36px;
  padding: 0.3rem 0.6rem;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #475569;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
}

.mini-btn-active {
  border-color: #0f766e;
  background: #0f766e;
  color: #ffffff;
}

.exercise-list {
  list-style: none;
  margin: 0.7rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.exercise-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.35rem 0.5rem;
  border-radius: 8px;
  background: #f8fafc;
  font-size: 0.88rem;
}

.exercise-name {
  font-weight: 600;
}

.exercise-tag {
  padding: 0.1rem 0.4rem;
  border-radius: 6px;
  font-size: 0.74rem;
  font-weight: 700;
}

.tag-reuse {
  background: #e2e8f0;
  color: #475569;
}

.tag-new {
  background: #ccfbf1;
  color: #115e59;
}

.flash {
  margin: 0.6rem 0 0;
  padding: 0.6rem 0.75rem;
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
