<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';
import IngredientInput from '@/components/cook/IngredientInput.vue';
import SourceLink from '@/components/cook/SourceLink.vue';
import StepEditor from '@/components/cook/StepEditor.vue';
import { cookRepository, newId } from '@/services/cook/localRepository';
import { parseYoutubeId } from '@/services/cook/youtube';
import {
  COOK_SCHEMA_VERSION,
  RECIPE_SECTIONS,
  SECTION_LABELS,
  type Ingredient,
  type Recipe,
  type RecipeIngredient,
  type RecipeSection,
  type RecipeSource,
} from '@/services/cook/types';
import { popModal, pushModal } from '@/utils/modalStack';

const route = useRoute();
const router = useRouter();

const recipeId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''));
const isEditing = computed(() => recipeId.value !== '');

const isLoading = ref(true);
const isSaving = ref(false);
const errorMessage = ref('');

const master = ref<Ingredient[]>([]);
/** 既有食譜的原貌，存檔時用來保留不在本表單編輯範圍內的欄位 */
const original = ref<Recipe | null>(null);

const name = ref('');
/** 食材／醃料／調味料三區，以分區為 key，三區的操作邏輯完全相同 */
const rows = ref<Record<RecipeSection, RecipeIngredient[]>>({
  food: [],
  marinade: [],
  seasoning: [],
});
const steps = ref<string[]>([]);
const sources = ref<RecipeSource[]>([]);
const note = ref('');

/** 表單內容的比較基準，用來判斷有沒有未儲存的變更 */
const snapshot = () =>
  JSON.stringify({
    name: name.value,
    rows: rows.value,
    steps: steps.value,
    sources: sources.value,
    note: note.value,
  });

const initialSnapshot = ref('');
const isDirty = computed(() => snapshot() !== initialSnapshot.value);

const blankIngredient = (section: RecipeSection): RecipeIngredient => ({
  id: newId(),
  ingredientId: '',
  nameSnapshot: '',
  kind: section,
});

const loadAll = async () => {
  isLoading.value = true;
  try {
    master.value = await cookRepository.listIngredients();

    if (isEditing.value) {
      const recipe = await cookRepository.getRecipe(recipeId.value);
      if (!recipe) {
        errorMessage.value = '找不到這道食譜，可能已被刪除。';
        isLoading.value = false;
        return;
      }
      original.value = recipe;
      name.value = recipe.name;
      RECIPE_SECTIONS.forEach((section) => {
        rows.value[section] = recipe.ingredients
          .filter((item) => item.kind === section)
          .map((item) => ({ ...item }));
      });
      steps.value = [...recipe.steps];
      sources.value = recipe.sources.map((item) => ({ ...item }));
      note.value = recipe.note ?? '';
    } else {
      // 新增時先擺一列空的食材，省掉「新增食譜後還要再按一次新增食材」
      rows.value.food = [blankIngredient('food')];
    }

    initialSnapshot.value = snapshot();
  } catch (e) {
    console.error('載入食譜失敗：', e);
    errorMessage.value = '載入食譜資料失敗。';
  } finally {
    isLoading.value = false;
  }
};

onMounted(loadAll);

// --- 食材／醃料／調味料 ---------------------------------------------------

const addRow = (section: RecipeSection) => {
  rows.value[section] = [...rows.value[section], blankIngredient(section)];
};

const removeRow = (section: RecipeSection, index: number) => {
  rows.value[section] = rows.value[section].filter((_, i) => i !== index);
};

// --- 參考來源 -------------------------------------------------------------

const addSource = () => {
  sources.value = [...sources.value, { url: '' }];
};

const updateSourceUrl = (index: number, event: Event) => {
  const url = (event.target as HTMLInputElement).value;
  sources.value = sources.value.map((source, i) =>
    i === index ? { ...source, url, youtubeId: parseYoutubeId(url) ?? undefined } : source,
  );
};

const removeSource = (index: number) => {
  sources.value = sources.value.filter((_, i) => i !== index);
};

// --- 儲存 -----------------------------------------------------------------

/** 儲存後的導頁不該再被離開確認攔一次 */
let bypassGuard = false;

const handleSave = async () => {
  errorMessage.value = '';
  if (name.value.trim() === '') {
    errorMessage.value = '請先填菜名。';
    return;
  }

  isSaving.value = true;
  try {
    const now = new Date().toISOString();
    const existing = original.value;

    // 依 RECIPE_SECTIONS 的順序攤平，重新編輯時各區的內容才會回到原本的位置
    const ingredients = RECIPE_SECTIONS.flatMap((section) => rows.value[section])
      .filter((item) => item.nameSnapshot.trim() !== '')
      .map((item) => ({ ...item, nameSnapshot: item.nameSnapshot.trim() }));

    const recipe: Recipe = {
      id: existing?.id ?? newId(),
      schemaVersion: COOK_SCHEMA_VERSION,
      name: name.value.trim(),
      ingredients,
      // 完全空白的步驟只是按過「新增步驟」卻沒填，留著會讓編號憑空多一格
      steps: steps.value.map((step) => step.trim()).filter((step) => step !== ''),
      sources: sources.value
        .filter((source) => source.url.trim() !== '')
        .map((source) => ({ ...source, url: source.url.trim() })),
      note: note.value.trim() === '' ? undefined : note.value.trim(),
      // 這三個欄位由烹飪紀錄回填，表單不得覆蓋
      mealTags: existing?.mealTags ?? [],
      cookCount: existing?.cookCount ?? 0,
      lastCookedAt: existing?.lastCookedAt,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    const saved = await cookRepository.saveRecipe(recipe);
    initialSnapshot.value = snapshot();
    bypassGuard = true;
    router.push(`/cook/recipe/${saved.id}`);
  } catch (e) {
    console.error('儲存食譜失敗：', e);
    errorMessage.value = `儲存失敗：${(e as Error).message}`;
  } finally {
    isSaving.value = false;
  }
};

const handleCancel = () => {
  router.push(isEditing.value ? `/cook/recipe/${recipeId.value}` : '/cook');
};

// --- 離開頁面的保護 -------------------------------------------------------
// 手機上最容易發生的資料遺失就是誤觸返回

const leavePath = ref('');
const modalEntry = { onEscape: () => cancelLeave() };

onBeforeRouteLeave((to) => {
  if (bypassGuard || !isDirty.value) return true;
  leavePath.value = to.fullPath;
  pushModal(modalEntry);
  return false;
});

const cancelLeave = () => {
  if (leavePath.value === '') return;
  leavePath.value = '';
  popModal(modalEntry);
};

const confirmLeave = () => {
  const target = leavePath.value;
  leavePath.value = '';
  popModal(modalEntry);
  bypassGuard = true;
  router.push(target);
};

onUnmounted(() => popModal(modalEntry));
</script>

<template>
  <main class="cook-page">
    <header class="page-header">
      <RouterLink class="back-link" to="/cook">‹ 獺廚娘</RouterLink>
      <h1>{{ isEditing ? '編輯食譜' : '新增食譜' }}</h1>
    </header>

    <div v-if="isLoading" class="state-card">
      <p>載入中…</p>
    </div>

    <template v-else>
      <p v-if="errorMessage" class="flash flash-error">{{ errorMessage }}</p>

      <section class="form-card">
        <label class="field-label" for="recipe-name">菜名</label>
        <input
          id="recipe-name"
          v-model="name"
          class="text-input"
          type="text"
          placeholder="例：韭菜豬肉水餃"
        />
      </section>

      <section v-for="section in RECIPE_SECTIONS" :key="section" class="form-card">
        <h2>{{ SECTION_LABELS[section] }}</h2>
        <div class="row-stack">
          <IngredientInput
            v-for="(item, index) in rows[section]"
            :key="item.id"
            v-model="rows[section][index]"
            :ingredients="master"
            @remove="removeRow(section, index)"
          />
        </div>
        <button class="add-btn" type="button" @click="addRow(section)">
          ＋ 新增{{ SECTION_LABELS[section] }}
        </button>
      </section>

      <section class="form-card">
        <h2>步驟</h2>
        <StepEditor v-model:steps="steps" />
      </section>

      <section class="form-card">
        <h2>參考來源</h2>
        <div class="row-stack">
          <div v-for="(source, index) in sources" :key="index" class="source-block">
            <div class="source-row">
              <input
                class="text-input"
                type="url"
                inputmode="url"
                :value="source.url"
                placeholder="貼上 YouTube 或食譜網址"
                @input="updateSourceUrl(index, $event)"
              />
              <button
                class="icon-btn icon-btn-danger"
                type="button"
                title="移除"
                @click="removeSource(index)"
              >
                ✕
              </button>
            </div>
            <SourceLink v-if="source.url.trim()" :source="source" />
          </div>
        </div>
        <button class="add-btn" type="button" @click="addSource">＋ 新增來源</button>
      </section>

      <section class="form-card">
        <label class="field-label" for="recipe-note">備註</label>
        <textarea
          id="recipe-note"
          v-model="note"
          class="text-input note-input"
          rows="3"
          placeholder="例：麵皮買現成的就好"
        ></textarea>
      </section>

      <div class="form-actions">
        <button class="action-btn" type="button" :disabled="isSaving" @click="handleSave">
          {{ isSaving ? '儲存中…' : '儲存' }}
        </button>
        <button class="action-btn action-btn-outline" type="button" @click="handleCancel">
          取消
        </button>
      </div>
    </template>

    <teleport to="body">
      <div v-if="leavePath" class="modal-overlay">
        <div class="modal-card">
          <h3 class="modal-title">尚未儲存</h3>
          <p class="modal-message">這道食譜還沒存檔，離開後修改的內容會消失。</p>
          <div class="modal-actions">
            <button class="action-btn action-btn-outline" type="button" @click="cancelLeave">
              留在這裡
            </button>
            <button class="action-btn action-btn-danger" type="button" @click="confirmLeave">
              放棄變更
            </button>
          </div>
        </div>
      </div>
    </teleport>
  </main>
</template>

<style scoped>
.cook-page {
  max-width: 860px;
  margin: 0 auto;
  padding: 1rem 0.9rem 2rem;
  color: #1f2937;
}

.page-header {
  margin-bottom: 0.4rem;
}

.page-header h1 {
  margin: 0.35rem 0 0;
  font-size: clamp(1.4rem, 2.4vw, 1.8rem);
}

.back-link {
  color: #9a3412;
  font-size: 0.9rem;
  font-weight: 700;
  text-decoration: none;
}

.back-link:hover {
  text-decoration: underline;
}

.state-card,
.form-card {
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

.form-card h2 {
  margin: 0 0 0.75rem;
  font-size: 1.05rem;
  color: #0f172a;
}

.field-label {
  display: block;
  margin-bottom: 0.45rem;
  font-size: 0.92rem;
  font-weight: 700;
  color: #0f172a;
}

.text-input {
  box-sizing: border-box;
  width: 100%;
  min-height: 46px;
  padding: 0.45rem 0.6rem;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #ffffff;
  color: #1f2937;
  font-family: inherit;
  /* iOS 在字級小於 16px 時會自動放大整頁 */
  font-size: max(0.95rem, 16px);
}

.text-input:focus {
  outline: none;
  border-color: #c2410c;
  box-shadow: 0 0 0 3px rgba(194, 65, 12, 0.12);
}

.note-input {
  resize: vertical;
  line-height: 1.5;
}

.row-stack {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.source-block {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.source-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.icon-btn {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 46px;
  min-height: 46px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
  color: #475569;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1;
  touch-action: manipulation;
  cursor: pointer;
}

.icon-btn-danger {
  border-color: #fecaca;
  background: #fff1f2;
  color: #be123c;
}

.icon-btn-danger:hover {
  background: #ffe4e6;
  border-color: #fb7185;
}

.add-btn {
  margin-top: 0.5rem;
  width: 100%;
  min-height: 46px;
  border: 1px dashed #fdba74;
  border-radius: 10px;
  background: #fff7ed;
  color: #9a3412;
  font-size: 0.92rem;
  font-weight: 700;
  touch-action: manipulation;
  cursor: pointer;
  transition: background-color 0.18s ease, border-color 0.18s ease;
}

.add-btn:hover {
  background: #ffedd5;
  border-color: #c2410c;
}

.form-actions,
.modal-actions {
  margin-top: 0.9rem;
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
  border: 1px solid #c2410c;
  background: #c2410c;
  color: #ffffff;
  font-size: 0.95rem;
  font-weight: 700;
  text-decoration: none;
  touch-action: manipulation;
  cursor: pointer;
  transition: background-color 0.18s ease;
}

.action-btn:hover:not(:disabled) {
  background: #9a3412;
}

.action-btn-outline {
  background: #ffffff;
  color: #c2410c;
}

.action-btn-outline:hover:not(:disabled) {
  background: #fff7ed;
}

.action-btn-danger {
  border-color: #dc2626;
  background: #dc2626;
}

.action-btn-danger:hover:not(:disabled) {
  background: #b91c1c;
}

.action-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
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

.modal-overlay {
  backdrop-filter: blur(5px);
  background: rgba(15, 23, 42, 0.22);
  position: fixed;
  inset: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
  padding: 1rem;
}

.modal-card {
  width: min(560px, 100%);
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 1rem;
  box-shadow: 0 6px 22px -16px rgba(15, 23, 42, 0.38);
}

.modal-title {
  margin: 0;
  color: #0f172a;
  font-size: 1.15rem;
}

.modal-message {
  margin: 0.6rem 0 0;
  color: #475569;
  font-weight: 600;
  line-height: 1.45;
}

@media (max-width: 640px) {
  .form-actions .action-btn,
  .modal-actions .action-btn {
    flex: 1 1 100%;
  }
}
</style>
