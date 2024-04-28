<script setup lang="ts">
</script>

<template>
  <h1>Logout</h1>
  <template v-if="$route.query.code === 'SUCCESSFUL'">
    Logout successful.
  </template>
  <template v-else>
    Already logout.
  </template>
</template>
