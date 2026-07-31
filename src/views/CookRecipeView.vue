<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ConfirmModalView from '@/components/ConfirmModalView.vue';
import SourceLink from '@/components/cook/SourceLink.vue';
import { cookRepository } from '@/services/cook/localRepository';
import { formatAmount } from '@/services/cook/units';
import {
  MEAL_LABELS,
  MEAL_SLOTS,
  RECIPE_SECTIONS,
  SECTION_LABELS,
  type Recipe,
  type RecipeIngredient,
  type RecipeSection,
} from '@/services/cook/types';

const route = useRoute();
const router = useRouter();

const recipeId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''));

const recipe = ref<Recipe | null>(null);
const isLoading = ref(true);
const errorMessage = ref('');

onMounted(async () => {
  try {
    recipe.value = await cookRepository.getRecipe(recipeId.value);
    if (!recipe.value) errorMessage.value = '找不到這道食譜，可能已被刪除。';
  } catch (e) {
    console.error('載入食譜失敗：', e);
    errorMessage.value = '載入食譜資料失敗。';
  } finally {
    isLoading.value = false;
  }
});

interface SectionRows {
  section: RecipeSection;
  label: string;
  items: RecipeIngredient[];
}

/** 只列出有內容的分區，沒醃過的菜不必看到空的「醃料」標題 */
const sections = computed<SectionRows[]>(() =>
  RECIPE_SECTIONS.map((section) => ({
    section,
    label: SECTION_LABELS[section],
    items: recipe.value?.ingredients.filter((item) => item.kind === section) ?? [],
  })).filter((group) => group.items.length > 0),
);

/** 依固定的時段順序顯示，而非 mealTags 的累積順序 */
const mealText = computed(() =>
  MEAL_SLOTS.filter((slot) => recipe.value?.mealTags.includes(slot))
    .map((slot) => MEAL_LABELS[slot])
    .join('、'),
);

const handleDelete = async () => {
  try {
    await cookRepository.deleteRecipe(recipeId.value);
    router.push('/cook');
  } catch (e) {
    console.error('刪除食譜失敗：', e);
    errorMessage.value = `刪除失敗：${(e as Error).message}`;
  }
};
</script>

<template>
  <main class="cook-page">
    <header class="page-header">
      <RouterLink class="back-link" to="/cook">‹ 獺廚娘</RouterLink>
    </header>

    <div v-if="isLoading" class="state-card">
      <p>載入中…</p>
    </div>

    <div v-else-if="!recipe" class="state-card">
      <p>{{ errorMessage }}</p>
    </div>

    <template v-else>
      <p v-if="errorMessage" class="flash flash-error">{{ errorMessage }}</p>

      <section class="hero-card">
        <h1>{{ recipe.name }}</h1>
        <p class="hero-meta">
          {{ recipe.cookCount > 0 ? `煮過 ${recipe.cookCount} 次` : '還沒煮過' }}
          <span v-if="recipe.lastCookedAt"> · 上次 {{ recipe.lastCookedAt }}</span>
          <span v-if="mealText"> · {{ mealText }}</span>
        </p>
      </section>

      <section v-if="sections.length > 0" class="list-card">
        <template v-for="(group, index) in sections" :key="group.section">
          <h2 :class="{ 'section-gap': index > 0 }">{{ group.label }}</h2>
          <ul class="amount-list">
            <li v-for="item in group.items" :key="item.id">
              <span class="amount-name">{{ item.nameSnapshot }}</span>
              <span class="amount-value">{{ formatAmount(item.amount, item.unit) }}</span>
            </li>
          </ul>
        </template>
      </section>

      <section v-if="recipe.steps.length > 0" class="list-card">
        <h2>步驟</h2>
        <ol class="step-list">
          <li v-for="(step, index) in recipe.steps" :key="index">
            <span class="step-index">{{ index + 1 }}</span>
            <span class="step-text">{{ step }}</span>
          </li>
        </ol>
      </section>

      <section v-if="recipe.sources.length > 0" class="list-card">
        <h2>參考來源</h2>
        <div class="source-stack">
          <SourceLink v-for="(source, index) in recipe.sources" :key="index" :source="source" />
        </div>
      </section>

      <section v-if="recipe.note" class="list-card">
        <h2>備註</h2>
        <p class="note-text">{{ recipe.note }}</p>
      </section>

      <div class="page-actions">
        <RouterLink class="action-btn" :to="`/cook/recipe/${recipe.id}/edit`">編輯</RouterLink>
        <ConfirmModalView
          title="刪除食譜"
          :message="`確定要刪除「${recipe.name}」嗎？已存在的烹飪紀錄會保留菜名，但食譜內容會消失。`"
          confirm-text="刪除"
          cancel-text="取消"
          @confirmed="handleDelete"
        >
          刪除
        </ConfirmModalView>
      </div>
    </template>
  </main>
</template>

<style scoped>
.cook-page {
  max-width: 860px;
  margin: 0 auto;
  padding: 1rem 0.9rem 2rem;
  color: #1f2937;
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
.hero-card,
.list-card {
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

.hero-card {
  border-color: #fed7aa;
  background: linear-gradient(180deg, #fff7ed 0%, #ffffff 60%);
}

.hero-card h1 {
  margin: 0;
  font-size: clamp(1.4rem, 2.6vw, 1.9rem);
  color: #0f172a;
}

.hero-meta {
  margin: 0.4rem 0 0;
  font-size: 0.9rem;
  font-weight: 600;
  color: #9a3412;
}

.list-card h2 {
  margin: 0 0 0.75rem;
  font-size: 1.05rem;
  color: #0f172a;
}

.section-gap {
  margin-top: 1rem;
}

.amount-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.amount-list li {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.6rem;
  padding: 0.45rem 0.6rem;
  border-radius: 8px;
  background: #f8fafc;
}

.amount-name {
  font-size: 0.95rem;
  font-weight: 600;
  min-width: 0;
  word-break: break-word;
}

.amount-value {
  flex: 0 0 auto;
  font-size: 0.88rem;
  font-weight: 700;
  color: #9a3412;
}

.step-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.step-list li {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
}

.step-index {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.6rem;
  height: 1.6rem;
  margin-top: 0.1rem;
  border-radius: 50%;
  background: #c2410c;
  color: #ffffff;
  font-size: 0.8rem;
  font-weight: 700;
}

.step-text {
  min-width: 0;
  font-size: 0.95rem;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.source-stack {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.note-text {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.6;
  white-space: pre-wrap;
}

.empty-hint {
  margin: 0;
  color: #94a3b8;
  font-size: 0.88rem;
}

.page-actions {
  margin-top: 0.9rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  align-items: center;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 54px;
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

.action-btn:hover {
  background: #9a3412;
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
  .page-actions .action-btn,
  .page-actions :deep(.confirm-trigger-btn) {
    flex: 1 1 100%;
  }
}
</style>
