# 導覽列改為橫向捲動列

> 狀態：待確認
> 建立日期：2026-07-27
> 範圍：只改 `src/views/IndexView.vue`（CSS + 少量 script）
> 目標：手機上導覽列維持單行、可左右滑動，不再換成兩行

---

## 1. 問題與根因

新增 Workout 頁籤後，登入狀態下共有 5 個連結（Home / Person / Kanban / Total / Workout），
在手機寬度會換成兩行。

根因是兩段設定的組合：

| 位置 | 設定 | 影響 |
|---|---|---|
| `IndexView.vue:82-86` | `.nav-links { flex-wrap: wrap }` | 允許換行 |
| `IndexView.vue:136-139` | 手機 `.nav-link { flex: 1 1 auto }` | 每顆按鈕都想平分寬度，加速撐破單行 |

批次 B／C 若再加日曆或統計頁籤會更嚴重，所以要改成不受數量影響的作法。

---

## 2. 作法概觀

```
不換行 + 橫向捲動  →  邊緣出血與淡出（讓人看得出可滑）  →  自動捲到目前頁籤
```

手機的觸控拖曳由 `overflow-x: auto` 原生提供，**不需要任何 JS**。
JS 只用在「自動把 active 頁籤捲進畫面」。

---

## 3. CSS 異動

### 3.1 `.nav-links`（基準樣式）

```css
.nav-links {
  display: flex;
  flex-wrap: nowrap;          /* 原本是 wrap */
  gap: 0.55rem;
  min-width: 0;               /* 關鍵，見 §6.1 */
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scroll-snap-type: x proximity;
  scrollbar-width: none;      /* Firefox */
  -ms-overflow-style: none;
}

.nav-links::-webkit-scrollbar {
  display: none;              /* Chrome / Safari：桌機不顯示橫向捲軸 */
}
```

`scroll-snap-type` 用 `proximity` 而非 `mandatory`：只在手指放開的位置接近某顆按鈕時才吸附，
避免小幅滑動被強制拉走、手感變黏。

### 3.2 `.nav-link`

新增三個屬性：

```css
.nav-link {
  /* …既有樣式不動… */
  flex: 0 0 auto;             /* 不被壓縮、不平分寬度 */
  white-space: nowrap;        /* 文字不折行 */
  scroll-snap-align: start;
}
```

### 3.3 手機 media query

```css
@media (max-width: 640px) {
  .app-nav {
    padding: 0.65rem;
  }

  .brand-link {
    width: 100%;
  }

  .nav-links {
    flex: 1 1 auto;           /* 原本是 width: 100% */
    width: auto;

    /* 滿版出血：抵銷 .app-nav 的 padding，
       讓按鈕從卡片邊緣進出，而不是停在內縮處 */
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

  /* 移除原本的 .nav-link { flex: 1 1 auto; text-align: center } */
}
```

`text-align: center` 可一併移除 —— `.nav-link` 本身是 `inline-flex` 且已有
`justify-content: center`，該宣告沒有作用。

---

## 4. Script 異動：自動捲到目前頁籤

沒有這段的話，你人在最右邊的 Workout，但一進站捲動列停在最左，畫面上看不出自己在哪。

```ts
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const router = useRouter();
const navLinks = ref<HTMLElement | null>(null);

const scrollActiveIntoView = (behavior: ScrollBehavior = 'smooth') => {
  const active = navLinks.value?.querySelector('.nav-link-active');
  // block: 'nearest' 必要，否則會連帶把整頁往上捲
  active?.scrollIntoView({ inline: 'center', block: 'nearest', behavior });
};

onMounted(() => {
  // …既有的 /api/person 請求不動…
  scrollActiveIntoView('auto');   // 首次載入不用動畫
});

// 事件訂閱而非 watch：換頁後把新的 active 捲進畫面
const stopAfterEach = router.afterEach(() => {
  nextTick(() => scrollActiveIntoView());
});

onBeforeUnmount(stopAfterEach);
```

樣板上 `.nav-links` 加 `ref="navLinks"`。

**為什麼用 `router.afterEach` 而不是 `watch(() => route.path, …)`**：
`afterEach` 是路由的事件訂閱，資料流是明確的「換頁 → 捲動」，
符合本專案「非必要不使用 watch」的慣例。`afterEach` 回傳解除訂閱的函式，
在 `onBeforeUnmount` 呼叫即可（`IndexView` 實務上不會卸載，但寫了才正確）。

`nextTick` 是必要的：`afterEach` 觸發時 `route.path` 已更新，
但 `.nav-link-active` 的 class 尚未套用到 DOM。

---

## 5. 不做的事

| 項目 | 原因 |
|---|---|
| 桌機滑鼠拖曳捲動 | 桌機有滾輪與觸控板橫向滑動；另寫 pointer 事件約 30 行，還要處理「拖曳後不該觸發導航」的判定，效益不划算 |
| 底部固定 tab bar | 改動大得多（安全區域、各頁底部留白、桌機要切回頂部）。若日後頁籤成長到 7–8 個再評估，本次的 CSS 不會白做 |
| 捲動位置隨捲動淡出的動態遮罩 | 見 §7 選配 |

---

## 6. 已知陷阱（實作時必須注意）

### 6.1 `min-width: 0` 是必要的，不是可有可無

flex item 的 `min-width` 預設是 `auto`，代表**不會縮到比內容還窄**。
少了 `min-width: 0`，`.nav-links` 會撐到內容的完整寬度，
`overflow-x: auto` 永遠不會生效，整條導覽列反而會撐破卡片。
這是這次改動最容易踩到的一點。

### 6.2 `overscroll-behavior-x: contain`

Chrome on Android 在橫向捲動到底時會把手勢往外傳，可能觸發返回手勢或整頁橫移。
加上 `contain` 可阻斷。

### 6.3 `scrollIntoView` 要帶 `block: 'nearest'`

只給 `inline: 'center'` 的話，瀏覽器會同時做垂直對齊，導致整頁莫名往上捲。

### 6.4 `overflow-x: auto` 會讓 `overflow-y` 計算值變成 `auto`

按鈕的 hover 與 focus 外框可能被裁切。實作後若看到 focus ring 被切，
在 `.nav-links` 補 `padding-block: 2px` 並以等量負 margin 抵銷。

### 6.5 登入後頁籤從 1 個變 5 個

這是 DOM 變化不是路由變化，`afterEach` 不會觸發。
但當下人在 Home、active 是第一顆、本來就在畫面內，所以沒有影響，不另外處理。

---

## 7. 選配（本次不做，列出備查）

Chrome 115+ 支援 scroll-driven animations，可讓左右淡出遮罩**依實際捲動位置**出現：
捲到最左時左側不淡出、捲到最右時右側不淡出。作法是 `animation-timeline: scroll(self inline)`
搭配動畫 `mask-image`。你主要用 Pixel 10 + Chrome，技術上可行，
但會增加一段不易一眼看懂的 CSS，先不納入。

---

## 8. 驗收

| # | 情境 | 預期 |
|---|---|---|
| 1 | Pixel 10 直式（約 412px），已登入 | 5 個頁籤單行、可左右滑、不換行 |
| 2 | 進站時停在 `/workout` | Workout 自動置中於畫面內 |
| 3 | 點 Home 再點 Workout | 每次換頁後 active 平滑捲進畫面 |
| 4 | 滑到最右後繼續滑 | 不觸發返回手勢、頁面不橫移 |
| 5 | 未登入 | 只有 Home + Login，不出現捲動、外觀與現在一致 |
| 6 | 桌機寬螢幕 | 全部塞得下、不出現捲軸、外觀與現在一致 |
| 7 | 暫時加到 7 個頁籤試 | 仍單行可捲，卡片不被撐破 |
| 8 | `pnpm lint` / `pnpm build` | 通過 |

驗收 7 只是暫時改樣板測試，測完還原。

---

## 9. 工作量

單一檔案、CSS 約 25 行、script 約 15 行。改動小，一次到位即可驗收。

---

## 10. 實作結果（2026-07-27）

完全依計畫實作，只動 `src/views/IndexView.vue`，沒有偏離：

- script：`navLinks` ref、`scrollActiveIntoView()`、`onMounted` 首次捲動（`behavior: 'auto'`）、
  `router.afterEach` + `nextTick` 換頁捲動、`onBeforeUnmount` 解除訂閱
- 樣板：`.nav-links` 加上 `ref="navLinks"`
- CSS：`.nav-links` 改 `nowrap` 並加 `min-width: 0` / `overflow-x: auto` /
  `overscroll-behavior-x: contain` / `scroll-snap-type` / 隱藏捲軸；
  `.nav-link` 加 `flex: 0 0 auto` / `white-space: nowrap` / `scroll-snap-align`；
  手機 media query 改為出血 + 淡出遮罩，並移除原本的 `flex: 1 1 auto` 與無作用的 `text-align: center`

§6 的五個陷阱全部依計畫處理（`min-width: 0`、`overscroll-behavior-x`、
`block: 'nearest'`、登入後不另處理）；§6.4 的 focus ring 裁切在實機確認前不預先加 padding。

### 驗收狀態

| # | 項目 | 狀態 |
|---|---|---|
| 8 | `vue-tsc` / ESLint / production build | 通過 |
| 1–7 | 實機外觀與捲動行為 | **待人工確認** |

驗收 1–7 需要登入狀態才會出現 5 個頁籤，而登入依賴後端 `/api/person`，
因此無法在此自動驗證，需實際開 app 確認。
