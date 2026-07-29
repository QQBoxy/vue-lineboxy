# 運動計畫功能 — 現況與後續路線圖（交付文件）

> 狀態：進行中
> 建立日期：2026-07-28
> 最後更新：2026-07-30（批次 A 驗收完成、彈窗捲動鎖定與 Esc 關閉完成）
> 用途：**交付給新的 session 接手**。本文件力求自足，接手者不需要前面的對話脈絡。
> 前置文件：[done/2026-07-27-workout-feature-batch-a.md](done/2026-07-27-workout-feature-batch-a.md)（批次 A 的完整設計與驗證紀錄）
> 相關文件：[done/2026-07-30-modal-scroll-lock-esc.md](done/2026-07-30-modal-scroll-lock-esc.md)（彈窗捲動鎖定與 Esc 關閉）

---

## 0. 給接手者的工作慣例（請先讀）

| 慣例 | 內容 |
|---|---|
| 語言 | **一律使用正體中文**與使用者溝通 |
| 改動前先討論 | **未經同意不要動 code**。收到需求先提建議與釐清問題，使用者說「實作吧」再動手 |
| Vue 寫法 | **非必要不使用 `watch` / `watchEffect`**。優先序：`computed` → 事件處理函式中明確呼叫 → `v-if` 控制掛載搭配 `onMounted` → 真的需要副作用才用 `watch` |
| 計畫文件 | 放 `doc/plan/`，檔名 `YYYY-MM-DD-topic.md`。**完成並驗收後移到 `doc/plan/done/`**，同時把標頭的「狀態」改成已完成並註明對應 commit。`doc/plan/` 根目錄只留進行中的計畫 |
| commit | 主旨用英文、祈使句，沿用近期歷史風格（`feat:` / `fix:`）。**不要自動 push** |

`src/views/TotalView.vue` 是採用 `watch` 的舊寫法，**新程式碼不要沿用**。

---

## 1. 專案脈絡

- Vue 3 + Vite + TypeScript + Pinia + vue-router，PWA（`vite-plugin-pwa`）
- **後端在另一個 repo**，本地跑在 `localhost:3000`，透過 `/api`、`/auth` 代理
- 已串接 Google 登入，`usePersonStore()` 的 `person.isActive` 代表登入狀態
- 使用者主要以 **Pixel 10 + Chrome** 使用，手機體驗優先
- 運動計畫功能刻意採**純前端先行**：資料存 localStorage，資料層抽介面，日後換後端不必改畫面

---

## 2. 現況：已完成的部分

### 2.1 已提交的 commit

| commit | 內容 |
|---|---|
| `09cf6d9` | 運動計畫功能批次 A + 補登舊紀錄 |
| `162a8dd` | 導覽列改為單行橫向捲動 + active 頁籤自動捲入 |
| `e86eec5` | 彈窗捲動鎖定與 Esc 關閉（三個彈窗共用 `modalStack`） |

分支 `main`。remote 是 `QQBoxy/vue-lineboxy`，使用者的 GitHub 帳號 `NekoBoxy` 已取得
collaborator 權限，可直接 push 到 `main`。**但仍不要自動 push，等使用者明確指示。**

### 2.2 檔案結構

```
src/services/workout/
  types.ts             型別定義（唯一真相來源）
  repository.ts        WorkoutRepository 介面
  localRepository.ts   localStorage 實作 + newId()
  schedule.ts          日期工具、群組推導、應運動日配額、月統計（純函式）
  parsePlan.ts         匯入解析、驗證、草稿轉正式課表
  display.ts           畫面用中介型別與轉換
  backup.ts            匯出／還原、距上次備份天數

src/components/workout/
  WeekOverview.vue     七天攤平總覽（匯入預覽與課表檢視共用）
  StageList.vue        階段與動作清單
  ExerciseDetail.vue   動作詳情彈窗（含影片連結編輯）
  ValidationReport.vue 匯入驗證結果

src/views/
  WorkoutView.vue        主頁：今天卡片、最近 14 天、課表清單、備份
  WorkoutImportView.vue  匯入：貼上 → 驗證 → 七天預覽 → 動作庫比對 → 匯入
  WorkoutPlanView.vue    課表檢視、生效日調整
  WorkoutLogView.vue     簡易打卡（含補登過去日期）
```

路由：`/workout`、`/workout/import`、`/workout/log`、`/workout/plan/:id`

跨功能的共用工具：

```
src/utils/
  modalStack.ts        彈窗堆疊：鎖定底層捲動 + Esc 關閉（三個彈窗共用）
```

`ExerciseDetail.vue` 的 `v-if` 在**呼叫端**（`WorkoutImportView` / `WorkoutPlanView`），
不在元件內部——這樣「掛載 = 彈窗開著」，`onMounted` / `onUnmounted` 才能直接鎖解捲動。
新增彈窗時請沿用這個結構。

### 2.3 可用的參考資料

`doc/plan/2026-07-27-workout-sample-plan.json` 是使用者真實課表轉成的 JSON，
可直接貼進匯入頁，也是驗證 schema 的基準案例。

---

## 3. 核心設計決策（請勿在不理解理由的情況下推翻）

### 3.1 資料層一律 async

即使 localStorage 是同步的，`WorkoutRepository` 所有方法都回傳 Promise。
這樣日後新增 `apiRepository.ts` 換掉實作時，**畫面層一行都不用改**。

### 3.2 課表版本不可修改

課表一旦被打卡引用就 `locked: true`，`savePlan()` 會擋下修改，任何變更都要匯入新版本。
目的是讓歷史紀錄永遠對應到當時實際執行的內容。

**例外**：`updateEffectiveFrom()` 刻意繞過鎖定。生效日不是課表內容，
既有打卡以 `planId` 硬連結，調整生效日不會竄改任何歷史紀錄。
若不開放，使用者只要先打了今天的卡就再也無法往前調生效日補登舊紀錄。

### 3.3 適用課表由「生效日 + 打卡日期」推導

`getPlanForDate(date)` 取 `effectiveFrom <= date` 之中最晚生效的一份。
不是「匯入後的打卡才連新課表」—— 那樣補登過去日期會連到錯誤的課表。

### 3.4 群組的 `requirement: 'any-one'`

對應「週六**或**週日」這種擇一課表。判定規則：

- `'all'`：weekdays 中每一天各算一個應運動日配額
- `'any-one'`：以 ISO 週為單位，整組**每週只佔一個配額**，候選日任一天有紀錄即達成
- **跨月週歸屬**：週配額歸屬於「該週內第一個涵蓋日」所在月份，避免重複計算

### 3.5 動作定義以名稱跨版本共用

`ExerciseDef` 獨立於課表版本，同名共用一筆。這樣補一次影片連結處處生效，
且同一動作的進步趨勢不會被拆成多條線。

動作定義（步驟、影片、器材）視為**參考資料，允許修改**；
課表版本（哪天做什麼、幾組幾下）視為**歷史事實，不可修改**。兩者可變性不同是刻意的。

### 3.6 規格用結構化欄位

`measureType`（`reps` / `time` / `hold`）決定打卡 UI 的輸入型態，
搭配 `sets` / `reps{min,max}` / `durationSeconds` / `holdSeconds` / `perSide` / `resistance`，
另外保留 `specText` 原文供顯示。

**不要退回純文字**——結構化是「動作進步趨勢」這個長期價值最高功能的前提。

### 3.7 日期一律 `'YYYY-MM-DD'` 本地時區字串

不使用 `Date` 物件或 ISO 字串儲存。`schedule.ts` 提供 `toDateString` / `fromDateString` /
`todayString` / `addDays` / `isoWeekdayOf` / `startOfIsoWeek`。時區處理錯誤在日曆功能上是災難級的坑。

### 3.8 星期編號

ISO-8601：**1 = 週一 … 7 = 週日**。

---

## 4. 資料模型速覽

```
WorkoutPlan        課表版本（schemaVersion, version, effectiveFrom, locked, sourceText）
  └ PlanGroup      群組（weekdays[], requirement, cautions[], estimatedMinutes）
      └ Stage      階段（rounds 循環組數, restBetweenRoundsSeconds）
          └ StageItem   動作引用 + 規格（exerciseId, measureType, sets/reps/…, specText）
  └ FallbackRoutine     微型／備用課表（不綁星期，忙碌日使用）

ExerciseDef        動作庫（獨立集合，name 為共用鍵；steps, cautions, equipment, videoUrl）

WorkoutLog         打卡（date, planId?, source, status, totalMinutes, rpe, note）
  └ LogItem        實際項目（stageItemId?, done, actual*）
```

`WorkoutLog.planId` 為選填：自由運動且當天沒有任何生效課表時為空。

localStorage keys：`lineboxy.workout.{meta,exercises,plans,logs}`。
容量無虞——課表約 10–15 KB／份、打卡約 0.3–0.6 KB／筆，十年份不到 1 MB（上限 5 MB）。
Pixel + Chrome 沒有 iOS Safari 的七天自動清除問題。

---

## 5. 開發環境注意事項

- **`pnpm` 不在 PATH 上**，`node` 也不在。Node 由 fnm 管理，可執行檔在
  `C:\Users\CatBoxy\AppData\Roaming\fnm\node-versions\v24.15.0\installation\node.exe`
- 因此驗證指令要直接呼叫：
  ```
  node node_modules/vue-tsc/bin/vue-tsc.js --build --force
  node node_modules/eslint/bin/eslint.js . --ext .vue,.ts,... --ignore-path .gitignore
  node node_modules/vite/bin/vite.js build
  ```
- 專案無測試框架。純函式邏輯可用 `node_modules/esbuild` 打包臨時腳本到暫存目錄執行驗證
  （批次 A 就是這樣驗的，含 localStorage 的極簡替身）
- 套件管理器統一為 **pnpm**（`packageManager: pnpm@10.21.0`）。
  先前殘留的未追蹤 `yarn.lock` 已刪除，請勿再引入其他 lockfile

---

## 6. 人工驗收結果（2026-07-30 全數通過）

**批次 A：全數通過。** 七天總覽與原文相符、「六或日」正確呈現為擇一、微型課表有收錄、
動作庫去重合理、循環訓練組數與組間休息正確、防護重點在群組層與動作層都看得到。

防護重點的顯示位置（批次 B 會用到）：

| 層級 | 顯示於 |
|---|---|
| 群組層 `PlanGroup.cautions` | `WorkoutView`（今天卡片）、`WorkoutPlanView`、`WorkoutImportView`、`WorkoutLogView` |
| 動作層 `StageItem` / `ExerciseDef` | `StageList`（只有 ⚠️ 小圓點）、`ExerciseDetail`（完整清單，要點開） |

動作層的注意事項**目前必須點開詳情才看得到內容**——這正是批次 B 要改的地方。

**導覽列：通過。** active 頁籤會自動捲入。
`IndexView.vue` 的 `scroll-snap-type` / `scroll-snap-align` **兩行維持註解狀態，不刪除**
（使用者決定保留，方便日後回頭比較）。focus 外框沒有被裁切，不需要 `padding-block` 補償。

**彈窗捲動鎖定與 Esc 關閉：通過。** 見
[done/2026-07-30-modal-scroll-lock-esc.md](done/2026-07-30-modal-scroll-lock-esc.md) §5 的八項。

---

## 7. 路線圖

依序執行。第 2 項可隨時插隊。

### 批次 B：打卡 checklist 與日曆

**目標**：把目前的簡易打卡升級成完整版，並補上日曆檢視。

- **完整 checklist 打卡**：帶入當日課表所有動作逐項打勾，可改實際組數／次數／秒數。
  UI 由 `measureType` 決定輸入型態。**必須有「一鍵全部完成」**——照表操課的日子（多數日子）
  應該兩三下結束，只有要調整的才進去改。使用者已明確表示以點擊打勾為主。
- **動作層的注意事項要顯示在 checklist 上**，不能只藏在詳情頁——防護重點只有在做的當下看到才有用
- 支援：微型課表選項、自由運動、部分完成、一天多筆（早上／晚上）
- **月曆檢視**為主（手機上日檢視資訊量太少）。休息日、完整課表、微型課表用不同顏色區分
- 週檢視可作為打卡入口

現有的 `WorkoutLogView.vue` 是簡易版，可就地升級或改寫。
`WorkoutLog.items` / `LogItem` 型別已備妥，資料層不需改動。

### 插隊項目：備份到 Google Drive appDataFolder

**這一項不依賴後端，可隨時做，且直接降低目前最大的風險**（localStorage 遺失）。

- Drive API 的 `appDataFolder` 是 app 專屬空間，使用者在 Drive 介面看不到
- scope 只要 `drive.appdata`，權限很窄
- 前端用 Google Identity Services 的 token client 當場取 access token；
  **不需要 refresh token**（那絕不能放前端），因為是使用者主動按「備份」時才要。
  已授權過可靜默取得
- 直接沿用既有的 `exportAll()` / `importAll()`，只是把「下載檔案」換成「上傳 / 下載 Drive」
- `WorkoutView.vue` 已有「上次備份：N 天前」的提示，接上即可

### 批次 C：統計與趨勢

- 年檢視 heatmap（類似 GitHub contribution graph）
- 達成率與運動日佔比。`schedule.ts` 的 `computeMonthStats()` 已實作，直接接畫面
  - 達成率 = 已達成配額 / 應運動日配額 ← 這才是自律程度
  - 運動日佔比 = 實際運動日 / 當月天數（分母算到今天為止）
- 課表版本 diff：匯入新版時比對出新增／移除／修改的動作。
  AI 重出課表常會悄悄改掉沒要它改的東西
- **動作進步趨勢圖**：同一動作跨群組、跨課表版本的重量／次數變化。
  這是整個功能長期價值最高的部分，`ExerciseDef` 以名稱共用就是為了支撐它

### 批次 D：接後端

- 新增 `src/services/workout/apiRepository.ts` 實作 `WorkoutRepository`，**畫面層不動**
- 後端在另一個 repo，使用者有權限
- **多裝置同步在這一步自然解決**——不要用 Google Drive 當同步儲存層，
  那需要自行處理版本衝突、合併、離線佇列，等於重新發明一個很難用的資料庫

### 加分項：Google Calendar

價值不在同步而在**呈現**——打卡時同步建立日曆事件，即可在手機通知、桌面日曆、手錶上看到。
這是自家後端給不了的。

注意：Calendar 只能當呈現層、不能當資料來源（使用者會手動改事件，雙向同步難以收斂），
且 `calendar.events` 是相對敏感的 scope。

### 已排除：Google Fit

Google 已宣布淘汰 Fit 的 REST API、改推 Android 的 Health Connect，
而 Health Connect 是原生 API，PWA 取用不到。除非要做原生 app，否則此路不通。
（淘汰時程請以 Google 官方最新公告為準。）

---

## 8. 隱私考量（做任何雲端整合前必讀）

課表的 `medicalNotes` 含**具體病史**（二尖瓣脫垂、膽結石），動作說明含膝蓋與腳踝傷況。
這是敏感個資，而且是使用者家人的。

- `appDataFolder` 是私有空間，風險最低
- **寫進 Google Calendar 要特別小心**：事件標題會出現在通知與鎖定畫面，
  若該日曆與家人共用，病史相關內容就會外流。
  建議只寫「運動 30 分鐘」這類中性標題，課表細節留在 app 內

---

## 9. 已知的原始課表問題（會在匯入時以警告呈現，非程式錯誤）

使用者的課表由 Gemini GEM 產生，本身有數字不一致之處，例如週二四總覽寫「拉伸 5 分鐘」
但階段標題寫「伸展收尾（2 分鐘）」。匯入器的規則 8 會比對各階段時間加總與宣稱總時長，
**顯示警告但不阻擋**。這是 AI 產生課表的通病，屬預期行為。

`WorkoutImportView.vue` 內建給 GEM 的提示詞模板（可一鍵複製），
已要求補齊原本缺漏的參考影片連結與結構化器材清單。

---

## 10. 建議的下一步

§6 的人工驗收已於 2026-07-30 全數完成，接下來：

1. 做 **批次 B**，功能完整後才知道真正需要同步什麼。
   起手處是 `WorkoutLogView.vue` 與動作層注意事項的顯示（見 §6）
2. Drive 備份可視使用者對資料遺失的擔憂程度隨時插隊

`main` 上的改動都還**沒有 push**，等使用者明確指示。
