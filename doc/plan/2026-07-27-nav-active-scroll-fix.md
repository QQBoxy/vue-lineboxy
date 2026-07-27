# 修正：登入後 active 頁籤未捲入畫面

> 狀態：待確認
> 建立日期：2026-07-27
> 範圍：只改 `src/views/IndexView.vue`（script 3 行）
> 前置：[2026-07-27-nav-horizontal-scroll.md](2026-07-27-nav-horizontal-scroll.md)

---

## 1. 問題

導覽列改成橫向捲動後，直接開在非首頁的路由時，目前所在的頁籤停在畫面外，
看不出自己在哪一頁。

## 2. 根因

前一份計畫的 §6.5 判斷錯誤。當時寫「登入後頁籤從 1 個變 5 個不必處理，
因為當下人在 Home、active 是第一顆」—— **這個前提不成立**，
使用者可以直接開在任何路由。

實際流程：

| 時序 | 狀態 | 捲動 |
|---|---|---|
| `onMounted` | `isActive` 為 false，只渲染 Home + Login，`.nav-link-active` 不存在 | 空轉 |
| `/api/person` 回應 | 5 個頁籤渲染出來，Workout 為 active 但在畫面外 | **無人觸發** |
| 之後 | 非路由變化，`router.afterEach` 不會觸發 | 不會補救 |

### 會踩到的情境

- PWA 從上次停留的頁面啟動
- 在 `/workout`、`/kanban`、`/total` 等頁面按重新整理
- 從外部連結或書籤直接進入某一頁
- 換頁後的第一次載入（等同重新整理）

不會踩到的只有「從 `/` 進站再點頁籤」這一條路徑，也就是我當初唯一考慮到的那條。

---

## 3. 方案

在既有的 `/api/person` 回應處理中補一次捲動：

```ts
onMounted(() => {
  axios({ method: 'get', url: '/api/person' }).then((res) => {
    personStore.updatePerson(res.data);
    // 登入後頁籤才從 1 個變成多個，此時 active 可能在畫面外。
    // 這不是路由變化，afterEach 不會觸發，需在這裡補捲一次
    nextTick(() => scrollActiveIntoView('auto'));
  });

  scrollActiveIntoView('auto');
});
```

- **事件驅動**：「API 回應抵達」本身就是事件，不需要 `watch`，符合專案慣例
- **`nextTick` 必要**：`updatePerson` 之後 DOM 尚未重繪，頁籤還沒出現
- **用 `'auto'` 而非 `'smooth'`**：導覽列剛出現就播平滑動畫看起來像跑版

### 被否決的作法

| 方案 | 否決原因 |
|---|---|
| `watch(() => personStore.person.isActive, …)` | 違反專案「非必要不用 watch」的慣例，且這裡有現成的事件可用 |
| 把登入後的頁籤區塊拆成子元件，靠 `v-if` 掛載 + `onMounted` 捲動 | 語意最乾淨，但為三行邏輯拆一個元件不划算 |

---

## 4. 一併決定的兩件事

### 4.1 `scroll-snap` 是否保留（需實機確認後決定）

現行 CSS 有 `scroll-snap-type: x proximity` 與 `scroll-snap-align: start`。
`scrollIntoView({ inline: 'center' })` 想置中，snap 想對齊起點，兩者目標不同。
`proximity` 較寬鬆通常不會硬拉，但實機可能出現「捲過去了卻靠左、沒有置中」。

**處理方式**：先實機看。若出現此現象，直接移除 snap 兩行 —— 這種小按鈕列本來就不需要吸附，
當初加它屬於過度設計。

### 4.2 `onMounted` 中原本那次 `scrollActiveIntoView('auto')`

改完之後它在目前架構下不會有任何作用（mount 當下一定尚未登入）。

**建議保留**：成本為零，且若日後加入 person 的本地快取（不必等 API 就知道已登入狀態），
它會立即成為必要的那一次呼叫。要移除也可以，屬於偏好問題。

---

## 5. 範圍外的觀察

`IndexView.vue` 的 `/api/person` 請求沒有 `.catch()`，後端未啟動時
主控台會出現 unhandled promise rejection。這是既有問題，非本次改動造成，
本次不處理；若要一併修，請另外告知。

---

## 6. 驗收

| # | 情境 | 預期 |
|---|---|---|
| 1 | 在 `/workout` 按重新整理 | Workout 頁籤自動置中於畫面內 |
| 2 | 直接開 `/workout/import` | Workout 頁籤置中（active 判定用 `startsWith`） |
| 3 | 直接開 `/kanban/:id` | Kanban 頁籤置中 |
| 4 | 未登入開 `/` | 不捲動、無主控台錯誤 |
| 5 | 登入後依序點各頁籤 | 每次換頁 active 平滑捲入畫面 |
| 6 | 檢查 §4.1 | 確認是置中而非靠左，決定 snap 去留 |
| 7 | `vue-tsc` / ESLint / build | 通過 |

---

## 7. 工作量

script 3 行。若 §4.1 決定移除 snap，再多 2 行 CSS 刪除。

---

## 8. 實作結果（2026-07-27）

依 §3 實作，`src/views/IndexView.vue` 的 `/api/person` 回應處理中補上
`nextTick(() => scrollActiveIntoView('auto'))`，其餘未動。

§4 的兩項決定：

- **4.1 `scroll-snap`**：保持現狀，待實機確認是否出現「靠左而非置中」再決定去留
- **4.2 `onMounted` 原本那次呼叫**：依建議保留

### 驗收狀態

| # | 項目 | 狀態 |
|---|---|---|
| 7 | `vue-tsc` / ESLint / production build | 通過 |
| 1–6 | 實機行為 | **待人工確認** |

驗收 1–3、5、6 需要登入狀態，而登入依賴後端 `/api/person`，無法在此自動驗證。
