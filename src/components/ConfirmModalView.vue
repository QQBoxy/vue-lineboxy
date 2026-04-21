<script setup lang="ts">
import { ref } from 'vue';

interface Props {
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
}

const visible = ref(false);
const props = withDefaults(defineProps<Props>(), {
  title: 'Please Confirm',
  message: 'Are you sure you want to continue?',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
});
const emit = defineEmits(['confirmed']);

const handleConfirm = () => {
  emit('confirmed');
  visible.value = false;
};
</script>

<template>
  <button class="confirm-trigger-btn" type="button" @click.stop="visible = true">
    <slot>Delete</slot>
  </button>
  <teleport to="body">
    <div v-if="visible" class="modal-overlay">
      <div class="modal-card">
        <h3 class="modal-title">{{ props.title }}</h3>
        <p class="modal-message">{{ props.message }}</p>
        <div class="modal-actions">
          <button class="action-btn action-btn-outline" type="button" @click.stop="visible = false">
            {{ props.cancelText }}
          </button>
          <button class="action-btn action-btn-danger" type="button" @click.stop="handleConfirm">
            {{ props.confirmText }}
          </button>
        </div>
      </div>
    </div>
  </teleport>
</template>

<style scoped>
.confirm-trigger-btn,
.action-btn {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 54px;
  padding: 0.65rem 0.75rem;
  border-radius: 12px;
  border: 1px solid #dc2626;
  background: #dc2626;
  color: #ffffff;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.01em;
  line-height: 1;
  touch-action: manipulation;
  cursor: pointer;
  transition: background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease;
}

.confirm-trigger-btn:hover,
.action-btn:hover {
  background: #b91c1c;
  border-color: #b91c1c;
}

.action-btn-outline {
  border-color: #0f766e;
  background: #ffffff;
  color: #0f766e;
}

.action-btn-outline:hover {
  background: #ecfeff;
  border-color: #0f766e;
  color: #0f766e;
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

.modal-title {
  margin: 0;
  color: #0f172a;
  font-size: 1.15rem;
}

.modal-message {
  margin: 0;
  color: #475569;
  font-weight: 600;
  line-height: 1.45;
}

.modal-actions {
  margin-top: 0.2rem;
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
