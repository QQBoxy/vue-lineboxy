<script setup lang="ts">
import { computed } from 'vue';
import { MEAL_SHORT_LABELS, MEAL_SLOTS, type Recipe } from '@/services/cook/types';

interface Props {
  recipe: Recipe;
}

const props = defineProps<Props>();

/** 依固定的時段順序顯示，而非 mealTags 的累積順序，否則同一道菜每次看到的排列都不同 */
const mealText = computed(() =>
  MEAL_SLOTS.filter((slot) => props.recipe.mealTags.includes(slot))
    .map((slot) => MEAL_SHORT_LABELS[slot])
    .join(''),
);

const countText = computed(() =>
  props.recipe.cookCount > 0 ? `煮過 ${props.recipe.cookCount} 次` : '還沒煮過',
);
</script>

<template>
  <RouterLink class="recipe-row" :to="`/cook/recipe/${props.recipe.id}`">
    <span class="recipe-main">
      <span class="recipe-name">{{ props.recipe.name }}</span>
      <span class="recipe-meta">
        <span v-if="mealText" class="meal-tag">{{ mealText }}</span>
        {{ countText }}
        <span v-if="props.recipe.lastCookedAt"> · 上次 {{ props.recipe.lastCookedAt.slice(5) }}</span>
      </span>
    </span>
    <span class="chevron">›</span>
  </RouterLink>
</template>

<style scoped>
.recipe-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  min-height: 52px;
  padding: 0.55rem 0.7rem;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
  color: #1f2937;
  text-decoration: none;
  transition: background-color 0.18s ease, border-color 0.18s ease;
}

.recipe-row:hover {
  background: #fff7ed;
  border-color: #fdba74;
}

.recipe-main {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
}

.recipe-name {
  font-weight: 700;
  font-size: 0.95rem;
}

.recipe-meta {
  font-size: 0.82rem;
  color: #64748b;
}

.meal-tag {
  margin-right: 0.35rem;
  padding: 0.05rem 0.35rem;
  border-radius: 6px;
  background: #ffedd5;
  color: #9a3412;
  font-size: 0.75rem;
  font-weight: 700;
}

.chevron {
  color: #94a3b8;
  font-size: 1.2rem;
  line-height: 1;
}
</style>
