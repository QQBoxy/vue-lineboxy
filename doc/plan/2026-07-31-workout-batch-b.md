# 運動計畫批次 B — checklist 打卡與月曆

> 狀態：**實作完成，人工驗收延後**（自動驗證見 §6.3）
> 2026-07-31 使用者因時間因素決定：**與批次 C 一併驗收**，屆時兩份文件一起移到 `done/`。
> 第一輪試用回報的六點已修正，見 §8。
> 建立日期：2026-07-31
> 範圍：完整 checklist 打卡、動作層注意事項前置、一天多筆、月曆檢視，
> 外加提前實作達成率雙線（原屬批次 C，只改純函式）
> 上層文件：[2026-07-28-workout-roadmap.md](2026-07-28-workout-roadmap.md) §7 批次 B

---

## 0. 前置決策（2026-07-31 與使用者確認）

| # | 項目 | 決議 | 理由 |
|---|---|---|---|
| 1 | `source` 判定 | **以打卡入口決定**：從「今天的課表」選 variant → `'group'`；從「備用課表」清單主動選 → `'fallback'` | 記錄的是行為意圖而非內容。內容重疊的三份微型課表因此不會混淆批次 C 的達成率 |
| 2 | 一鍵全部完成遇 `choose-one` | **只勾第一個**，該階段標示「擇一 · 已選第一項，可改」 | 全勾會產生「兩個動作都做了」的假資料，直接汙染批次 C 的動作趨勢圖；留白則違背「兩三下結束」 |
| 3 | 一鍵全部完成遇多 variant | **必須先選 variant，未選前按鈕 disabled**，且不預選第一個 | `variantId` 是歷史事實（當天做的是 MV 舞蹈還是坐姿飛輪），不能猜。全課表只有週四是多 variant，多一次點擊可接受 |
| 4 | 無項目階段（NEAT 廚房日常熱量消耗） | **顯示為說明區塊，不給打勾框，不進完成判定** | 它沒有可計量內容（roadmap §9.1 第 2 項）。所在的週二三本來就 `countsTowardQuota: false`，不影響達成率 |
| 5 | 一天多筆 | `/workout/log?date=X` 進來時列出當日既有紀錄可切換，另有「再記一筆」 | 現行 `logs[0] ?? null` 會**覆寫**同日前一筆。切換紀錄是元件內狀態，不改路由（避免 watch route） |
| 6 | 月曆位置 | 新路由 **`/workout/calendar`**，主頁「最近 14 天」保留為快速入口 | 主頁已有四段，月曆需要月份切換與圖例，獨立頁較合適 |
| 7 | 達成率雙線 | **本批次一起做**（原屬批次 C） | 只改 `computeMonthStats()` 一個純函式，且前提正是批次 B 忠實記錄 `source` / `status`，一起做才能當場驗證嚴格版是對的 |

### 0.1 本文件額外決定的事（實作細節，不需另行確認）

- **`status` 由 checklist 自動推導，不給手動按鈕**（`group` / `fallback` 來源）。
  全部應勾項目都勾滿 → `'done'`；有勾但不滿 → `'partial'`；完全沒勾 → 不可儲存。
  理由：批次 C 的嚴格線直接吃 `status`，讓使用者手動選會讓「勾了三項卻按完成」變成假資料。
  `freeform` 沒有 checklist，維持手動選 `done` / `partial`。
- **實際數值（組數／次數／秒數／重量）預設留空，不預填課表規格**。
  留空 = 照課表做。預填會把 `8–12 次` 這種範圍硬塞成一個假數字，
  批次 C 的進步趨勢圖會看到一條完全平的假線。輸入框以 `placeholder` 顯示課表規格。
- **實際數值收在每項的「調整」摺疊內**，預設只顯示打勾框 + 動作名 + 規格 + 注意事項。
  照表操課的日子不需要展開任何一項。

---

## 1. 檔案異動總覽

```
新增
  src/services/workout/checklist.ts        checklist 中介型別與純函式（建表、一鍵完成、狀態推導、回填）
  src/services/workout/calendar.ts         月曆格子推導（純函式）
  src/components/workout/LogChecklist.vue  checklist UI（打勾、注意事項、實際數值）
  src/components/workout/MonthCalendar.vue 月曆格線 + 圖例
  src/views/WorkoutCalendarView.vue        /workout/calendar

修改
  src/services/workout/schedule.ts         computeMonthStats 加嚴格線；新增 resolvePlanForDate
  src/views/WorkoutLogView.vue             改寫為 checklist 版，支援一天多筆
  src/views/WorkoutView.vue                月曆入口；最近 14 天顯示多筆
  src/router/index.ts                      新增 /workout/calendar
```

**資料層完全不動**：`WorkoutLog` / `LogItem` 已備妥 `variantId`、`items[]`、`actual*`。

---

## 2. `checklist.ts`（純函式）

### 2.1 型別

```ts
/** 打卡輸入的時間單位。由數量級推導，不另存欄位（roadmap §3.6） */
export type DurationUnit = 'minute' | 'second';

export interface ChecklistItem {
  /** 對應 StageItem.id，寫入 LogItem.stageItemId */
  stageItemId: Id;
  /** 顯示用資料，同時可直接餵給 ExerciseDetail */
  display: DisplayItem;
  measureType: MeasureType;
  sets?: number;
  reps?: NumRange;
  durationSeconds?: NumRange;
  holdSeconds?: number;
  perSide?: boolean;
  weightKg?: number;
  /** durationSeconds.min >= 120 → 'minute'，否則 'second' */
  durationUnit: DurationUnit;
}

export interface ChecklistStage {
  key: string;
  name: string;
  selection: StageSelection;
  estimatedMinutes?: NumRange;
  rounds?: NumRange;
  restBetweenRoundsSeconds?: NumRange;
  note?: string;
  items: ChecklistItem[];
  /** items 為空 → 只顯示說明，不進完成判定（決策 4） */
  descriptive: boolean;
}

/** 單一項目的打卡狀態。key 為 stageItemId */
export interface ItemState {
  done: boolean;
  actualSets?: number;
  actualReps?: number;
  /** 一律以秒儲存，UI 依 durationUnit 換算 */
  actualDurationSeconds?: number;
  actualWeightKg?: number;
  note?: string;
}
```

### 2.2 函式

| 函式 | 說明 |
|---|---|
| `buildStageChecklist(stages, exercises)` | `Stage[]` → `ChecklistStage[]`。顯示欄位重用 `display.ts` 的 `stagesToDisplay()`，以 `DisplayItem.key === StageItem.id` 對應，不另寫一份動作查表 |
| `buildFallbackChecklist(fallback, exercises)` | `FallbackRoutine` → 單一 `ChecklistStage`（`selection: 'all'`） |
| `durationUnitOf(range?)` | `min >= 120` → `'minute'`，否則 `'second'` |
| `toDurationInput(seconds, unit)` / `fromDurationInput(value, unit)` | 秒 ⇄ UI 數值。`'minute'` 時除／乘 60 |
| `markAllDone(stages, states)` | 一鍵全部完成。`selection: 'all'` 全勾；`'choose-one'` 只勾第一項（決策 2）；`descriptive` 略過 |
| `clearAll(stages, states)` | 一鍵取消，供誤按時還原 |
| `isStageSatisfied(stage, states)` | `descriptive` → `true`；`'choose-one'` → 至少一項；`'all'` → 全部 |
| `deriveStatus(stages, states)` | 全階段滿足 → `'done'`；有任何一項勾 → `'partial'`；都沒勾 → `null`（不可儲存） |
| `statesFromLog(stages, log)` | 以 `stageItemId` 回填既有紀錄；找不到對應的舊項目忽略（換 variant 或換課表版本時） |
| `statesToLogItems(stages, states)` | 產生 `LogItem[]`，含名稱快照。未勾的項目也寫入（`done: false`），批次 C 才分得出「沒做」與「沒這一項」 |

全部無副作用，可用 esbuild 腳本單獨驗證。

---

## 3. `WorkoutLogView.vue`（改寫）

### 3.1 版面

```
‹ 返回            打卡 / 編輯打卡

┌ 日期 ────────────────────────────┐
│ [2026-07-31]  週四 · 今天         │
│ 當日已有 1 筆：〈① MV 舞蹈 已完成〉│  ← 多筆時才出現
│                     [ + 再記一筆 ] │
└──────────────────────────────────┘

┌ 做了什麼 ────────────────────────┐
│ ○ MV 舞蹈           當日課表 2選1 │
│ ○ 坐姿低阻力飛輪    當日課表 2選1 │
│ ─────────────────────────────── │
│ ○ 隱形坐姿核心         備用課表   │
│ ○ 廚房 1 分鐘微肌力    備用課表   │
│ ─────────────────────────────── │
│ ○ 自由運動                        │
│ ⚠️ 群組層防護重點…                │
└──────────────────────────────────┘

┌ 項目 ────────────────────────────┐
│      [ ✓ 一鍵全部完成 ] [ 清除 ]  │
│                                   │
│ 暖身（5 分）                      │
│  ☑ 坐姿頭頸溫和繞環   每邊 5 次   │
│      ⚠️ 頸椎不適時放慢            │  ← 注意事項直接顯示
│      [ 調整 ]                     │
│  ☐ 肩膀繞環           10 次       │
│      [ 調整 ]                     │
│        └ 展開後：組數 / 次數 / 重量│
│                                   │
│ 廚房微肌力  ⓘ 擇一即可            │
│  ☑ 流理台伏地挺身     8–12 次     │
│  ☐ 靠牆靜止收縮       30 秒       │
│                                   │
│ NEAT 廚房日常熱量消耗             │
│  （此階段沒有可勾選的項目，        │
│    以下為說明）…                  │
└──────────────────────────────────┘

┌ 完成狀況 ────────────────────────┐
│ 狀態：已完成（8 / 8）             │
│ 實際耗時 [ 45 ] 分鐘              │
│ 自覺強度 [ 1–10 ]                 │
│ 備註 [                          ] │
│ [ 儲存打卡 ]    [ 刪除這筆 ]      │
└──────────────────────────────────┘
```

### 3.2 狀態與流程（不使用 watch）

| 事件 | 處理 |
|---|---|
| `onMounted` | 讀 `route.query.date`（預設今天）→ `loadDate()` 載課表、動作庫、當日全部紀錄 |
| 換日期（`@change`） | 事件處理函式直接呼叫 `loadDate()` |
| 切換當日紀錄 | 元件內 `activeLogId` + `applyLog()`，**不動路由** |
| 「再記一筆」 | `activeLogId = null` + `resetForm()` |
| 選 variant / fallback / 自由 | 事件處理函式設 `source` 與 id，並重設耗時預設值 |
| checklist 內容 | `computed` 由 `selectedVariant` / `selectedFallback` 推導 |
| 完成狀態 | `computed` 呼叫 `deriveStatus()` |

`selectedVariant` 的回退規則**改掉**：只有 `variants.length === 1` 時才自動取第一個，
多 variant 未選時回傳 `null`（決策 3）。`schedule.ts` 的 `getVariant()` 維持原樣供顯示用途。

### 3.3 儲存

```ts
{
  id, date,
  planId: plan?.id, planVersion: plan?.version,
  source,                                   // 入口決定（決策 1）
  groupId:   source === 'group'    ? group.id             : undefined,
  variantId: source === 'group'    ? selectedVariant.id   : undefined,
  fallbackId:source === 'fallback' ? selectedFallback.id  : undefined,
  status,                                   // group/fallback 自動推導；freeform 手動
  totalMinutes, rpe, note,
  items: statesToLogItems(checklistStages, itemStates),
}
```

---

## 4. 月曆（`calendar.ts` + `MonthCalendar.vue` + `WorkoutCalendarView.vue`）

### 4.1 日狀態

```ts
export type DayStatus = 'none' | 'rest' | 'plan-done' | 'partial' | 'flex';
```

| 值 | 意義 | 判定 |
|---|---|---|
| `flex` | 彈性日（NEAT）有打卡 | 當日群組 `countsTowardQuota === false` 且有紀錄。**優先於其他** |
| `plan-done` | 照表完成 | 有任一筆 `source === 'group'` 且 `status === 'done'` |
| `partial` | fallback／部分完成 | 有紀錄但不符上述 |
| `rest` | 休息日 | 課表當天沒排群組，且無紀錄 |
| `none` | 應運動日尚未打卡 | 有群組但無紀錄。以虛線框呈現，不算「一種顏色」 |

`flex` 置頂是刻意的：彈性日就算照表完成也該顯示為彈性日，
否則畫面上看不出 roadmap §3.9 那個「不進分母但進運動日」的不對稱。

### 4.2 推導

```ts
/** 課表清單 → 該日期適用者。localRepository.getPlanForDate 的純函式版 */
export function resolvePlanForDate(plans: WorkoutPlan[], date: DateString): WorkoutPlan | null;

export interface CalendarDay {
  date: DateString;
  dayOfMonth: number;
  inMonth: boolean;       // 補格（鄰月）為 false
  isToday: boolean;
  isFuture: boolean;
  status: DayStatus;
  groupLabel: string;
  logCount: number;
}

/** 週一起始的 ISO 週格線，含前後補格 */
export function buildMonthCalendar(
  plans, logs, year, month, today,
): CalendarDay[][];
```

### 4.3 頁面

- 月份切換（‹ 2026-07 ›），不允許超過今天所在月份 + 1
- 點任一格 → `/workout/log?date=YYYY-MM-DD`
- 頁尾放圖例與該月統計（達成率雙線進度條）

---

## 5. 達成率雙線（`computeMonthStats`）

`MonthStats` 新增三個欄位，**既有欄位語意完全不變**（純加法，現有畫面不會壞）：

```ts
/** 照表達成：source === 'group' 且 status === 'done' */
strictAchievedTotal: number;
strictAchievementRate: number;
/** 分母，與寬鬆版相同，只是命名上讓呼叫端好讀 */
// expectedTotal 沿用
```

分子集合改為兩份 `Set<DateString>`：

```ts
const activeDates  = new Set(logs.filter(l => l.status !== 'rest').map(l => l.date));
const strictDates  = new Set(
  logs.filter(l => l.source === 'group' && l.status === 'done').map(l => l.date),
);
```

分母（`expectedTotal`）判定沿用現行規則：未結束且未達成的配額不列入。
**以寬鬆版是否達成來決定配額是否結算**，避免「只做了 fallback 的日子」
在嚴格版把分母也一起吃掉造成兩條線分母不同。

進度條呈現（roadmap §7）：同一條的兩段，深色 = 照表、淺色 = 有動，不並排兩個百分比。

---

## 6. 驗收

### 6.1 自動

```
node node_modules/vue-tsc/bin/vue-tsc.js --build --force
node node_modules/eslint/bin/eslint.js . --ext .vue,.ts,.js --ignore-path .gitignore
node node_modules/vite/bin/vite.js build
```

加上 esbuild 臨時腳本驗證純函式：`checklist.ts`、`calendar.ts`、`computeMonthStats`。

### 6.2 人工（逐步操作）

> 建議挑**還沒有任何紀錄的過去日期**做，才不會被既有資料干擾。

#### A. 入口

| # | 步驟 | 應該看到 |
|---|---|---|
| 1 | 進 `/workout` | 「今天」卡片下方有一顆全寬的 **📅 月曆檢視** 按鈕 |
| 2 | 點它 | 進入 `/workout/calendar`，顯示本月月曆 |

#### B. 一鍵完成與 checklist

| # | 步驟 | 應該看到 |
|---|---|---|
| 3 | 首頁點一個**過去的週一**（單 variant）→ 打卡頁 | 「項目」卡片直接列出當日所有動作，右上角顯示 `0 / N` |
| 4 | 按「✓ 一鍵全部完成」 | 全部勾起、`N / N`、狀態顯示「已完成」、儲存鈕可按 |
| 5 | 存檔 | **跳回 `/workout`**，頂端出現綠色「已儲存打卡。」 |
| 6 | 找「廚房 1 分鐘微肌力」那個 **`擇一即可`** 階段，重按一次一鍵完成 | 該階段**只有第一項**被勾，第二項維持空白 |
| 7 | 看任何有 ⚠️ 的動作 | 注意事項的**文字**直接顯示在動作下方的黃色框，不必點「詳情」 |

#### C. variant（週四）

| # | 步驟 | 應該看到 |
|---|---|---|
| 8 | 打卡頁選一個**過去的週四** | 「項目」卡片顯示黃底提示「請先在上方選一節」，**沒有**一鍵完成按鈕 |
| 9 | 上方選「坐姿低阻力飛輪」 | checklist 換成飛輪的內容，一鍵完成按鈕出現 |
| 10 | 一鍵完成 → 存檔 → 再從首頁點同一天進來 | 選中的是**坐姿飛輪**，不是 MV 舞蹈 |

#### D. NEAT 日（週二或週三）

| # | 步驟 | 應該看到 |
|---|---|---|
| 11 | 打卡頁選一個**過去的週二** | 「NEAT 廚房日常熱量消耗」階段**沒有打勾框**，只有一段灰色說明 |
| 12 | 該日其他項目勾滿 | 狀態顯示「已完成」——NEAT 階段不影響判定 |

#### E. 時間單位

| # | 步驟 | 應該看到 |
|---|---|---|
| 13 | 週四選 MV 舞蹈，看該動作那一列 | 時間型動作**預設就是展開的**，直接看得到時間欄位；框內右側有**綠色的「分」**，placeholder 是 `10–15`，下方提示「（課表：10-15 分鐘）」 |
| 14 | 輸入 `12` | 代表 12 分鐘（存成 720 秒）。**不要填 720** |
| 15 | 找一個 45 秒的動作（如伸展） | 同一欄位右側是「秒」，placeholder 是 `45` |
| 16 | 找一個次數型動作（如坐姿核心收縮） | 預設**收起**，下方有一顆有框的「▾ 調整實際數值」按鈕，點了才展開 |

#### F. 一天多筆

| # | 步驟 | 應該看到 |
|---|---|---|
| 17 | 對一個**已經有紀錄**的日期再次進入打卡頁 | 日期卡片下方出現**黃色橫幅**：「這天已經有 1 筆紀錄，目前正在編輯第 1 筆」 |
| 18 | 按橫幅裡的「＋ 再記一筆」 | 橫幅改成「現在要新增的是第 2 筆」，表單清空，按鈕變回「儲存打卡」 |
| 19 | 選「自由運動」填「散步 30 分鐘」→ 存 | 跳回首頁，該日在「最近 14 天」顯示兩筆摘要（以「、」分隔） |
| 20 | 再進該日 | 橫幅顯示「已經有 2 筆」，兩筆可各自點選切換、各自刪除 |

#### G. 月曆四色

| # | 步驟 | 應該看到 |
|---|---|---|
| 21 | 進月曆，看下方**圖例** | 深綠＝照表完成、淺綠＝備用／部分完成、琥珀黃＝彈性日、灰＝休息日、白底虛線＝應運動日未打卡 |
| 22 | 對照 B 步驟打過的週一 | **深綠實心** |
| 23 | 對照 D 步驟打過的週二／週三（NEAT） | **琥珀黃**，不是深綠 ← 這是重點 |
| 24 | 課表沒排課的日子（如週五） | **灰色** |
| 25 | 沒打卡的過去週一 | **白底虛線框** |
| 26 | 未來日期 | 灰淡、點不下去 |
| 27 | 按 `‹` `›` 切換月份 | 正常換月，不能翻到未來月份；點任一格進入該日打卡 |

#### H. 達成率雙線

在月曆頁下方的統計卡片操作，每一步做完回月曆看進度條。

| # | 步驟 | 應該看到 |
|---|---|---|
| 28 | 記下目前「照表 a/n ・ 有動 b/n」 | — |
| 29 | 找一個**沒打卡的過去應運動日** → 選「當日課表」→ 一鍵全部完成 → 存 | **深綠段與淺綠段同時 +1**（a+1、b+1） |
| 30 | 再找一個沒打卡的過去應運動日 → 選**備用課表**（如「隱形坐姿核心」）→ 存 | **只有淺綠段 +1**，深綠段不動 ← 雙線的重點 |
| 31 | 再找一個 → 選當日課表但**只勾一半**（狀態顯示「部分完成」）→ 存 | 一樣**只有淺綠段 +1** |
| 32 | 對一個**週二／週三**（彈性日）打卡 | 兩段都不動，分母 `n` 也不變（彈性日不計配額）；但「運動日佔比」的天數 +1 |

### 6.3 自動驗證結果（2026-07-31）

| 項目 | 結果 |
|---|---|
| `vue-tsc --build --force` | 通過 |
| `eslint . --ext .vue,.ts,.js` | 通過，零警告 |
| `vite build` | 通過 |
| esbuild 純函式腳本 | **63 項全數通過** |

純函式腳本涵蓋：checklist 建表與 descriptive 判定、`choose-one` 的一鍵完成只勾第一項、
狀態推導的四種情形（含「全為 descriptive 的日子」）、時間單位的 120 秒分界與往返換算、
換 variant 時對不上的舊項目被忽略、`resolvePlanForDate` 的版本選擇、
`classifyDay` 的五種狀態（含 `flex` 優先於 `plan-done`）、月曆格線的補格與跨月、
以及達成率雙線共用分母、`fallback` 與 `partial` 都不進嚴格線。

---

## 7. 實作後才發現、與原計畫不同之處

| # | 情況 | 處理 |
|---|---|---|
| 1 | **只有 descriptive 階段的日子永遠打不了卡**。`deriveStatus()` 原本「一項都沒勾 → null（擋下儲存）」，但週二三的 NEAT 日整份 variant 可能只有描述階段，`countRequired` 為 0，於是永遠無法儲存 | `deriveStatus()` 加前置判定：`countRequired === 0` 時直接回 `'done'`。這種日子「按下儲存」本身就是使用者表達「我做了」。UI 上同時隱藏「一鍵全部完成」按鈕（沒有東西可勾） |
| 2 | 存檔後原本會 `router.push('/workout')` | 改為留在頁面並重載當日紀錄。多筆支援之後，存完馬上要能「再記一筆」；跳走會逼使用者重新進入 |
| 3 | `markAllDone()` 只寫入它有動到的項目，未被勾的 `choose-one` 第二項在 map 中可能不存在 | 判定端一律用 `states[id]?.done`，缺鍵視為未勾。頁面初始化時 `statesFromLog()` 會補齊所有鍵，實務上不會出現缺鍵 |
| 4 | 月統計需要單一 `plan`，但月曆會跨越生效日 | 月曆格子逐日以 `resolvePlanForDate()` 解析；統計則取「該月最後一天適用的課表」，並在程式碼註明理由 |

---

## 8. 第一輪人工驗收的回饋與修正（2026-07-31）

| 回饋 | 原因 | 修正 |
|---|---|---|
| **找不到月曆入口** | 入口只是「最近 14 天」標題旁的小字連結 | `WorkoutView` 的「今天」卡片下方改為**全寬按鈕「📅 月曆檢視」**，休息日／無課表分支也看得到。小連結保留 |
| **存檔後停在原頁很怪**（驗收 #1） | §7 第 2 點為了「再記一筆」而留在頁面，但這違反使用者對「存檔＝結束」的預期 | 改回 `router.push('/workout?saved=...')`，首頁 `onMounted` 讀 query 顯示綠色 flash。「再記一筆」改由**再次進入該日打卡頁**時提供 |
| **週四存了飛輪，重新進入卻顯示 MV 舞蹈**（驗收 #3） | 不是回填錯誤：當天已有兩筆，而載入時固定開啟 `dayLogs[0]`（最早建立的那筆） | 改為預設開啟 **`updatedAt` 最大的那筆**。剛存完的才是使用者心裡「這天的紀錄」 |
| **時間單位換算失敗，輸入 300 秒被當成 300 分**（驗收 #6） | 單位「分鐘」只出現在很小的欄位標題，placeholder 又只有數字 | 單位改成**輸入框內右側的後綴**（`分` / `秒` / `次` / `組` / `kg`），時間單位用主色加深；提示行補上課表原文規格 |
| **存第二筆時沒有任何提示**（驗收 #8） | 「當日已有 N 筆」縮在日期卡片下緣，容易整段略過 | 獨立成**黃色橫幅卡片**，明講「這天已經有 N 筆，目前正在編輯第 X 筆」／「現在要新增的是第 X 筆」，「＋ 再記一筆」加大成 48px 獨立按鈕 |
| **不知道月曆四色是什麼** | 圖例沒有標題，看起來像裝飾 | 加「圖例」小標與分隔線；驗收清單 §6.2 G 段列出逐格對照方式 |
| **不知道怎麼驗雙線** | 原清單只有一句結論 | §6.2 H 段改寫成 27–31 的逐步操作 |
| **找不到時間單位欄位**（修正後回報） | 欄位在每項的「調整」摺疊內，而「調整」是夾在動作名與注意事項之間的**純文字連結**，整個融進背景 | ① 改成有框的按鈕，文字改為「▾ 調整實際數值」／「▴ 收起」、「動作詳情」；② **時間型（`time` / `hold`）動作預設展開**，`reps` 型維持收起 |

> 「預設展開」以 `expanded[id] ?? measureType !== 'reps'` 實作——
> 沒有鍵代表沿用預設，使用者手動點過才寫入明確的布林值。
> 不用 `watch` 去初始化，換 variant 時也不需要重算。
