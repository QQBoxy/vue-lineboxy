<script setup lang="ts">
import { onMounted } from 'vue';
import { usePersonStore } from '../stores/person';
import axios from 'axios';

const personStore = usePersonStore();

onMounted(() => {
  axios({
    method: 'get',
    url: '/api/person',
  }).then((res) => {
    personStore.updatePerson(res.data);
  });
})

</script>

<template>
  <nav>
    <RouterLink to="/">Home</RouterLink> |
    <template v-if="personStore.person.isActive">
      <RouterLink to="/person">Person</RouterLink> |
      <RouterLink to="/kanban">Kanban</RouterLink> |
      <a href="/auth/logout">Logout</a>
    </template>
    <template v-else>
      <RouterLink to="/login">Login</RouterLink>
    </template>
  </nav>
  <RouterView />
</template>
