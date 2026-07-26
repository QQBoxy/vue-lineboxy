<script setup lang="ts">
import type { Issue } from '@/services/workout/parsePlan';

interface Props {
  errors: Issue[];
  warnings: Issue[];
}

const props = defineProps<Props>();
</script>

<template>
  <div class="validation-report">
    <div v-if="props.errors.length > 0" class="issue-block issue-block-error">
      <h3>❌ 錯誤（{{ props.errors.length }}）— 需修正後才能匯入</h3>
      <ul>
        <li v-for="(issue, index) in props.errors" :key="`error-${index}`">
          <code>{{ issue.path }}</code>
          <span>{{ issue.message }}</span>
        </li>
      </ul>
    </div>

    <div v-if="props.warnings.length > 0" class="issue-block issue-block-warning">
      <h3>⚠️ 警告（{{ props.warnings.length }}）— 不影響匯入，請確認是否符合預期</h3>
      <ul>
        <li v-for="(issue, index) in props.warnings" :key="`warning-${index}`">
          <code>{{ issue.path }}</code>
          <span>{{ issue.message }}</span>
        </li>
      </ul>
    </div>

    <p v-if="props.errors.length === 0 && props.warnings.length === 0" class="all-clear">
      ✅ 驗證通過，沒有錯誤或警告。
    </p>
  </div>
</template>

<style scoped>
.validation-report {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.issue-block {
  border-radius: 12px;
  padding: 0.8rem 0.9rem;
  border: 1px solid;
}

.issue-block h3 {
  margin: 0 0 0.55rem;
  font-size: 0.95rem;
}

.issue-block ul {
  margin: 0;
  padding-left: 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.issue-block li {
  font-size: 0.9rem;
  line-height: 1.5;
}

.issue-block code {
  display: block;
  font-size: 0.78rem;
  color: #475569;
  word-break: break-all;
}

.issue-block-error {
  background: #fef2f2;
  border-color: #fecaca;
  color: #7f1d1d;
}

.issue-block-warning {
  background: #fffbeb;
  border-color: #fde68a;
  color: #78350f;
}

.all-clear {
  margin: 0;
  padding: 0.8rem 0.9rem;
  border-radius: 12px;
  background: #f0fdfa;
  border: 1px solid #99f6e4;
  color: #115e59;
  font-weight: 600;
  font-size: 0.92rem;
}
</style>
