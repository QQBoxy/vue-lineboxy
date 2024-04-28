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

const handleSubmit = () => {
  emit('submit', {
    ...props.data,
    ...result.value,
  });
  result.value = {};
  visible.value = false;
}

</script>

<template>
  <button @click="visible = true">
    <slot></slot>
  </button>
  <teleport to="body">
    <div v-if="visible" style="
      backdrop-filter: blur(5px);
      position: fixed;
      top: 0;
      bottom: 0;
      left: 0;
      right: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 9999;
    ">
      <div>
        <div v-for="(col, index) in Object.keys(props.cols)" :key="index">
          {{ props.cols[col] }}: <input type="text" v-model="result[col]" />
        </div>
        <button @click="handleSubmit">Submit</button> |
        <button @click="visible = false">Cancel</button>
      </div>
    </div>
  </teleport>
</template>
