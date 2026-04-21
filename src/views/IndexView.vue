<script setup lang="ts">
import axios from 'axios';
import { onMounted } from 'vue';
import { usePersonStore } from '../stores/person';

const personStore = usePersonStore();

onMounted(() => {
  axios({
    method: 'get',
    url: '/api/person',
  }).then((res) => {
    personStore.updatePerson(res.data);
  });
});
</script>

<template>
  <header class="app-nav-shell">
    <nav class="app-nav">
      <RouterLink class="brand-link" to="/">🏠 LineBoxy</RouterLink>
      <div class="nav-links">
        <RouterLink class="nav-link" to="/">Home</RouterLink>
        <template v-if="personStore.person.isActive">
          <RouterLink class="nav-link" to="/person">Person</RouterLink>
          <RouterLink class="nav-link" to="/kanban">Kanban</RouterLink>
          <a class="nav-link nav-link-logout" href="/auth/logout">Logout</a>
        </template>
        <template v-else>
          <RouterLink class="nav-link nav-link-login" to="/login">Login</RouterLink>
        </template>
      </div>
    </nav>
  </header>
  <RouterView />
</template>

<style scoped>
.app-nav-shell {
  max-width: 860px;
  margin: 0.9rem auto 0;
  padding: 0 0.9rem;
}

.app-nav {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 0.7rem;
  box-shadow: 0 6px 22px -16px rgba(15, 23, 42, 0.38);
}

.brand-link {
  color: #0f172a;
  font-size: clamp(1.55rem, 2.6vw, 2rem);
  font-weight: 700;
  line-height: 1.1;
  text-decoration: none;
  letter-spacing: 0.01em;
}

.nav-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
}

.nav-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: 0.45rem 0.8rem;
  border-radius: 10px;
  border: 1px solid #0f766e;
  background: #ffffff;
  color: #0f766e;
  text-decoration: none;
  font-size: 0.92rem;
  font-weight: 700;
  transition: background-color 0.18s ease, color 0.18s ease, border-color 0.18s ease;
}

.nav-link:hover {
  background: #ecfeff;
  border-color: #115e59;
  color: #115e59;
}

.nav-link.router-link-exact-active {
  background: #0f766e;
  border-color: #0f766e;
  color: #ffffff;
}

.nav-link-login {
  background: #0f766e;
  color: #ffffff;
}

.nav-link-logout {
  background: #f8fafc;
  border-color: #cbd5e1;
  color: #475569;
}

.nav-link-logout:hover {
  background: #f1f5f9;
  border-color: #94a3b8;
  color: #334155;
}

@media (max-width: 640px) {
  .app-nav {
    padding: 0.65rem;
  }

  .brand-link {
    width: 100%;
  }

  .nav-links {
    width: 100%;
  }

  .nav-link {
    flex: 1 1 auto;
    text-align: center;
  }
}
</style>
