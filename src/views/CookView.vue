<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import RecipeCard from '@/components/cook/RecipeCard.vue';
import { usePersonStore } from '@/stores/person';
import { cookRepository } from '@/services/cook/localRepository';
import { daysSinceCookBackup, exportCookBackup, importCookBackup } from '@/services/cook/backup';
import { MEAL_LABELS, MEAL_SLOTS, type CookMeta, type Recipe } from '@/services/cook/types';

const personStore = usePersonStore();

const recipes = ref<Recipe[]>([]);
const meta = ref<CookMeta | null>(null);
const isLoading = ref(true);
const keyword = ref('');
const message = ref('');
const errorMessage = ref('');
const backupInput = ref<HTMLInputElement | null>(null);

const loadAll = async () => {
  isLoading.value = true;
  try {
    recipes.value = await cookRepository.listRecipes();
    meta.value = await cookRepository.getMeta();
  } catch (e) {
    console.error('載入獺廚娘資料失敗：', e);
    errorMessage.value = '載入食譜資料失敗。';
  } finally {
    isLoading.value = false;
  }
};

onMounted(loadAll);

/** 搜尋在已載入的清單上做，不打 repository */
const visibleRecipes = computed(() => {
  const needle = keyword.value.trim().toLowerCase();
  if (needle === '') return recipes.value;
  return recipes.value.filter((recipe) => {
    if (recipe.name.toLowerCase().includes(needle)) return true;
    return recipe.ingredients.some((item) => item.nameSnapshot.toLowerCase().includes(needle));
  });
});

const backupHint = computed(() => {
  const days = daysSinceCookBackup(meta.value?.lastBackupAt);
  if (days === null) return { text: '尚未備份', warn: true };
  if (days === 0) return { text: '今天已備份', warn: false };
  return { text: `${days} 天前`, warn: days > 30 };
});

const handleExport = async () => {
  message.value = '';
  errorMessage.value = '';
  try {
    const fileName = await exportCookBackup(cookRepository);
    meta.value = await cookRepository.getMeta();
    message.value = `已匯出 ${fileName}`;
  } catch (e) {
    errorMessage.value = `匯出失敗：${(e as Error).message}`;
  }
};

const handleImportClick = () => {
  backupInput.value?.click();
};

const handleImportFile = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;

  message.value = '';
  errorMessage.value = '';
  try {
    await importCookBackup(cookRepository, file);
    await loadAll();
    message.value = '備份已還原。';
  } catch (e) {
    errorMessage.value = `還原失敗：${(e as Error).message}`;
  }
};
</script>

<template>
  <main class="cook-page">
    <header class="page-header">
      <h1>獺廚娘</h1>
      <p>食譜、烹飪紀錄與「今天煮什麼」</p>
    </header>

    <template v-if="personStore.person.isActive">
      <div v-if="isLoading" class="state-card">
        <p>載入食譜中…</p>
      </div>

      <template v-else>
        <p v-if="message" class="flash flash-ok">{{ message }}</p>
        <p v-if="errorMessage" class="flash flash-error">{{ errorMessage }}</p>

        <!-- 今天煮什麼：需要烹飪紀錄才有加權依據，批次 B 接上 -->
        <section class="today-card">
          <h2>今天煮什麼？</h2>
          <div class="meal-row">
            <button v-for="slot in MEAL_SLOTS" :key="slot" class="meal-btn" type="button" disabled>
              {{ MEAL_LABELS[slot] }}
            </button>
          </div>
          <p class="empty-hint">推薦需要累積烹飪紀錄才會準，等每日紀錄做好之後開放（批次 B）。</p>
        </section>

        <!-- 食譜 -->
        <section class="list-card">
          <div class="list-head">
            <h2>食譜（{{ recipes.length }} 道）</h2>
            <input
              v-model="keyword"
              class="search-input"
              type="search"
              placeholder="搜尋菜名或食材"
            />
          </div>

          <ul v-if="visibleRecipes.length > 0" class="recipe-list">
            <li v-for="recipe in visibleRecipes" :key="recipe.id">
              <RecipeCard :recipe="recipe" />
            </li>
          </ul>
          <p v-else class="empty-hint">
            {{ recipes.length === 0 ? '還沒有任何食譜，先加一道常煮的菜吧。' : '沒有符合的食譜。' }}
          </p>

          <div class="card-actions">
            <RouterLink class="action-btn" to="/cook/recipe/new">＋ 新增食譜</RouterLink>
          </div>
        </section>

        <!-- 備份 -->
        <section class="list-card">
          <h2>備份</h2>
          <p class="backup-hint" :class="{ 'backup-warn': backupHint.warn }">
            上次備份：{{ backupHint.text }}
            <span v-if="backupHint.warn">⚠</span>
          </p>
          <p class="empty-hint">
            資料目前存在這台裝置的瀏覽器中，清除瀏覽資料或換機會遺失，請定期匯出。
          </p>
          <div class="card-actions">
            <button class="action-btn" type="button" @click="handleExport">匯出備份</button>
            <button class="action-btn action-btn-outline" type="button" @click="handleImportClick">
              還原備份
            </button>
            <input
              ref="backupInput"
              class="hidden-input"
              type="file"
              accept="application/json,.json"
              @change="handleImportFile"
            />
          </div>
        </section>
      </template>
    </template>

    <template v-else>
      <section class="state-card">
        <p>Please Login.</p>
      </section>
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

.page-header {
  margin-bottom: 1rem;
}

.page-header h1 {
  margin: 0;
  font-size: clamp(1.55rem, 2.6vw, 2rem);
}

.page-header p {
  margin: 0.45rem 0 0;
  color: #64748b;
  font-size: 0.95rem;
}

.state-card,
.today-card,
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

.today-card {
  border-color: #fed7aa;
  background: linear-gradient(180deg, #fff7ed 0%, #ffffff 60%);
}

.today-card h2,
.list-card h2 {
  margin: 0 0 0.75rem;
  font-size: 1.05rem;
  color: #0f172a;
}

.meal-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 0.7rem;
}

.meal-btn {
  min-height: 42px;
  padding: 0.4rem 0.8rem;
  border: 1px solid #fdba74;
  border-radius: 10px;
  background: #ffffff;
  color: #9a3412;
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
}

.meal-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.list-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  margin-bottom: 0.75rem;
}

.list-head h2 {
  margin: 0;
}

.search-input {
  box-sizing: border-box;
  flex: 1 1 12rem;
  min-width: 0;
  min-height: 44px;
  padding: 0.4rem 0.6rem;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #ffffff;
  color: #1f2937;
  /* iOS 在字級小於 16px 時會自動放大整頁 */
  font-size: max(0.92rem, 16px);
}

.search-input:focus {
  outline: none;
  border-color: #c2410c;
  box-shadow: 0 0 0 3px rgba(194, 65, 12, 0.12);
}

.recipe-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.card-actions {
  margin-top: 0.85rem;
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

.action-btn:hover {
  background: #9a3412;
}

.action-btn-outline {
  background: #ffffff;
  color: #c2410c;
}

.action-btn-outline:hover {
  background: #fff7ed;
}

.backup-hint {
  margin: 0 0 0.3rem;
  font-size: 0.92rem;
  font-weight: 600;
  color: #475569;
}

.backup-warn {
  color: #b45309;
}

.empty-hint {
  margin: 0;
  color: #94a3b8;
  font-size: 0.88rem;
  line-height: 1.55;
}

.flash {
  margin: 0.85rem 0 0;
  padding: 0.65rem 0.8rem;
  border-radius: 10px;
  font-size: 0.9rem;
  font-weight: 600;
}

.flash-ok {
  background: #fff7ed;
  border: 1px solid #fed7aa;
  color: #9a3412;
}

.flash-error {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #7f1d1d;
}

.hidden-input {
  display: none;
}

@media (max-width: 640px) {
  .card-actions .action-btn {
    flex: 1 1 100%;
  }
}
</style>
