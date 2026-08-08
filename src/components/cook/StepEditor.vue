<script setup lang="ts">
import { nextTick, ref } from 'vue';
import ConfirmModalView from '@/components/ConfirmModalView.vue';

interface Props {
  steps: string[];
}

const props = defineProps<Props>();
const emit = defineEmits<{ (e: 'update:steps', value: string[]): void }>();

/**
 * 鎖定狀態是純 UI 狀態，只為防手滑，**不進 localStorage**：
 * 存進資料層會多一個欄位，而且舊資料的預設值無從決定。
 * 從既有食譜載入時全部預設為鎖定，避免誤刪已寫好的內容。
 */
const locked = ref<boolean[]>(props.steps.map(() => true));

const inputs = ref<HTMLTextAreaElement[]>([]);

const setInputRef = (el: unknown, index: number) => {
  if (el instanceof HTMLTextAreaElement) inputs.value[index] = el;
};

const handleInput = (index: number, event: Event) => {
  const next = [...props.steps];
  next[index] = (event.target as HTMLTextAreaElement).value;
  emit('update:steps', next);
};

const addStep = async () => {
  // 先記下新步驟的 index：emit 之後 props 要等父層重繪才會更新，當下讀到的仍是舊長度
  const index = props.steps.length;
  emit('update:steps', [...props.steps, '']);
  // 新增的那一格自動進入編輯中並取得 focus，少一次點擊
  locked.value = [...locked.value, false];
  await nextTick();
  inputs.value[index]?.focus();
};

const lockStep = (index: number) => {
  locked.value = locked.value.map((flag, i) => (i === index ? true : flag));
};

const unlockStep = async (index: number) => {
  locked.value = locked.value.map((flag, i) => (i === index ? false : flag));
  await nextTick();
  inputs.value[index]?.focus();
};

const removeStep = (index: number) => {
  emit(
    'update:steps',
    props.steps.filter((_, i) => i !== index),
  );
  locked.value = locked.value.filter((_, i) => i !== index);
  inputs.value = [];
};
</script>

<template>
  <ol class="step-list">
    <li v-for="(step, index) in props.steps" :key="index" class="step-item">
      <span class="step-index">{{ index + 1 }}</span>

      <template v-if="locked[index]">
        <p class="step-text" :class="{ 'step-empty': step.trim() === '' }">
          {{ step.trim() === '' ? '（空白步驟）' : step }}
        </p>
        <div class="step-actions">
          <button class="ghost-btn" type="button" @click="unlockStep(index)">編輯</button>
          <ConfirmModalView
            title="刪除步驟"
            :message="`確定要刪除第 ${index + 1} 個步驟嗎？`"
            confirm-text="刪除"
            cancel-text="取消"
            @confirmed="removeStep(index)"
          >
            ✕
          </ConfirmModalView>
        </div>
      </template>

      <template v-else>
        <textarea
          :ref="(el) => setInputRef(el, index)"
          class="step-input"
          rows="2"
          :value="step"
          placeholder="這一步要做什麼？"
          @input="handleInput(index, $event)"
        ></textarea>
        <div class="step-actions">
          <button class="ghost-btn ghost-btn-done" type="button" @click="lockStep(index)">
            ✓ 完成
          </button>
        </div>
      </template>
    </li>
  </ol>

  <button class="add-btn" type="button" @click="addStep">＋ 新增步驟</button>
</template>

<style scoped>
.step-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.step-item {
  display: grid;
  grid-template-columns: 1.6rem 1fr auto;
  align-items: start;
  gap: 0.5rem;
  padding: 0.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
}

.step-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.6rem;
  height: 1.6rem;
  margin-top: 0.35rem;
  border-radius: 50%;
  background: #c2410c;
  color: #ffffff;
  font-size: 0.8rem;
  font-weight: 700;
}

.step-text {
  margin: 0;
  padding: 0.5rem 0.1rem;
  min-width: 0;
  color: #1f2937;
  font-size: 0.95rem;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}

.step-empty {
  color: #94a3b8;
}

.step-input {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  padding: 0.45rem 0.6rem;
  border: 1px solid #fdba74;
  border-radius: 10px;
  background: #ffffff;
  color: #1f2937;
  font-family: inherit;
  font-size: max(0.95rem, 16px);
  line-height: 1.5;
  resize: vertical;
}

.step-input:focus {
  outline: none;
  border-color: #c2410c;
  box-shadow: 0 0 0 3px rgba(194, 65, 12, 0.12);
}

.step-actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.ghost-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0.4rem 0.7rem;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #ffffff;
  color: #475569;
  font-size: 0.88rem;
  font-weight: 700;
  white-space: nowrap;
  touch-action: manipulation;
  cursor: pointer;
  transition:
    background-color 0.18s ease,
    border-color 0.18s ease;
}

.ghost-btn:hover {
  background: #fff7ed;
  border-color: #fdba74;
  color: #9a3412;
}

.ghost-btn-done {
  border-color: #c2410c;
  background: #c2410c;
  color: #ffffff;
}

.ghost-btn-done:hover {
  background: #9a3412;
  border-color: #9a3412;
  color: #ffffff;
}

/* ConfirmModalView 自帶的觸發鈕高度 54px，與這裡的 44px 對齊 */
.step-actions :deep(.confirm-trigger-btn) {
  height: 44px;
  min-width: 44px;
  font-size: 1rem;
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
  transition:
    background-color 0.18s ease,
    border-color 0.18s ease;
}

.add-btn:hover {
  background: #ffedd5;
  border-color: #c2410c;
}

@media (max-width: 480px) {
  .step-item {
    grid-template-columns: 1.6rem 1fr;
  }

  .step-actions {
    grid-column: 1 / -1;
    justify-content: flex-end;
  }
}
</style>
