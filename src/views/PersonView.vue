<script setup lang="ts">
import { ref, onMounted } from 'vue';
import axios from 'axios';

const avatar = ref('');
const name = ref('');

onMounted(async () => {
  try {
    const res = await axios({
      method: 'get',
      url: '/api/person',
    });
    avatar.value = res.data.picture;
    name.value = res.data.name;
  } catch (e) {
    console.log(e);
  }
});
</script>

<template>
  <main class="person-page">
    <header class="page-header">
      <h1>Person</h1>
    </header>

    <template v-if="name">
      <section class="profile-card">
        <img class="profile-avatar" :src="avatar" :alt="`${name} avatar`" />
        <h2 class="profile-name">{{ name }}</h2>
      </section>
    </template>

    <template v-else>
      <section class="profile-card">
        <p class="profile-empty">Please Login.</p>
      </section>
    </template>
  </main>
</template>

<style scoped>
.person-page {
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

.profile-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 1.1rem 0.95rem;
  box-shadow: 0 6px 22px -16px rgba(15, 23, 42, 0.38);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.8rem;
  text-align: center;
}

.profile-avatar {
  width: clamp(110px, 24vw, 150px);
  height: clamp(110px, 24vw, 150px);
  border-radius: 999px;
  object-fit: cover;
  border: 3px solid #0f766e;
  background: #f8fafc;
}

.profile-name {
  margin: 0;
  font-size: clamp(1.05rem, 2vw, 1.28rem);
  font-weight: 700;
  color: #0f172a;
}

.profile-empty {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #64748b;
}

@media (min-width: 960px) {
  .person-page {
    padding-top: 1.2rem;
  }
}
</style>
