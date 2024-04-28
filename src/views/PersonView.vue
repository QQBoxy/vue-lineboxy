<script setup lang="ts">
import { ref, onMounted } from 'vue';
import axios from 'axios';

const avatar = ref("");
const name = ref("");

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
})
</script>

<template>
  <h1>Person</h1>
  <template v-if="name">
    <img :src="avatar" /><br />
    {{ name }}
  </template>
  <template v-else>
    Please Login.
  </template>
</template>
