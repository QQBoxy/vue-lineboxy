<script setup lang="ts">
import axios from 'axios';
import { usePersonStore } from '../stores/person';

const personStore = usePersonStore();

const handleClick = async (topic: string, message: string) => {
  await axios({
    method: 'patch',
    url: `/api/iot/${encodeURIComponent(topic)}`,
    data: {
      message: message,
    }
  });
};

</script>

<template>
  <h1>Home</h1>
  <template v-if="personStore.person.isActive">
    <h2>🤖 掃地機器人</h2>
    <div>
      <button @click="handleClick('vacuum/power/inTopic', 'start')">開始清掃</button> |
      <button @click="handleClick('vacuum/power/inTopic', 'return_to_base')">開始回充</button>
    </div>
    <h2>🦆 鴨鴨電風扇</h2>
    <div>
      <button @click="handleClick('duckfan/power/inTopic', '1')">打開電扇</button> |
      <button @click="handleClick('duckfan/power/inTopic', '0')">關閉電扇</button>
    </div>
    <h2>🌙 小夜燈控制</h2>
    <div>
      <button @click="handleClick('lightboxy/switch/inTopic', '1')">打開小夜燈</button> |
      <button @click="handleClick('lightboxy/switch/inTopic', '0')">關閉小夜燈</button>
    </div>
    <div>
      <button @click="handleClick('lightboxy/brightness/inTopic', '0')">小夜燈最暗</button> |
      <button @click="handleClick('lightboxy/brightness/inTopic', '255')">小夜燈最亮</button>
    </div>
  </template>
</template>

<style scoped>
div {
  margin-top: 1rem;
}
</style>