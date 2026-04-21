<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();

const isSuccessful = computed(() => route.query.code === 'SUCCESSFUL');
</script>

<template>
  <main class="login-page">
    <header class="page-header">
      <h1>Login</h1>
    </header>

    <section class="status-card">
      <template v-if="isSuccessful">
        <p class="status-text is-success">Login successful.</p>
        <a class="action-link action-link-outline" href="/auth/logout">Logout</a>
      </template>
      <template v-else>
        <p class="status-text is-muted">Please sign in to continue.</p>
        <a class="action-link" href="/auth">Click to Login</a>
      </template>
    </section>
  </main>
</template>

<style scoped>
.login-page {
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
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.8rem;
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

.action-link {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 54px;
  padding: 0.65rem 0.75rem;
  border-radius: 12px;
  border: 1px solid #0f766e;
  background: #0f766e;
  color: #ffffff;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0.01em;
  touch-action: manipulation;
  cursor: pointer;
  text-decoration: none;
  transition: background-color 0.18s ease;
}

.action-link:hover {
  background: #115e59;
}

.action-link-outline {
  background: #ffffff;
  color: #0f766e;
}

.action-link-outline:hover {
  background: #ecfeff;
}

@media (min-width: 960px) {
  .login-page {
    padding-top: 1.2rem;
  }
}
</style>
