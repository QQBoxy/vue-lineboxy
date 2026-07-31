# 彈窗捲動鎖定與 Esc 關閉

> 狀態：**已完成**（實作於 `e86eec5`，2026-07-30 人工驗收通過）
> 建立日期：2026-07-30
> 相關文件：[2026-07-28-workout-roadmap.md](../2026-07-28-workout-roadmap.md)

---

## 1. 問題

桌機測試 `ExerciseDetail` 彈窗時發現：捲動彈窗時，被彈窗遮蓋的底層頁面會跟著捲動。

拆開來看是兩個獨立的漏法：

| # | 情境 | 原因 |
|---|---|---|
| 1 | 彈窗內容捲到頂／底後繼續滾 | 捲動事件往外傳（scroll chaining），底層頁面接手 |
| 2 | 游標停在遮罩上滾 | `.modal-overlay` 本身不可捲，事件直接落到底層頁面 |

第 1 種純 CSS 可解，第 2 種一定要鎖 `body`。

順帶處理：三個彈窗目前都沒有 Esc 關閉。手機用不到，但桌機很不方便。

## 2. 影響範圍

專案有三個彈窗，都是 `teleport to="body"` + `v-if` + `.modal-overlay` 的結構，都沒鎖底層：

| 元件 | 開關方式 |
|---|---|
| `src/components/workout/ExerciseDetail.vue` | 父層傳 `item` prop，元件內 `v-if="props.item"` |
| `src/components/ModalView.vue` | 內部 `visible` ref + `openModal()` / `closeModal()` |
| `src/components/ConfirmModalView.vue` | 內部 `visible` ref，模板內直接 `visible = true/false` |

## 3. 設計決策

### 3.1 為什麼不用 renderless 元件

初版構想是做一個不渲染任何東西的 `<ScrollLock v-if="open" />`，靠掛載／卸載觸發鎖解。
這是社群既有模式，但模板裡出現一個看不出在做什麼的標籤，讀的人得跳檔案才知道用途——
為了避開 `watch` 而多繞一層抽象，繞道本身就是成本。**不採用。**

### 3.2 改成修根本原因：讓「掛載 = 可見」

`ExerciseDetail` 現在的生命週期和可見性是脫鉤的——元件一直掛載著，
靠內部 `v-if="props.item"` 決定畫不畫，所以 `onMounted` 幫不上忙。

把 `v-if` 移到呼叫端（只有兩處），掛載即等於彈窗開著，
`onMounted` 鎖、`onUnmounted` 解就是最直白的寫法，程式碼直接躺在元件裡，不用跳檔案。

附帶好處：

- `item` 型別從 `DisplayItem | null` 收緊成 `DisplayItem`，元件內的 `props.item?.` 問號可以拿掉
- `editingVideo` 隨卸載自然重置，`handleClose()` 裡的手動重置不再需要

`ModalView` / `ConfirmModalView` 是內部 `visible` + 對外方法的命令式寫法，`v-if` 無法外移。
但它們本來就有明確的開關函式，鎖解寫進去即可——正好是專案慣例的第二順位
「事件處理函式中明確呼叫」。兩者都要補 `onUnmounted` 當保險，
避免彈窗開著時切路由導致 `body` 永遠鎖住。

**全程不使用 `watch` / `watchEffect`。**

### 3.3 為什麼把 Esc 和捲動鎖放同一支工具

兩者的生命週期完全一致（彈窗開→註冊，關→取消），而且都需要處理巢狀：
兩個彈窗同時開時，Esc 只應關掉最上層那個，捲動鎖也只該在最後一個關閉時才解除。

用一個共用的堆疊同時管兩件事，比兩套各自維護計數器更好懂。
目前雖然不太可能有巢狀彈窗，但這個結構本來就要處理計數，順手做掉成本極低。

### 3.4 捲軸寬度補償

桌機鎖 `body` 時捲軸消失，畫面會橫向跳動。
用 `window.innerWidth - document.documentElement.clientWidth` 算出捲軸寬度，
補等寬的 `padding-right` 到 `body`。行動裝置是覆蓋式捲軸，算出來是 0，不受影響。

## 4. 實作項目

### 4.1 新增 `src/utils/modalStack.ts`

（`src/utils/` 目前不存在，一併建立）

普通模組，沒有 Vue 魔法。維護一個彈窗堆疊：

```
pushModal(entry)   進堆疊；若是第一個 → 鎖 body + 註冊 keydown 監聽
popModal(entry)    出堆疊；若清空   → 解鎖 body + 移除 keydown 監聽
```

- `entry` 形如 `{ onEscape?: () => void }`
- keydown 監聽只認 `Escape`，且**只呼叫堆疊最上層那筆**的 `onEscape`
- 鎖 body：存下原本的 `overflow` / `paddingRight`，設 `overflow: hidden` 與補償用的
  `padding-right`；解鎖時還原原值（不要寫死成空字串）
- `popModal` 用 `lastIndexOf` 找出自己再移除，不假設一定在頂端

### 4.2 `ExerciseDetail.vue`

- 移除內部的 `v-if="props.item"`，改由呼叫端控制掛載
- `Props.item` 型別 `DisplayItem | null` → `DisplayItem`，移除隨之多餘的 `?.`
- `onMounted` 呼叫 `pushModal({ onEscape })`，`onUnmounted` 呼叫 `popModal`
- **`onEscape` 的行為**：正在編輯影片連結（`editingVideo === true`）時，
  Esc 先取消編輯；否則才 `emit('close')`。避免打了一半的網址被一鍵清掉
- `handleClose()` 內的 `editingVideo = false` 可移除（卸載會重置）
- `.modal-card` 加 `overscroll-behavior: contain`（解問題 1）

### 4.3 `WorkoutImportView.vue` / `WorkoutPlanView.vue`

各加一個 `v-if`：

```
<ExerciseDetail v-if="selectedItem" :item="selectedItem" ... />
```

兩處的 `selectedItem` 都是 `computed(... ?? null)`，`v-if` 會讓 vue-tsc 正確收窄型別。

### 4.4 `ModalView.vue`

- `openModal()` 內呼叫 `pushModal({ onEscape: closeModal })`
- `closeModal()` 內呼叫 `popModal`
- 補 `onUnmounted`：若 `visible` 仍為 true 就 `popModal`
- `.modal-card` 加 `overscroll-behavior: contain`

Esc 等同按 Cancel（不送出）。

### 4.5 `ConfirmModalView.vue`

- 模板內的 `visible = true` / `visible = false` 抽成 `openModal()` / `closeModal()` 兩個函式，
  否則沒有地方掛鎖解。`handleConfirm()` 改呼叫 `closeModal()`
- 其餘同 4.4

Esc 等同按 Cancel（**不**觸發 `confirmed`）。

### 4.6 實作時與計畫的偏離

- `ModalView` / `ConfirmModalView` 的 `.modal-card` 沒有 `max-height` / `overflow-y`，
  本來就不會內部捲動，加 `overscroll-behavior: contain` 是死 CSS，**故未加**。
  這兩個彈窗靠 body 鎖即可
- `onUnmounted` 改成無條件呼叫 `popModal`，不先判斷 `visible`。
  `popModal` 找不到自己時直接 return，重複呼叫本來就安全，少一個條件比較好讀

## 5. 驗證

自動：

```
node node_modules/vue-tsc/bin/vue-tsc.js --build --force
node node_modules/eslint/bin/eslint.js . --ext .vue,.ts,.js --ignore-path .gitignore
node node_modules/vite/bin/vite.js build
```

人工（桌機 Chrome 為主）：

1. 開啟動作詳情，滾到底後繼續滾 → 底層不動
2. 游標移到遮罩上滾 → 底層不動
3. 開關彈窗時畫面不橫向跳動
4. Esc 關閉彈窗；點「新增連結」進入編輯後按 Esc → 只取消編輯，彈窗還在，再按一次才關
5. 關閉彈窗後頁面可正常捲動
6. 彈窗開著時按瀏覽器上一頁 → 頁面沒有卡住不能捲
7. `ModalView` / `ConfirmModalView` 同樣可用 Esc 取消，且不觸發送出／確認
8. 手機（Pixel + Chrome）確認彈窗內仍可正常捲動，且沒有多出右側空白

## 6. 不做的事

- 不引入 focus trap 與 `aria-modal`。無障礙有價值，但屬於另一個議題，
  混進來會讓這次改動難以驗收
- 不把三個彈窗合併成共用的 `BaseModal`。`ModalView` / `ConfirmModalView` 是
  舊有的命令式 API，重構會波及呼叫端，與本次目的無關
