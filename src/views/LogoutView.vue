<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();

const isSuccessful = computed(() => route.query.code === 'SUCCESSFUL');
</script>

<template>
  <main class="logout-page">
    <header class="page-header">
      <h1>Logout</h1>
    </header>

    <section class="status-card">
      <p :class="['status-text', isSuccessful ? 'is-success' : 'is-muted']">
        {{ isSuccessful ? 'Logout successful.' : 'Already logout.' }}
      </p>
    </section>
  </main>
</template>

<style scoped>
.logout-page {
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

.status-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 1.1rem 0.95rem;
  box-shadow: 0 6px 22px -16px rgba(15, 23, 42, 0.38);
}

.status-text {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
}

.is-success {
  color: #0f766e;
}

.is-muted {
  color: #64748b;
}

@media (min-width: 960px) {
  .logout-page {
    padding-top: 1.2rem;
  }
}
</style>
