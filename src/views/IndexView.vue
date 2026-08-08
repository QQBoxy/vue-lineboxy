<script setup lang="ts">
import axios from 'axios';
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { usePersonStore } from '../stores/person';

const personStore = usePersonStore();
const route = useRoute();
const router = useRouter();
const navLinks = ref<HTMLElement | null>(null);

/** 導覽列在手機上可橫向捲動，換頁後把目前頁籤捲進畫面，否則看不出自己在哪 */
const scrollActiveIntoView = (behavior: ScrollBehavior = 'smooth') => {
  const active = navLinks.value?.querySelector('.nav-link-active');
  // block: 'nearest' 必要，否則瀏覽器會連帶把整頁往上捲
  active?.scrollIntoView({ inline: 'center', block: 'nearest', behavior });
};

onMounted(() => {
  axios({
    method: 'get',
    url: '/api/person',
  }).then((res) => {
    personStore.updatePerson(res.data);
    // 登入後頁籤才從 1 個變成多個，此時 active 可能在畫面外。
    // 這不是路由變化，afterEach 不會觸發，需在這裡補捲一次
    nextTick(() => scrollActiveIntoView('auto'));
  });

  scrollActiveIntoView('auto');
});

// 事件訂閱而非 watch：afterEach 觸發時 class 尚未套用，故等 nextTick
const stopAfterEach = router.afterEach(() => {
  nextTick(() => scrollActiveIntoView());
});

onBeforeUnmount(stopAfterEach);
</script>

<template>
  <header class="app-nav-shell">
    <nav class="app-nav">
      <RouterLink class="brand-link" to="/">🏠 LineBoxy</RouterLink>
      <div ref="navLinks" class="nav-links">
        <RouterLink class="nav-link" :class="{ 'nav-link-active': route.path === '/' }" to="/">
          Home
        </RouterLink>
        <template v-if="personStore.person.isActive">
          <RouterLink
            class="nav-link"
            :class="{ 'nav-link-active': route.path === '/person' }"
            to="/person"
          >
            Person
          </RouterLink>
          <RouterLink
            class="nav-link"
            :class="{ 'nav-link-active': route.path.startsWith('/kanban') }"
            to="/kanban"
          >
            Kanban
          </RouterLink>
          <RouterLink
            class="nav-link"
            :class="{ 'nav-link-active': route.path === '/total' }"
            to="/total"
          >
            Total
          </RouterLink>
          <RouterLink
            class="nav-link"
            :class="{ 'nav-link-active': route.path.startsWith('/workout') }"
            to="/workout"
          >
            Workout
          </RouterLink>
          <RouterLink
            class="nav-link nav-link-cook"
            :class="{ 'nav-link-active': route.path.startsWith('/cook') }"
            to="/cook"
          >
            獺廚娘
          </RouterLink>
        </template>
        <template v-else>
          <RouterLink
            class="nav-link nav-link-login"
            :class="{ 'nav-link-active': route.path === '/login' }"
            to="/login"
          >
            Login
          </RouterLink>
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
  flex-wrap: nowrap;
  gap: 0.55rem;
  /* flex item 的 min-width 預設為 auto，不加這行就不會縮到比內容窄，
     overflow-x 永遠不會生效，整條導覽列反而會撐破卡片 */
  min-width: 0;
  overflow-x: auto;
  /* 捲到底時不要把手勢往外傳，避免觸發 Android 的返回手勢 */
  overscroll-behavior-x: contain;
  /* scroll-snap-type: x proximity; */
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.nav-links::-webkit-scrollbar {
  display: none;
}

.nav-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  white-space: nowrap;
  /* scroll-snap-align: start; */
  min-height: 40px;
  padding: 0.45rem 0.8rem;
  border-radius: 10px;
  border: 1px solid #0f766e;
  background: #ffffff;
  color: #0f766e;
  text-decoration: none;
  font-size: 0.92rem;
  font-weight: 700;
  transition:
    background-color 0.18s ease,
    color 0.18s ease,
    border-color 0.18s ease;
}

.nav-link:hover {
  background: #ecfeff;
  border-color: #115e59;
  color: #115e59;
}

.nav-link-active {
  background: #0f766e;
  border-color: #0f766e;
  color: #ffffff;
}

.nav-link-login {
  background: #0f766e;
  color: #ffffff;
}

/* 獺廚娘用暖色與 Workout 的藍綠色區隔，兩個頁籤一眼可辨 */
.nav-link-cook {
  border-color: #c2410c;
  color: #c2410c;
}

.nav-link-cook:hover {
  background: #fff7ed;
  border-color: #9a3412;
  color: #9a3412;
}

.nav-link-cook.nav-link-active {
  background: #c2410c;
  border-color: #c2410c;
  color: #ffffff;
}

@media (max-width: 640px) {
  .app-nav {
    padding: 0.65rem;
  }

  .brand-link {
    width: 100%;
  }

  .nav-links {
    flex: 1 1 auto;
    width: auto;
    /* 滿版出血：抵銷 .app-nav 的 padding，讓按鈕從卡片邊緣進出而非停在內縮處 */
    margin: 0 -0.65rem;
    padding: 0 0.65rem;
    /* 兩側淡出，暗示內容還有延伸 */
    -webkit-mask-image: linear-gradient(
      to right,
      transparent 0,
      #000 0.65rem,
      #000 calc(100% - 0.65rem),
      transparent 100%
    );
    mask-image: linear-gradient(
      to right,
      transparent 0,
      #000 0.65rem,
      #000 calc(100% - 0.65rem),
      transparent 100%
    );
  }
}
</style>
