# 運動計畫功能 — 現況與後續路線圖（交付文件）

> 狀態：進行中
> 建立日期：2026-07-28
> 最後更新：2026-07-31（schema v2 驗收通過並歸檔、達成率確定改為雙線）
> 用途：**交付給新的 session 接手**。本文件力求自足，接手者不需要前面的對話脈絡。
> 前置文件：[done/2026-07-27-workout-feature-batch-a.md](done/2026-07-27-workout-feature-batch-a.md)（批次 A 的完整設計與驗證紀錄）
> 相關文件：
> - [done/2026-07-30-workout-schema-v2.md](done/2026-07-30-workout-schema-v2.md)（schema v2 的完整設計與驗收紀錄）
> - [done/2026-07-30-modal-scroll-lock-esc.md](done/2026-07-30-modal-scroll-lock-esc.md)（彈窗捲動鎖定與 Esc 關閉）

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

**本文件只涵蓋運動計畫功能。** `doc/plan/` 根目錄可能還有其他進行中的計畫
（例如 `cook` 系列），那些是**完全獨立的功能**，與本 roadmap 沒有關係，
不要互相參照或合併處理。

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
| `6fc2ae2` | **schema v2**：同日擇一 `variants`、彈性日 `countsTowardQuota`、階段內擇一 `selection` |
| `86dfeae` | schema v2 計畫文件與轉換後的課表 JSON |
| `346df7a` | 課表版本改為**全域編號**，不再依課表名稱各自計數 |

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
  migrate.ts           v1 → v2 就地遷移（純函式，冪等）
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

`localRepository` 的**所有課表讀取都走 `readPlans()`**，遇到舊版就地升級並回寫，
其餘程式碼永遠只看得到目前 schema 版本的形狀。新增遷移邏輯請放 `migrate.ts`
（純函式才能用 esbuild 腳本單獨驗證），不要寫進 `localRepository`。

`ExerciseDetail.vue` 的 `v-if` 在**呼叫端**（`WorkoutImportView` / `WorkoutPlanView`），
不在元件內部——這樣「掛載 = 彈窗開著」，`onMounted` / `onUnmounted` 才能直接鎖解捲動。
新增彈窗時請沿用這個結構。

### 2.3 可用的參考資料

| 檔案 | 用途 |
|---|---|
| `doc/plan/2026-07-30-workout-plan-v2.json` | **目前的基準案例**。第 2 版真實課表，涵蓋 variants／彈性日／`choose-one`／時間範圍，可直接貼進匯入頁 |
| `doc/plan/2026-07-27-workout-sample-plan.json` | 第 1 版課表，**保留作為 v1 → v2 遷移的驗證素材**，不要刪 |

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

### 3.4 三層「擇一」不要混淆（schema v2）

這是接手者最容易做錯的地方。三者層級不同，**不能互相取代**：

| 層級 | 欄位 | 意思 | 例 |
|---|---|---|---|
| 跨星期 | `PlanGroup.requirement: 'any-one'` | 該組涵蓋的幾天裡做到一天就好 | 週六**或**週日 |
| 同一天 | `PlanGroup.variants`（length > 1） | 當天是兩節**完全不同的課**，選一節做 | 週四 MV 舞蹈／坐姿飛輪 |
| 階段內 | `Stage.selection: 'choose-one'` | 同一階段的動作勾一個就算完成 | 廚房微肌力：流理台伏地挺身／靠牆靜止收縮 |

`requirement` 的配額判定規則：

- `'all'`：weekdays 中每一天各算一個應運動日配額
- `'any-one'`：以 ISO 週為單位，整組**每週只佔一個配額**，候選日任一天有紀錄即達成
- **跨月週歸屬**：週配額歸屬於「該週內第一個涵蓋日」所在月份，避免重複計算

只有一種內容的日子就是**單一 variant**，不必特例——`PlanGroup` 底下一律是 `variants`，
v1 的 `PlanGroup.stages` 已移除。`WorkoutLog.variantId` 記錄當天實際做了哪一個。

### 3.5 動作定義以名稱跨版本共用

`ExerciseDef` 獨立於課表版本，同名共用一筆。這樣補一次影片連結處處生效，
且同一動作的進步趨勢不會被拆成多條線。

動作定義（步驟、影片、器材）視為**參考資料，允許修改**；
課表版本（哪天做什麼、幾組幾下）視為**歷史事實，不可修改**。兩者可變性不同是刻意的。

### 3.6 規格用結構化欄位

`measureType`（`reps` / `time` / `hold`）決定打卡 UI 的輸入型態，
搭配 `sets` / `reps{min,max}` / `durationSeconds{min,max}` / `holdSeconds` / `perSide` / `resistance`，
另外保留 `specText` 原文供顯示。

**不要退回純文字**——結構化是「動作進步趨勢」這個長期價值最高功能的前提。

`durationSeconds` 在 v2 已改為 `NumRange`（MV 舞蹈 10–15 分鐘存 `{min:600, max:900}`）。
**打卡輸入單位由數量級推導**：`durationSeconds.min >= 120` 時 UI 以**分鐘**輸入，否則以秒。
不另外加欄位標記單位——多一個欄位反而要維護一致性。這是 UI 契約，批次 B 要照做。

### 3.7 日期一律 `'YYYY-MM-DD'` 本地時區字串

不使用 `Date` 物件或 ISO 字串儲存。`schedule.ts` 提供 `toDateString` / `fromDateString` /
`todayString` / `addDays` / `isoWeekdayOf` / `startOfIsoWeek`。時區處理錯誤在日曆功能上是災難級的坑。

### 3.8 星期編號

ISO-8601：**1 = 週一 … 7 = 週日**。

### 3.9 彈性日 `countsTowardQuota`（schema v2）

`PlanGroup.countsTowardQuota: false` 的群組（目前是週二、三的買菜備料煮飯日）
**不進「應運動日配額」的分母**，但該日的打卡**仍然計入「實際運動日」**。

理由：達成率要反映的是自律程度。這些日子課表本來就寫明「不強求大課表」，
放進分母只會讓數字失真；但使用者真的在廚房動了，運動日佔比不該漏掉。

**做批次 C 統計時不要「順手修正」掉這個不對稱**，它是刻意的。

### 3.10 `avoidances` 是可機器檢查的規則

`WorkoutPlan.avoidances: string[]`（目前為 `['深蹲', '跳躍', '爬樓梯']`）
與 `medicalNotes`（病史敘述）性質不同：它是**規則**，匯入時掃描動作名稱與步驟文字，
命中即警告。AI 重出課表最容易犯的錯就是悄悄把被排除的動作放回來。

`parsePlan.ts` 已實作這個掃描，批次 C 的「課表版本 diff」可直接重用。

---

## 4. 資料模型速覽

**以 `src/services/workout/types.ts` 為唯一真相來源**，本節只是導覽。
目前 `WORKOUT_SCHEMA_VERSION = 2`。

```
WorkoutPlan        課表版本（schemaVersion, name, version 全域編號, effectiveFrom,
                             medicalNotes[], avoidances[], locked, sourceText）
  └ PlanGroup      群組（weekdays[], requirement, summary?, cautions[],
                         estimatedMinutes, countsTowardQuota）
      └ PlanVariant     同日可選內容（label, summary?, estimatedMinutes）
                        ← v2 新增，取代 v1 的 PlanGroup.stages
          └ Stage       階段（rounds 循環組數, restBetweenRoundsSeconds, selection, note?）
              └ StageItem   動作引用 + 規格（exerciseId, measureType,
                             sets/reps/durationSeconds/holdSeconds/perSide/resistance, specText）
  └ FallbackRoutine     微型／備用課表（不綁星期，忙碌日主動選用；直接持有 StageItem[]）

ExerciseDef        動作庫（獨立集合，name 為共用鍵；steps, cautions, equipment, videoUrl）

WorkoutLog         打卡（date, planId?, planVersion?, source, groupId?, variantId?,
                         fallbackId?, status, totalMinutes, rpe, note）
  └ LogItem        實際項目（stageItemId?, done, actual*）
```

- `WorkoutLog.planId` 為選填：自由運動且當天沒有任何生效課表時為空
- `WorkoutLog.variantId` 為選填：舊資料為空，代表「當時只有一個選項」
- `WorkoutPlan.version` 是**全域遞增**的，不再依課表名稱各自計數（`346df7a`）

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

## 6. 人工驗收結果

批次 A、導覽列、彈窗三項於 2026-07-30 全數通過；**schema v2 尚未驗收，見 §6.1**。

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

### 6.1 schema v2：全數通過（2026-07-31）

`6fc2ae2` 的自動驗證（vue-tsc / eslint / vite build / 32 項純函式腳本）與
**八項人工驗收全數通過**，清單見
[done/2026-07-30-workout-schema-v2.md](done/2026-07-30-workout-schema-v2.md) §9.3。

含第 8 項「舊資料遷移」——舊課表與舊打卡在就地升級後都正常。
第 2 版課表已可正式使用，`effectiveFrom` 為 2026-07-30。

驗收時確認仍存在的資訊缺口見 §9.1，**不阻擋後續開發**。

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
- **月曆檢視**為主（手機上日檢視資訊量太少）。用不同顏色區分**四種**狀態：
  休息日、照表完成、fallback／部分完成、彈性日（NEAT，`countsTowardQuota: false`）
- 週檢視可作為打卡入口

#### schema v2 帶來的額外需求

- **variant 選擇**：`variants.length > 1` 的日子，打卡要先選一節課，存進 `WorkoutLog.variantId`；
  重新開啟打卡頁時要正確回填先前的選擇
- **`selection: 'choose-one'` 的完成判定**：該階段勾一個動作即算完成，
  「一鍵全部完成」在這種階段的行為需明確（見下方待決議）
- **時間型輸入單位**：依 §3.6 的規則，`durationSeconds.min >= 120` 用分鐘、否則用秒
- **`source` 必須忠實記錄**（見下方待決議），批次 C 的達成率直接吃這個欄位

現有的 `WorkoutLogView.vue` 是簡易版，可就地升級或改寫。
`WorkoutLog` / `LogItem` 型別已備妥（含 v2 的 `variantId`），資料層不需改動。

#### 待決議：fallback 與 variant 內容重疊時，`source` 記什麼

「隱形坐姿核心」「廚房 1 分鐘微肌力」「睡前床上放鬆」三份**同時**是某天的 variant
又列在 `fallbackRoutines`。內容一模一樣，但 `source` 記 `'group'` 或 `'fallback'`
會直接改變批次 C 的達成率數字（§7 批次 C）。

**建議：以打卡入口決定。** 從「今天的課表」選 variant 進來 → `'group'`；
從「備用課表」清單主動選 → `'fallback'`。記錄的是**行為意圖**，不是內容。
因此打卡頁的這兩個入口在 UI 上必須分得清楚，不能混成同一份清單。

同理，週一做 5 分鐘「隱形坐姿核心」是課表本身允許的 variant，**算照表達成**——
否則 variants 的設計意義就沒了。

#### 「一鍵全部完成」的三個未定行為

1. 遇到 `choose-one` 階段：全勾？勾第一個？還是留白要求手動選？
2. 遇到 `variants.length > 1` 的日子：必須先選 variant 才能按，還是預設第一個？
3. 遇到**沒有任何項目的階段**（週二三的「NEAT 廚房日常熱量消耗」，
   全課表唯一一個）：算完成、略過、還是根本不顯示打勾框？

照表操課的日子應該兩三下結束（使用者已明確表示以點擊打勾為主），
但這兩處若預設錯了會產生假資料，實作前先確認。

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
- **達成率改為雙線**（2026-07-31 決議，見本節「達成率雙線」）
- 運動日佔比 = 實際運動日 / 當月天數（分母算到今天為止）。
  `schedule.ts` 的 `computeMonthStats()` 已實作，直接接畫面
- 課表版本 diff：匯入新版時比對出新增／移除／修改的動作，
  比對層級要下探到 `variants`。`avoidances` 掃描已在 `parsePlan.ts` 實作，可直接重用。
  AI 重出課表常會悄悄改掉沒要它改的東西
- **動作進步趨勢圖**：同一動作跨群組、跨 variant、跨課表版本的重量／次數變化。
  這是整個功能長期價值最高的部分，`ExerciseDef` 以名稱共用就是為了支撐它。
  注意「坐姿核心收縮」與「坐姿腹橫肌等長收縮」**刻意是兩條線**
  （[schema v2 決議 4](done/2026-07-30-workout-schema-v2.md)），不是 bug

#### 達成率雙線（2026-07-31 決議）

**現況是錯的**：`computeMonthStats()` 目前的判定是
`logs.filter((log) => log.status !== 'rest')`，只看「那天有沒有非休息的打卡」，
不管 `source` 也不管 `status`。所以只做了 1 分鐘廚房微肌力，該日配額就算滿分。
**這條線目前沒有任何自律訊號**——它其實已經是下表的「活動達成率」，
缺的反而是嚴格版。

| 指標 | 分子條件 | 意義 |
|---|---|---|
| **照表達成率** | `source === 'group'` 且 `status === 'done'` | 真的照課表做完 |
| **活動達成率** | `status !== 'rest'`（現行邏輯，不動） | 有動就算，含 fallback 與 `partial` |

- **分母兩者相同**，都沿用 `getExpectedSlots()`，因此 §3.9 的彈性日照樣不進分母
- `partial` **只進寬鬆版**。這樣兩條線的差距本身就是有意義的數字：
  「有動但沒照表完成」的比例。若把 `partial` 也算進嚴格版，兩條線會黏在一起，
  第二條就白做了
- variant 不影響嚴格版：做週一的 5 分鐘極速版仍算照表達成（見批次 B 的 `source` 決議）

**為什麼要第二條線**：好習慣不是一日養成的。使用者需要看到
「我有做運動，只是當天有其它事所以只能做 fallback 版」，
單一嚴格指標會讓忙碌日看起來像完全失敗，容易直接放棄。

**呈現方式：同一條進度條的兩段，不要並排兩個百分比。**
並排會讓人只挑好看的那個看，心理暗示反而變成自欺。

```
████████░░░░░░····  照表 8/16 ・ 有動 13/16
```

深色 = 照表達成，淺色 = fallback／partial 補上的部分。
淺色段很長代表「你其實很努力」，同時看得到離照表操課還有多遠——單看數字做不到。

**成本**：資料層零改動，`LogSource` / `LogStatus` 都已就位。
只要 `computeMonthStats()` 多算一組、`MonthStats` 多幾個欄位，是純加法。
既有 `achievementRate` 欄位語意不變（就是寬鬆版），現有畫面不會壞。

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

### 9.1 待補資訊（**不阻擋開發，但別忘了**）

以下缺口在 schema v2 驗收時已確認存在，使用者決定先不補。
**下次請 GEM 重出課表時一併要求**，或在動作詳情頁手動補上。

| # | 缺什麼 | 影響 | 怎麼補 |
|---|---|---|---|
| 1 | **7 個動作沒有參考影片**：坐姿腹橫肌等長收縮、廚房靠牆靜止收縮、坐姿頭頸溫和繞環、全家拍氣球、坐姿低阻力平路飛輪、MV 舞蹈、全家戶外散步 | 匯入時固定跳一則警告；使用者看不到示範 | `ExerciseDef` 屬參考資料**可直接修改**（§3.5），在動作詳情頁逐一補即可，不必重匯課表 |
| 2 | **「NEAT 廚房日常熱量消耗」沒有可計量的內容** | 這是全課表唯一沒有可勾項目的階段，批次 B 的「一鍵全部完成」要特別處理（見 §7 批次 B） | 要使用者給出可計量的定義（例如「站立備料 20 分鐘」），否則維持描述型 |
| 3 | **「居家放鬆」的坐姿貓牛式 2 分鐘未說明次數或呼吸節奏** | 打卡時只能填時間，無法記錄次數 | 下次重出課表時要求補 |
| 4 | **決議 4 缺 GEM 的原始說明**：使用者提到 GEM 有解釋「坐姿核心收縮」與「坐姿腹橫肌等長收縮」為何不同，但該段文字未附上 | 若其中含影響 `targetMuscles` 或 `cautions` 的細節，動作定義需要調整 | 找回該段文字後比對現有兩筆定義 |

另有一項**已確認不修**：`avoidances` 掃描會對 MV 舞蹈誤報「深蹲／跳躍」，
因為步驟原文是「遇到跳躍或深蹲的動作，改為原地踩步」——正是在避開它。
子字串掃描讀不出否定語境，**不要為此加語意判斷**，誤報的成本遠低於漏報。

---

## 10. 建議的下一步

批次 A 與 schema v2 都已驗收通過（§6、§6.1），接下來：

1. 確認批次 B 的三個待決議：fallback／variant 的 `source` 判定、
   「一鍵全部完成」遇到 `choose-one` 與多 variant 的行為、
   以及碰到無項目階段（NEAT）算不算完成（見 §7 批次 B）
2. 做 **批次 B**，功能完整後才知道真正需要同步什麼。
   起手處是 `WorkoutLogView.vue` 與動作層注意事項的顯示（見 §6）
3. Drive 備份可視使用者對資料遺失的擔憂程度隨時插隊
4. §9.1 的待補資訊隨時可補，其中影片連結不需重匯課表

達成率雙線屬批次 C，但它**只改 `computeMonthStats()`**、不依賴批次 B 的 UI，
若想早點看到數字也可以提前做——前提是批次 B 已經會忠實記錄 `source` 與 `status`，
否則嚴格版算出來會是一條假線。

**push 狀態（2026-07-31）**：`main` 有 commit **尚未推送**至 `origin/main`，
接手前請先 `git log origin/main..main` 確認實際落差。
後續改動仍**不要自動 push**，等使用者明確指示。
