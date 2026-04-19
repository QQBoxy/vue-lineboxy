<script setup lang="ts">
import axios from 'axios';
import { ref } from 'vue';
import { usePersonStore } from '../stores/person';

const personStore = usePersonStore();
const brightness = ref(0);

const handleClick = async (topic: string, message: string) => {
  await axios({
    method: 'patch',
    url: `/api/iot/${encodeURIComponent(topic)}`,
    data: {
      message,
    },
  });
};

const setBrightness = async (value: number) => {
  brightness.value = value;
  await handleClick('lightboxy/brightness/inTopic', String(brightness.value));
};

const handleBrightnessChange = async () => {
  await setBrightness(brightness.value);
};
</script>

<template>
  <main class="home-page">
    <header class="page-header">
      <h1>🏠 Home ✨</h1>
    </header>

    <template v-if="personStore.person.isActive">
      <section class="control-card">
        <h2>🤖 掃地機器人</h2>
        <div class="button-grid">
          <button class="action-btn" @click="handleClick('vacuum/power/inTopic', 'start')">
            開始清掃
          </button>
          <button
            class="action-btn action-btn-outline"
            @click="handleClick('vacuum/power/inTopic', 'return_to_base')"
          >
            回充電座
          </button>
        </div>
      </section>

      <section class="control-card">
        <h2>🦆 鴨鴨電風扇</h2>
        <div class="button-grid">
          <button class="action-btn" @click="handleClick('duckfan/power/inTopic', '1')">
            打開電扇
          </button>
          <button class="action-btn action-btn-outline" @click="handleClick('duckfan/power/inTopic', '0')">
            關閉電扇
          </button>
        </div>
      </section>

      <section class="control-card">
        <h2>🌙 小夜燈控制</h2>
        <div class="button-grid">
          <button class="action-btn" @click="handleClick('lightboxy/switch/inTopic', '1')">
            打開小夜燈
          </button>
          <button class="action-btn action-btn-outline" @click="handleClick('lightboxy/switch/inTopic', '0')">
            關閉小夜燈
          </button>
        </div>

        <div class="button-grid extra-space">
          <button class="action-btn" @click="setBrightness(0)">最暗</button>
          <button class="action-btn" @click="setBrightness(255)">最亮</button>
        </div>

        <div class="slider-row">
          <label for="night-light-brightness">亮度 ✨：{{ brightness }}</label>
          <input
            id="night-light-brightness"
            v-model.number="brightness"
            class="brightness-slider"
            type="range"
            min="0"
            max="255"
            @change="handleBrightnessChange"
          />
        </div>
      </section>
    </template>
  </main>
</template>

<style scoped>
.home-page {
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

.page-header p {
  margin: 0.45rem 0 0;
  color: #64748b;
  font-size: 0.95rem;
}

.control-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 0.95rem;
  margin-top: 0.85rem;
  box-shadow: 0 6px 22px -16px rgba(15, 23, 42, 0.38);
}

.control-card h2 {
  margin: 0;
  font-size: 1.02rem;
}

.button-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.7rem;
  margin-top: 0.75rem;
}

.action-btn {
  min-height: 54px;
  padding: 0.65rem 0.75rem;
  border-radius: 12px;
  border: 1px solid #0f766e;
  background: #0f766e;
  color: #ffffff;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.01em;
  touch-action: manipulation;
  cursor: pointer;
  transition: background-color 0.18s ease;
}

.action-btn-outline {
  background: #0f766e;
  color: #ffffff;
  border-color: #0f766e;
}

.action-btn:hover {
  background: #115e59;
}

.extra-space {
  margin-top: 0.65rem;
}

.slider-row {
  margin-top: 0.9rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.slider-row label {
  font-size: 0.95rem;
  font-weight: 600;
}

.brightness-slider {
  width: 100%;
  accent-color: #0f766e;
}

@media (min-width: 960px) {
  .home-page {
    padding-top: 1.2rem;
  }
}
</style>
