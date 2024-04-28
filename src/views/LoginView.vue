<script setup lang="ts">
</script>

<template>
  <h1>Login</h1>
  <template v-if="$route.query.code === 'SUCCESSFUL'">
    Login successful. <a href="/auth/logout">Logout</a>
  </template>
  <template v-else>
    <a href="/auth">Click to Login</a>
  </template>
</template>
