<script setup lang="ts">
import { computed, ref } from 'vue';
import { suggestIngredients } from '@/services/cook/suggest';
import { unitOptionsFor, findUnit } from '@/services/cook/units';
import { SECTION_LABELS, masterKindOf } from '@/services/cook/types';
import type { Ingredient, RecipeIngredient } from '@/services/cook/types';

interface Props {
  modelValue: RecipeIngredient;
  /** 食材主檔，自動完成的來源。由父層載入一次後傳下來，不在此打 repository */
  ingredients: Ingredient[];
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: RecipeIngredient): void;
  (e: 'remove'): void;
}>();

/** 所在分區，元件存活期間不變（父層以 RecipeIngredient.id 當 key） */
const section = props.modelValue.kind;
/** 自動完成查的是主檔分類：醃料與調味料共用同一池 */
const kind = masterKindOf(section);
const unitOptions = unitOptionsFor(section);

const showSuggestions = ref(false);
/** 單位不在候選表中（自由輸入）時，一開始就要顯示文字輸入框而非下拉 */
const customUnit = ref(!!props.modelValue.unit && findUnit(props.modelValue.unit) === null);

const patch = (partial: Partial<RecipeIngredient>) => {
  emit('update:modelValue', { ...props.modelValue, ...partial });
};

const suggestions = computed(() =>
  suggestIngredients(props.ingredients, props.modelValue.nameSnapshot, kind),
);

const handleNameInput = (event: Event) => {
  const name = (event.target as HTMLInputElement).value;
  // 打字過程中名稱與主檔的對應可能失效，先清掉 id；
  // 存檔時 repository 會依名稱重新對應或建檔，不會漏掉
  patch({ nameSnapshot: name, ingredientId: '' });
  showSuggestions.value = true;
};

const selectSuggestion = (ingredient: Ingredient) => {
  patch({
    ingredientId: ingredient.id,
    nameSnapshot: ingredient.name,
    // 只在使用者還沒選單位時才套用預設，否則會蓋掉剛剛的輸入
    unit: props.modelValue.unit ?? ingredient.defaultUnit,
  });
  customUnit.value = !!ingredient.defaultUnit && findUnit(ingredient.defaultUnit) === null;
  showSuggestions.value = false;
};

const handleAmountInput = (event: Event) => {
  const raw = (event.target as HTMLInputElement).value.trim();
  // 空白 = 「適量」，不是 0
  patch({ amount: raw === '' ? undefined : Number(raw) });
};

const handleUnitSelect = (event: Event) => {
  const value = (event.target as HTMLSelectElement).value;
  if (value === '__custom__') {
    customUnit.value = true;
    patch({ unit: undefined });
    return;
  }
  patch({ unit: value === '' ? undefined : value });
};

const handleCustomUnitInput = (event: Event) => {
  const value = (event.target as HTMLInputElement).value.trim();
  patch({ unit: value === '' ? undefined : value });
};

const backToUnitList = () => {
  customUnit.value = false;
  patch({ unit: undefined });
};
</script>

<template>
  <div class="ingredient-row">
    <div class="name-field">
      <input
        class="text-input name-input"
        type="text"
        :value="props.modelValue.nameSnapshot"
        :placeholder="`${SECTION_LABELS[section]}名稱`"
        autocomplete="off"
        @input="handleNameInput"
        @focus="showSuggestions = true"
        @blur="showSuggestions = false"
      />
      <!-- mousedown.prevent：不讓輸入框失焦，否則清單會在 click 之前就消失 -->
      <ul v-if="showSuggestions && suggestions.length > 0" class="suggest-list">
        <li v-for="item in suggestions" :key="item.id">
          <button type="button" class="suggest-item" @mousedown.prevent="selectSuggestion(item)">
            <span class="suggest-name">{{ item.name }}</span>
            <span v-if="item.usageCount > 0" class="suggest-count">{{ item.usageCount }} 道</span>
          </button>
        </li>
      </ul>
    </div>

    <input
      class="text-input amount-input"
      type="number"
      inputmode="decimal"
      step="any"
      min="0"
      :value="props.modelValue.amount ?? ''"
      placeholder="適量"
      @input="handleAmountInput"
    />

    <template v-if="customUnit">
      <input
        class="text-input unit-input"
        type="text"
        :value="props.modelValue.unit ?? ''"
        placeholder="單位"
        autocomplete="off"
        @input="handleCustomUnitInput"
      />
      <button class="icon-btn" type="button" title="改用候選單位" @click="backToUnitList">▾</button>
    </template>
    <select
      v-else
      class="text-input unit-select"
      :value="props.modelValue.unit ?? ''"
      @change="handleUnitSelect"
    >
      <option value="">單位</option>
      <option v-for="unit in unitOptions" :key="unit.code" :value="unit.code">
        {{ unit.label }}
      </option>
      <option value="__custom__">其他…</option>
    </select>

    <button class="icon-btn icon-btn-danger" type="button" title="移除" @click="emit('remove')">
      ✕
    </button>
  </div>
</template>

<style scoped>
.ingredient-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: nowrap;
}

.name-field {
  position: relative;
  flex: 1 1 auto;
  /* flex item 預設 min-width:auto，不歸零的話輸入框會撐破整列 */
  min-width: 0;
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
  font-size: 0.95rem;
  /* iOS 在字級小於 16px 時會自動放大整頁 */
  font-size: max(0.95rem, 16px);
}

.text-input:focus {
  outline: none;
  border-color: #c2410c;
  box-shadow: 0 0 0 3px rgba(194, 65, 12, 0.12);
}

.amount-input {
  flex: 0 0 4.5rem;
  width: 4.5rem;
  text-align: right;
}

.unit-select,
.unit-input {
  flex: 0 0 5.5rem;
  width: 5.5rem;
}

.suggest-list {
  position: absolute;
  z-index: 20;
  left: 0;
  right: 0;
  top: calc(100% + 0.2rem);
  margin: 0;
  padding: 0.25rem;
  list-style: none;
  background: #ffffff;
  border: 1px solid #fed7aa;
  border-radius: 10px;
  box-shadow: 0 12px 26px -18px rgba(15, 23, 42, 0.55);
  max-height: 15rem;
  overflow-y: auto;
}

.suggest-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  width: 100%;
  min-height: 42px;
  padding: 0.4rem 0.55rem;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #1f2937;
  font-size: 0.92rem;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}

.suggest-item:hover {
  background: #fff7ed;
}

.suggest-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.suggest-count {
  flex: 0 0 auto;
  color: #9a3412;
  font-size: 0.75rem;
  font-weight: 700;
}

.icon-btn {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 46px;
  min-height: 46px;
  padding: 0;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
  color: #475569;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1;
  touch-action: manipulation;
  cursor: pointer;
  transition:
    background-color 0.18s ease,
    border-color 0.18s ease;
}

.icon-btn:hover {
  background: #fff7ed;
  border-color: #fdba74;
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

@media (max-width: 480px) {
  .amount-input {
    flex: 0 0 3.6rem;
    width: 3.6rem;
  }

  .unit-select,
  .unit-input {
    flex: 0 0 4.6rem;
    width: 4.6rem;
  }

  .icon-btn {
    min-width: 40px;
  }
}
</style>
