# 運動計畫功能 — 批次 A 實作計畫

> 狀態：待確認
> 建立日期：2026-07-27
> 範圍：批次 A（型別 + 資料層 + 匯入 + 課表檢視 + 備份匯出）
> 前提：純前端實作，資料存 localStorage；後端另一個 repo，日後再接。

---

## 0. 前置決策（已確認）

| 項目 | 決議 |
|---|---|
| 後端 | 先做純前端，資料層抽介面，日後換實作即可接後端 |
| 使用裝置 | Pixel 10 + Chrome（**無 iOS ITP 七天清除問題**，localStorage 相對安全） |
| 課表版本 | 唯讀（immutable）。已被打卡引用的版本禁止修改，修改一律產生新版本 |
| 課表適用判定 | 依 `effectiveFrom` 生效日 + 打卡日期推導，非依匯入時間 |
| 匯入格式 | JSON（附 schema 與 AI 提示詞模板） |
| 「六或日」 | `requirement: 'any-one'`，該週擇一達成即可；週一～五仍為逐日獨立判定 |
| 微型課表 | 算「有運動」，月曆以淺色區分 |
| 動作庫 | 批次 A 就做（同名動作共用定義，支撐影片連結與進步趨勢） |
| 程式風格 | **不使用 `watch` / `watchEffect`**，改用 `computed` + 事件驅動 + `v-if` 控制掛載 |

---

## 1. 目錄與檔案配置

```
src/services/workout/
  types.ts             型別定義（唯一真相來源）
  repository.ts        WorkoutRepository 介面
  localRepository.ts   批次 A 實作：localStorage
  parsePlan.ts         匯入：JSON → 驗證 → 正規化
  schedule.ts          純函式：日期 → 適用課表 / 適用群組 / 應運動日
  backup.ts            匯出／匯入整包備份

src/views/
  WorkoutView.vue        頁籤主頁（今天卡片 + 現行課表摘要 + 各入口）
  WorkoutImportView.vue  匯入（貼上 → 驗證 → 七天預覽 → 確認）
  WorkoutPlanView.vue    課表檢視（七天總覽 + 階段/動作詳情）

src/components/workout/
  WeekOverview.vue     七天攤平總覽（匯入預覽與課表檢視共用）
  StageList.vue        階段與動作清單
  ExerciseDetail.vue   動作詳情（沿用既有 ModalView.vue）
  ValidationReport.vue 匯入驗證結果（錯誤 / 警告分列）
```

**路由**（`src/router/index.ts` 新增，皆為 `IndexView` 的子路由）

| 路徑 | 元件 |
|---|---|
| `/workout` | `WorkoutView.vue` |
| `/workout/import` | `WorkoutImportView.vue` |
| `/workout/plan/:id` | `WorkoutPlanView.vue` |

**導覽列**（`IndexView.vue`）在 `person.isActive` 區塊新增 `Workout` 連結，
active 判定沿用既有寫法：`route.path.startsWith('/workout')`。

---

## 2. 型別定義（`types.ts`）

### 2.1 共用

```ts
/** 1 = 週一 … 7 = 週日（ISO-8601） */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** 'YYYY-MM-DD'，一律以本地時區產生，不使用 Date / ISO 字串儲存 */
export type DateString = string;

/** crypto.randomUUID() */
export type Id = string;

/** 數值範圍。單一值時只給 min */
export interface NumRange {
  min: number;
  max?: number;
}
```

### 2.2 動作庫

動作定義**獨立於課表版本**，跨版本共用。同名動作共用一筆，
讓「補一次影片連結，處處生效」與「跨群組的進步趨勢」成立。

```ts
export interface ExerciseDef {
  id: Id;
  name: string;            // '椅子扶手伏地挺身'
  nameEn?: string;         // 'Incline Push-ups'
  targetMuscles: string[]; // ['胸大肌', '手臂', '核心']
  equipment: string[];     // ['穩固靠牆椅子']
  steps: string[];         // 條列式動作步驟
  cautions: string[];      // ⚠️ 注意事項
  videoUrl?: string;       // 可事後編輯補上
  createdAt: string;
  updatedAt: string;
}
```

> **可變性說明**：動作定義（步驟、影片、器材）視為「參考資料」，**允許修改**。
> 課表版本（哪天做什麼、幾組幾下）視為「歷史事實」，**不可修改**。
> 兩者可變性不同是刻意設計：改影片連結不該讓歷史紀錄失真，改組數則會。

### 2.3 課表

```ts
export interface WorkoutPlan {
  id: Id;
  schemaVersion: number;      // 目前 1，供日後資料遷移判斷
  name: string;
  description?: string;
  version: number;            // 1, 2, 3…（同一系列課表的版次）
  effectiveFrom: DateString;  // 生效日
  groups: PlanGroup[];
  fallbackRoutines: FallbackRoutine[];
  medicalNotes: string[];     // 醫療免責 / 健康提醒
  sourceText?: string;        // 匯入時的原始文字，保留備查
  locked: boolean;            // 已被打卡引用 → true，禁止修改
  createdAt: string;
}

export interface PlanGroup {
  id: Id;
  label: string;                    // '核心與上肢強化'
  weekdays: IsoWeekday[];
  requirement: 'all' | 'any-one';   // 'any-one' → 該週擇一達成即可
  summary?: string;                 // 主要內容與防護重點一句話
  cautions: string[];               // 群組層防護重點
  estimatedMinutes: NumRange;       // {min:30} 或 {min:20, max:30}
  stages: Stage[];                  // 允許為空（例如「家庭輕活動」）
}

export interface Stage {
  id: Id;
  order: number;
  name: string;                          // '第一階段：熱身'
  estimatedMinutes?: NumRange;
  rounds?: NumRange;                     // 循環訓練組數 {min:3, max:4}
  restBetweenRoundsSeconds?: NumRange;   // 組間休息
  note?: string;
  items: StageItem[];
}

/** 階段內對動作的「引用 + 規格」。同一動作在不同階段可有不同規格 */
export interface StageItem {
  id: Id;
  order: number;
  exerciseId: Id;                           // → ExerciseDef
  measureType: 'reps' | 'time' | 'hold';    // 決定打卡 UI 的輸入型態
  sets?: number;                            // 單項組數
  reps?: NumRange;                          // {min:8, max:12}
  durationSeconds?: number;                 // 時間型：每組秒數
  holdSeconds?: number;                     // 動作內停留秒數
  perSide?: boolean;                        // 「兩邊各…」
  resistance?: string;                      // 飛輪阻力，如 '0' / '極低'
  weightKg?: number;
  specText: string;                         // 原文，如 '每組 8-12 次'，顯示用
  note?: string;
}

/** 微型／備用課表：不綁星期，忙碌日可主動選用 */
export interface FallbackRoutine {
  id: Id;
  label: string;               // '10 分鐘微型彈性課表'
  when?: string;               // '忙碌日／晚煮飯時'
  estimatedMinutes: NumRange;
  items: StageItem[];          // 不分階段，直接列動作
}
```

### 2.4 打卡（型別在批次 A 先定義，UI 在批次 B）

```ts
export interface WorkoutLog {
  id: Id;
  date: DateString;
  planId: Id;
  planVersion: number;
  source: 'group' | 'fallback' | 'freeform';  // freeform = 非課表運動
  groupId?: Id;
  fallbackId?: Id;
  status: 'done' | 'partial' | 'rest';
  totalMinutes?: number;
  rpe?: number;                // 自覺強度 1–10
  note?: string;
  items: LogItem[];
  createdAt: string;
  updatedAt: string;
}

export interface LogItem {
  id: Id;
  stageItemId?: Id;   // 未填 = 臨時追加的項目
  exerciseId?: Id;
  name: string;       // 名稱快照，臨時項目亦有名字
  done: boolean;
  actualSets?: number;
  actualReps?: number;
  actualDurationSeconds?: number;
  actualWeightKg?: number;
  note?: string;
}
```

> 一天允許多筆 log（早上／晚上分開記錄），日曆顯示時聚合。

---

## 3. 資料層（`repository.ts` / `localRepository.ts`）

### 3.1 介面

**所有方法一律 async**，即使 localStorage 是同步的。
如此日後換成 `apiRepository`（axios）時，**所有 view 一行都不用改**。

```ts
export interface WorkoutRepository {
  // 動作庫
  listExercises(): Promise<ExerciseDef[]>;
  upsertExercise(input: Partial<ExerciseDef> & { name: string }): Promise<ExerciseDef>;

  // 課表
  listPlans(): Promise<WorkoutPlan[]>;
  getPlan(id: Id): Promise<WorkoutPlan | null>;
  /** 取得該日期生效的課表：effectiveFrom <= date 的最新版本 */
  getPlanForDate(date: DateString): Promise<WorkoutPlan | null>;
  savePlan(plan: WorkoutPlan): Promise<WorkoutPlan>;

  // 打卡（批次 A 只實作、不接 UI）
  listLogs(from: DateString, to: DateString): Promise<WorkoutLog[]>;
  getLogsByDate(date: DateString): Promise<WorkoutLog[]>;
  saveLog(log: WorkoutLog): Promise<WorkoutLog>;
  deleteLog(id: Id): Promise<void>;

  // 備份
  exportAll(): Promise<BackupFile>;
  importAll(backup: BackupFile): Promise<void>;
}
```

### 3.2 localStorage 儲存鍵

| Key | 內容 |
|---|---|
| `lineboxy.workout.meta` | `{ schemaVersion, lastBackupAt }` |
| `lineboxy.workout.exercises` | `ExerciseDef[]` |
| `lineboxy.workout.plans` | `WorkoutPlan[]` |
| `lineboxy.workout.logs` | `WorkoutLog[]` |

**容量評估**：課表約 10–15 KB／份，打卡約 0.3–0.6 KB／筆。
即使十年份資料也在 1 MB 以內，遠低於 5 MB 上限。

### 3.3 排程推導（`schedule.ts`，純函式、無副作用）

```ts
/** 該日期適用的群組；null = 休息日 */
getGroupForDate(plan, date): PlanGroup | null

/** 指定月份的「應運動日」清單與配額 */
getExpectedDays(plan, year, month): ExpectedDay[]
```

**`requirement` 判定規則**

- `'all'`（週一～五各組）：weekdays 中**每一天**各算 1 個應運動日，當天有 log 即達成。
- `'any-one'`（六或日）：以 **ISO 週**為單位，整組**該週只計 1 個應運動日配額**；
  該週涵蓋日（六、日）中**任一天**有 log 即達成。
- **跨月週的歸屬規則**：`any-one` 群組的週配額，歸屬於「該週內**第一個**涵蓋日」所在的月份。
  （例：某週六為 8/31、週日為 9/1，該配額計入 8 月。）

**達成率兩個指標**（批次 B 統計頁使用，批次 A 先實作函式）

| 指標 | 算法 |
|---|---|
| 達成率 | 實際達成的應運動日 / 該月應運動日總數 |
| 運動日佔比 | 實際有運動的日數 / 該月天數 |

當月分母一律計算到「今天」為止，避免月初百分比失真。

---

## 4. 匯入（`parsePlan.ts` + `WorkoutImportView.vue`）

### 4.1 流程

```
貼上 JSON  →  解析與驗證  →  七天攤平預覽 + 錯誤／警告報告  →  確認匯入
```

**不做「貼上即匯入」。** 中間的預覽是防止匯錯的關鍵一步。

### 4.2 驗證規則

**錯誤（阻擋匯入）**

1. JSON 無法解析 — 標示出錯位置
2. 必填欄位缺漏 — 逐欄位指出路徑，例如「`groups[1].stages[0].items[2]` 缺少 `name`」
3. `weekdays` 值不在 1–7
4. **群組之間 `weekdays` 重疊** — 指出是哪兩組、哪幾天衝突
5. `effectiveFrom` 非合法 `YYYY-MM-DD`

**警告（提示但不阻擋）**

6. 有星期未被任何群組涵蓋 → 視為休息日，明確列出是哪幾天
7. `requirement: 'any-one'` 但 `weekdays` 只有一天（設定無意義）
8. **各階段時間加總 ≠ 群組宣稱時長** — 並列顯示兩個數字
9. 群組沒有任何階段內容（合法，例如「家庭輕活動」）
10. `effectiveFrom` 早於現行課表版本的生效日
11. 動作缺少 `specText` 或 `steps`

### 4.3 動作庫比對

匯入時以**動作名稱**為 key 比對現有動作庫，預覽顯示：

```
動作庫比對：沿用既有 4 個、新增 6 個
⚠ 名稱相近但不同，請確認是否為同一動作：
   「胸部與手臂伸展」  vs  「坐姿胸部伸展」   [ 視為同一個 ] [ 分開建立 ]
```

名稱相近的判定不自動合併，一律由你按鈕確認。

### 4.4 七天攤平預覽（核心防呆）

```
週一        週二        週三        週四        週五        週六        週日
核心上肢    低阻心肺    核心上肢    低阻心肺    核心上肢    ← 家庭輕活動（擇一）→
30 分       30 分       30 分       30 分       30 分       20–30 分

微型彈性課表（忙碌日備用）：10 分鐘 · 4 個動作
```

`any-one` 群組在預覽中以橫跨的方式呈現，並標註「擇一」，
讓「哪天該做什麼」一眼可驗證。

---

## 5. 課表檢視（`WorkoutPlanView.vue`）

- 頂部：課表名稱、版次、生效日、版本切換下拉（可看歷史版本，唯讀）
- 七天總覽（沿用 `WeekOverview.vue`）
- 點某一天 → 展開該群組：防護重點 → 各階段（含循環組數、組間休息）→ 動作清單
- 點某個動作 → `ModalView` 彈窗顯示：英文名、器材、訓練部位、條列步驟、⚠️ 注意事項、規格、影片連結
- **影片連結可就地編輯補上**（寫回動作庫，全課表共享）
- 底部：醫療免責提醒

---

## 6. 主頁（`WorkoutView.vue`）

首屏即「今天」，這是使用頻率最高的路徑：

```
┌──────────────────────────────────────┐
│ 今天 · 7/27（週一）                  │
│ 核心與上肢強化 · 30 分鐘             │
│ ⚠ 完全不給膝蓋與腳踝壓力             │
│                                      │
│ [ 查看今日課表 ]  [ 開始打卡 ]※      │
│ [ 今天很忙 → 10 分鐘微型課表 ]※      │
└──────────────────────────────────────┘

現行課表：媽媽的無痛減脂與肌力啟動課表 v1（2026-07-27 起）
[ 檢視課表 ]  [ 匯入新課表 ]  [ 匯出備份 ]

上次備份：尚未備份 ⚠
```

※ 打卡按鈕在批次 A 先做成 disabled 佔位，批次 B 接上。

---

## 7. 備份匯出（`backup.ts`）

- 一鍵匯出整包 JSON（含 schemaVersion、動作庫、所有課表、所有打卡）
- 檔名 `lineboxy-workout-YYYY-MM-DD.json`
- 匯入備份時比對 `schemaVersion`，不符則提示
- 記錄 `lastBackupAt`，主頁顯示「上次備份：N 天前」，超過 30 天以警示色提醒

Pixel 10 + Chrome 沒有 iOS 的七天自動清除問題，但清除瀏覽資料、換機仍會遺失，
匯出功能在批次 A 就做完，避免辛苦匯入的課表憑空消失。

---

## 8. 程式風格約束

**不使用 `watch` / `watchEffect`。** 本功能目標是零 watch，做法：

| 情境 | 做法 |
|---|---|
| 登入後才載入資料 | 父層 `v-if="personStore.person.isActive"` 掛載子元件，子元件 `onMounted` 載入 |
| 選擇的日期／月份改變 | `computed` 從 `selectedDate` 衍生所有畫面資料 |
| 匯入文字改變後重新驗證 | 「驗證」按鈕的事件處理函式中明確呼叫，不自動觸發 |
| 切換課表版本 | 事件處理函式中呼叫 `repository.getPlan(id)` |

其餘沿用專案既有慣例：`@/` 別名匯入、PascalCase 元件檔名、
`TotalView.vue` 的卡片視覺樣式（`#0f766e` 主色、14px 圓角、白底卡片）。

> 註：`TotalView.vue` 現有的 `watch(person.isActive)` 為舊寫法，本功能不沿用。

---

## 9. 以實際課表驗證 schema

以「媽媽的無痛減脂與肌力啟動課表」實際對映：

### 9.1 群組

| 群組 | weekdays | requirement | estimatedMinutes | stages |
|---|---|---|---|---|
| 核心與上肢強化 | `[1,3,5]` | `all` | `{min:30}` | 3 |
| 低阻力平路心肺 | `[2,4]` | `all` | `{min:30}` | 4 ※ |
| 家庭輕活動／伸展 | `[6,7]` | **`any-one`** | `{min:20,max:30}` | 0（僅描述） |

※ 原文第二階段包含「平路心肺踩踏 10 分」與「椅子上半身肌力 10 分」兩個性質不同的區塊，
**拆成兩個獨立 stage**，避免多加一層巢狀。故為：熱身 / 平路心肺 / 椅子肌力 / 伸展 = 4 階段。

### 9.2 循環與組數並存的驗證

- 週一三五第二階段 → `Stage.rounds = {min:3, max:4}`、`restBetweenRoundsSeconds = {min:60, max:120}`
- 週二四椅子肌力 → `Stage.rounds` 不設，各動作 `StageItem.sets = 3`

**兩層組數概念皆有對應欄位，結構成立。**

### 9.3 規格型態的驗證

| 原文 | 對映 |
|---|---|
| 每組 10 次 | `measureType:'reps', sets:1, reps:{min:10}` |
| 每組 8-12 次 | `measureType:'reps', reps:{min:8, max:12}` |
| 每組 45 秒 | `measureType:'time', durationSeconds:45` |
| 頂端停留 2 秒 | `holdSeconds:2` |
| 兩邊各維持 30 秒 | `measureType:'hold', holdSeconds:30, perSide:true` |
| 阻力 0 | `resistance:'0'` |
| 順逆時針各 1.5 分鐘 | `measureType:'time', durationSeconds:180, note:'順逆時針各 1.5 分鐘'` |

**全數可表達。**

### 9.4 動作庫去重

不重複動作約 **10 個**，其中跨群組重複使用者：

- 椅子扶手伏地挺身 → 出現 3 處（週一三五、週二四、微型課表）
- 椅子坐姿拳擊 → 2 處
- 坐姿核心收縮 → 2 處
- 坐姿雙手繞環 → 2 處

**需人工確認的合併判斷（匯入時會跳出詢問）：**

1. 「溫和熱身踩踏」與「平路心肺踩踏」— 動作相同、阻力皆為 0，建議合併為「飛輪坐姿踩踏」，以規格區分
2. 「胸部與手臂伸展」與「坐姿胸部伸展」— 名稱相近，需確認是否同一動作

### 9.5 已知的原文數字矛盾（匯入時會出警告）

- 週二四總覽寫「拉伸 5 分鐘」，第三階段標題寫「伸展收尾（2 分鐘）」
- 第一階段標題「準備與熱身（8 分鐘）」，內文僅列 5 分鐘熱身內容
- 階段加總 8 + 20 + 2 = 30 ✓，但與敘述對不上

→ 由驗證規則 8 攔下，**顯示但不阻擋**，由你決定要不要回頭請 GEM 修正。

### 9.6 微型課表

`fallbackRoutines[0]`：4 個動作、10 分鐘，其中 3 個沿用動作庫既有定義。**成立。**

---

## 10. 給 Gemini GEM 的提示詞模板（附在匯入頁面，可一鍵複製）

```
請依下列 JSON schema 輸出運動課表，只輸出 JSON、不要加說明文字或 markdown 圍欄。

規則：
- weekdays 用 1=週一 … 7=週日
- 若某幾天是「擇一進行」，該群組設 requirement:"any-one"，否則 "all"
- 各群組的 weekdays 不可重疊；未列出的日子視為休息日
- 每個動作都要有 steps（條列步驟）、specText（規格原文）、
  以及 measureType（reps 次數型 / time 時間型 / hold 持續型）
- 防護與注意事項分兩層：群組層放 cautions，動作層也放 cautions
- 忙碌日的替代方案請放在 fallbackRoutines
- 每個動作請附一則 YouTube 參考影片連結（videoUrl），找不到則留空字串
- 每個動作請列出所需 equipment（器材）
- 請確認各階段時間加總等於群組宣稱的總時長

{ schema 內容 }

我的需求：{ 年齡 / 身體限制 / 可用器材 / 每次可運動時間 / 目標 }
```

模板會補齊你這次缺的兩項：**參考影片連結**與**結構化器材清單**。

---

## 11. 實作順序與驗收

| # | 項目 | 驗收方式 |
|---|---|---|
| 1 | `types.ts` | `pnpm type-check` 通過 |
| 2 | `repository.ts` + `localRepository.ts` | 可存取讀寫，重整後資料仍在 |
| 3 | `schedule.ts` | 以實際課表推導 7/1–7/31，`any-one` 週配額正確 |
| 4 | `parsePlan.ts` | 用實際課表 JSON 匯入成功；故意製造 weekdays 重疊時正確報錯 |
| 5 | 路由 + 導覽列 | `/workout` 可進入，未登入時不顯示頁籤 |
| 6 | `WeekOverview.vue` | 七天正確攤平，「六或日」顯示為擇一 |
| 7 | `WorkoutImportView.vue` | 貼上 → 預覽 → 確認的完整流程 |
| 8 | `WorkoutPlanView.vue` | 階段、循環組數、動作詳情、影片編輯皆可用 |
| 9 | `WorkoutView.vue` | 今天卡片正確顯示當日群組 |
| 10 | `backup.ts` | 匯出檔可重新匯入，資料一致 |

每項完成後執行 `pnpm lint` 與 `pnpm build`（專案無測試框架，以型別檢查與手動驗證為準）。

---

## 12. 批次 A 完成後的檢核點

匯入你的實際課表後，請確認：

1. 七天總覽與原文完全相符
2. 「六或日」顯示為擇一，不是兩天都要
3. 微型課表有被正確收錄
4. 動作庫去重結果合理（約 10 個動作）
5. 循環訓練 3–4 組、組間休息 1–2 分鐘有正確呈現
6. 防護重點在群組層與動作層都看得到

**若此時發現資料結構需要調整，成本接近零**（批次 B 尚未開始）。
確認無誤後再進入批次 B。

---

## 13. 後續批次（本計畫不含）

**批次 B**：打卡 checklist（含一鍵全部完成、微型課表選項、非課表運動、補打卡）、月曆檢視、休息日標示

**批次 C**：年檢視 heatmap 與達成率統計、課表版本 diff、動作進步趨勢圖

**批次 D**：接後端（新增 `apiRepository.ts`，views 不動）

---

## 14. 實作結果與與計畫的差異（2026-07-27 完成）

### 14.1 與計畫不同之處

| 項目 | 計畫 | 實際 | 原因 |
|---|---|---|---|
| 檔案 | 12 個 | 13 個，多出 `services/workout/display.ts` | `<script setup>` 不能 export 型別，`WeekGroup` / `DisplayItem` / `DisplayStage` 需放在 `.ts`；同時承載草稿與正式課表轉 Display 的對應函式 |
| 動作詳情彈窗 | 沿用 `ModalView.vue` | 自建 `ExerciseDetail.vue` | `ModalView` 是「欄位 → 文字輸入」的表單彈窗，無法呈現步驟、注意事項；視覺樣式仍沿用同一套 |
| 缺步驟警告 | 逐個動作 | 合併後彙整成一則 | 同名動作只要有一處提供步驟即可，逐項警告會對重複出現的動作誤報 |
| 名稱相似比對 | 只比對既有動作庫 | 同時比對同一份匯入中較早出現的動作 | 否則首次匯入（動作庫為空）永遠不會提示，正好漏掉「胸部與手臂伸展 vs 坐姿胸部伸展」這個實際案例 |
| 動作合併 | 未定義細節 | 合併只解析 id，不覆寫既有定義 | 被合併的那筆通常較不完整，覆寫會把正本的步驟洗掉（驗證時實際踩到） |

### 14.2 驗收結果

以 `doc/plan/2026-07-27-workout-sample-plan.json`（實際課表轉成的 JSON）驗證：

| 檢核 | 結果 |
|---|---|
| 型別檢查 / ESLint / production build | 全部通過 |
| 匯入驗證 | `ok: true`，2 則警告（週六日群組無階段內容、11 個動作未附影片）— 皆為預期 |
| 群組推導 | 核心與上肢強化 `週一、三、五 / all / 3 階段`；低阻力平路心肺 `週二、四 / all / 4 階段`；家庭輕活動 `週六、日 / any-one / 0 階段` |
| 動作庫去重 | 11 個不重複動作；合併「坐姿胸部伸展」後為 10 個，且引用正確重指、正本步驟未被覆寫 |
| 微型課表 | 正確收錄，4 個動作 |
| 生效日 | 2026-07-26 查不到課表、2026-08-01 查得到 v1 |
| `any-one` 週配額 | 2026-08 共 5 個週配額，anchor 為每週六；day 配額 21 個 |
| 跨月週歸屬 | 8/1（週六）的配額計入 8 月、未重複計入 7 月 |
| 達成率 | 以 8/12 為今天、5 筆紀錄 → 達成率 5/9 = 55.6%、運動日佔比 5/12 = 41.7%（未結束的配額正確排除） |
| 錯誤路徑 | 故意讓週三重疊 → `ok: false`，並指出是哪兩組、哪一天 |
| 警告路徑 | 故意讓階段加總變 33 分 → 正確提示與宣稱的 30 分不符 |
| 打卡鎖定 | 打卡後 `locked: true`，再次 `savePlan` 被擋下 |
| 二次匯入 | 版次自動遞增為 v2，10 個動作全部沿用 |
| 備份往返 | 匯出後清空再還原，課表與動作數一致 |

### 14.3 尚待人工確認（批次 A 驗收）

實際在瀏覽器操作後，請確認計畫第 12 節的六個檢核點。另外兩項與 GEM 相關：

1. `坐姿胸部伸展` 與 `胸部與手臂伸展` 是否為同一動作 — 匯入時會跳出選項
2. 11 個動作皆未附影片，可於課表詳情頁逐一補上，或用匯入頁的提示詞模板請 GEM 重出

---

## 15. 追加：補登舊紀錄（2026-07-27，批次 A+）

使用者在批次 A 完成後提出：課表雖然今天才匯入，但上週已經做了幾天運動，
希望能補登並連結到這份課表。為此提前實作簡易版打卡（完整 checklist 仍留在批次 B）。

### 15.1 設計要點

**問題**：課表生效日為匯入當天，上週的日期落在生效日之前，
`getPlanForDate` 會回傳 null，補登的紀錄無從連結。

**解法**：讓生效日可往前調整，而不是讓打卡自由指定課表。
「這份課表上週就已經在做」在語意上就等於生效日更早，維持「依生效日推導」的單一模型。

**生效日可在鎖定後調整**：新增 `updateEffectiveFrom()`，刻意繞過 `savePlan` 的鎖定檢查。
生效日不是課表內容，既有打卡以 `planId` 硬連結，調整不會竄改任何歷史紀錄。
若不開放，使用者只要先打了今天的卡就再也無法往前調，是很容易踩到的死路。

**`WorkoutLog.planId` 改為選填**：自由運動且當天沒有任何生效課表時為空。

### 15.2 異動

| 檔案 | 異動 |
|---|---|
| `types.ts` | `planId` / `planVersion` 改為選填 |
| `repository.ts` / `localRepository.ts` | 新增 `updateEffectiveFrom()`；`saveLog` 的鎖定改為有 `planId` 才觸發 |
| `schedule.ts` | 新增 `listRecentDates()` |
| `views/WorkoutLogView.vue` | 新增。日期選擇（不可選未來）、來源選擇（當日課表／備用課表／自由運動）、完成狀況、耗時、備註、儲存與刪除 |
| `views/WorkoutView.vue` | 打卡按鈕改為實際連結；新增「最近 14 天」補登列 |
| `views/WorkoutPlanView.vue` | 新增生效日調整 |
| `router/index.ts` | 新增 `/workout/log` |

### 15.3 驗證結果

以 2026-07-27 為今天、生效日 7/27 的課表：

| 檢核 | 結果 |
|---|---|
| 補登前 | 7/20、7/22、7/25 皆查不到課表 |
| 生效日調到 7/20 後 | 7/19 無課表；7/20、7/22 → 核心與上肢強化；7/25 → 家庭輕活動（擇一） |
| 補登 7/20、7/22、7/24 | 三筆皆正確連結群組，課表隨即 `locked` |
| 鎖定後再調生效日 | 成功，且既有紀錄仍指向同一 `planId` |
| 最近 14 天列 | 已記錄／未記錄／休息日／無課表四種狀態正確呈現 |
| 7 月統計 | 達成率 3/6 = 50.0%、運動日佔比 3/27 = 11.1% |
| 自由運動 | 無課表日可記錄，`planId` 為空且不觸發鎖定 |

---

## 16. 工作量估計

批次 A 約 **12 個新檔案 + 2 個既有檔案修改**（router、IndexView）。
主體可於一個完整工作階段內完成；實際掛鐘時間取決於 UI 微調的來回次數，
預期需 1–2 次審查回合。
