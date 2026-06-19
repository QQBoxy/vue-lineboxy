<script setup lang="ts">
import { ref } from 'vue';

interface Props {
  cols: Record<string, string>;
  data?: Record<string, any>;
}

const visible = ref(false);
const props = defineProps<Props>();
const result = ref<Record<string, string>>({});
const emit = defineEmits(['submit']);

const openModal = () => {
  const next: Record<string, string> = {};
  Object.keys(props.cols).forEach((key) => {
    const value = props.data?.[key];
    next[key] = value === undefined || value === null ? '' : String(value);
  });
  result.value = next;
  visible.value = true;
};

const closeModal = () => {
  visible.value = false;
};

const handleSubmit = () => {
  emit('submit', {
    ...props.data,
    ...result.value,
  });
  result.value = {};
  closeModal();
};

</script>

<template>
  <button class="modal-trigger-btn" type="button" @click.stop="openModal">
    <slot></slot>
  </button>
  <teleport to="body">
    <div v-if="visible" class="modal-overlay">
      <div class="modal-card">
        <div v-for="(col, index) in Object.keys(props.cols)" :key="index" class="field-row">
          <label class="field-label" :for="`modal-input-${index}`">{{ props.cols[col] }}</label>
          <input :id="`modal-input-${index}`" v-model="result[col]" class="field-input" type="text" />
        </div>
        <div class="modal-actions">
          <button class="action-btn" type="button" @click.stop="handleSubmit">Submit</button>
          <button class="action-btn action-btn-outline" type="button" @click.stop="closeModal">Cancel</button>
        </div>
      </div>
    </div>
  </teleport>
</template>

<style scoped>
.modal-trigger-btn,
.action-btn {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 54px;
  min-width: 54px;
  padding: 0.65rem 0.75rem;
  border-radius: 12px;
  border: 1px solid #0f766e;
  background: #0f766e;
  color: #ffffff;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.01em;
  line-height: 1;
  touch-action: manipulation;
  cursor: pointer;
  transition: background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease;
}

.modal-trigger-btn:hover,
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
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.field-row {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.field-label {
  font-size: 0.92rem;
  font-weight: 700;
  color: #0f172a;
}

.field-input {
  min-height: 44px;
  border-radius: 10px;
  border: 1px solid #cbd5e1;
  padding: 0.55rem 0.65rem;
  color: #1f2937;
  font-size: 0.96rem;
  outline: none;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}

.field-input:focus {
  border-color: #0f766e;
  box-shadow: 0 0 0 3px rgba(15, 118, 110, 0.12);
}

.modal-actions {
  margin-top: 0.15rem;
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
}

@media (max-width: 640px) {
  .modal-actions {
    flex-direction: column;
  }

  .action-btn {
    width: 100%;
  }
}
</style>
