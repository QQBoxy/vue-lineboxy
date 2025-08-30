<script setup lang="ts">
import { ref, onMounted } from 'vue';
import axios from 'axios';

const handleClick = async (topic: string, message: string) => {
  await axios({
    method: 'patch',
    url: `/api/iot/${encodeURIComponent(topic)}`,
    data: {
      message: message,
    }
  });
};

onMounted(async () => {
  try {
    // ...
  } catch (e) {
    console.log(e);
  }
})
</script>

<template>
  <h1>IoT</h1>
  🤖 掃地機器人<br />
  <button @click="handleClick('vacuum/power/inTopic', 'start')">開始清掃</button> |
  <button @click="handleClick('vacuum/power/inTopic', 'return_to_base')">開始回充</button><br />
  🦆 鴨鴨電風扇<br />
  <button @click="handleClick('duckfan/power/inTopic', '1')">打開電扇</button> |
  <button @click="handleClick('duckfan/power/inTopic', '0')">關閉電扇</button><br />
  🌙 小夜燈控制<br />
  <button @click="handleClick('lightboxy/switch/inTopic', '1')">打開小夜燈</button> |
  <button @click="handleClick('lightboxy/switch/inTopic', '0')">關閉小夜燈</button><br />
  <button @click="handleClick('lightboxy/brightness/inTopic', '0')">小夜燈最暗</button> |
  <button @click="handleClick('lightboxy/brightness/inTopic', '255')">小夜燈最亮</button>
</template>
