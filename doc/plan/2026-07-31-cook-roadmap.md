# 獺廚娘紀錄 — 現況與後續路線圖（交付文件）

> 狀態：進行中 — **批次 A 設計確認，尚未實作**
> 建立日期：2026-07-31
> 最後更新：2026-07-31
> 用途：**交付給新的 session 接手**。本文件力求自足，接手者不需要前面的對話脈絡。
> 前提：純前端實作，資料存 localStorage；後端另一個 repo，日後再接。
> 相關文件：[2026-07-28-workout-roadmap.md](2026-07-28-workout-roadmap.md)（工作慣例與專案脈絡，本功能沿用）

---

## 文件維護慣例

本文件是**活文件**，描述「現在長什麼樣、下一步做什麼」，每個批次實作完成後更新，
過時內容直接覆寫或刪除，不累積歷史。

各批次的**實作紀錄另立文件**，完成驗收後放 `doc/plan/done/YYYY-MM-DD-cook-batch-X.md`，
內容為當批的詳細設計 + 「與計畫的差異及原因」 + 驗收結果，之後不再修改。
本文件只留一行連結指向它。

> 分工原則：**roadmap 描述「現在」，done 文件描述「當時」。**
> 一份可覆寫、一份凍結。

**批次 A 完成時的處理**：把本文件第 1–8、10–12 節（批次 A 的詳細設計）連同實作紀錄
搬到 `done/2026-07-31-cook-batch-a.md`，本文件瘦身為現況摘要 + 資料模型概要 + 後續批次。

---

## 0. 前置決策（已與使用者確認）

| 項目 | 決議 | 理由 |
|---|---|---|
| **時段歸屬** | 放在**烹飪紀錄**（`CookLog`），不放在食譜 | 同一道菜可能早餐也煮、晚餐也煮；隨機推薦與統計都需要日期，食譜上沒有日期。食譜的 `mealTags` 由紀錄自動累積 |
| **食材主檔** | 建 `Ingredient` 主檔，食譜只存引用 | 自動完成查主檔而非掃全部食譜；可掛預設單位與使用次數 |
| 自動完成門檻 | **不設門檻**，第一次輸入就進主檔，以 `usageCount` 排序 | 門檻會讓第二次輸入時因忘記全名而打錯字，反而製造重複資料 |
| 食材 vs 調味料 | 共用型別，以 `kind: 'food' \| 'seasoning'` 區分 | UI 分兩區、單位候選不同，但資料層與自動完成邏輯只寫一份 |
| 單位 | 建單位表，存換算到基準單位的係數；自由輸入的單位不換算 | 「累積食材用量」的成敗全在單位，事後補做要回頭改所有既有資料 |
| 步驟鎖定 | **純 UI 狀態，不進 localStorage** | 只是防手滑；存進資料層會多一個欄位，且舊資料的預設值無從決定 |
| 步驟編號 | 存 `string[]`，編號由 index 推導 | 刪除中間步驟時不需重編號 |
| YouTube | 用 `img.youtube.com` 縮圖 + 一般連結開啟，**不嵌 iframe** | 不需 API key；手機會自動由 YT App 接手；iframe 在 PWA 內體驗差且吃流量 |
| Google 日曆 | **v1 不做**，改自製月曆檢視 | 純前端串 Calendar 需 OAuth token 存瀏覽器，到期就壞；日曆是顯示層不是儲存層，串了等於維護兩份真相 |
| Workout 連動 | 做成**存檔後提示**，非自動寫入，分鐘數可改 | 自動寫入會污染運動達成率統計，且 60 分鐘是猜的 |
| 份量倍率 | 做（`servingMultiplier`，預設 1） | 同一份食譜煮兩倍份量時食材統計才會準 |
| 今天煮什麼 | 加權隨機，最近煮過的降權 | 純隨機很快會重複推到同一道 |
| 程式風格 | 沿用 Workout：**不用 `watch` / `watchEffect`** | 見 roadmap 第 0 節 |

---

## 1. 目錄與檔案配置

```
src/services/cook/
  types.ts             型別定義（唯一真相來源）
  repository.ts        CookRepository 介面
  localRepository.ts   批次 A 實作：localStorage
  migrate.ts           schema 版本遷移
  units.ts             單位表與換算（純函式）
  youtube.ts           解析影片 id、產生縮圖與播放連結（純函式）
  suggest.ts           食材自動完成排序（純函式，批次 A）
  recommend.ts         今天煮什麼的加權隨機（純函式，批次 B）
  backup.ts            匯出／匯入整包備份

src/views/
  CookView.vue             頁籤主頁（今天煮什麼 + 食譜列表 + 各入口）
  CookRecipeView.vue       食譜詳細檢視（唯讀）
  CookRecipeEditView.vue   食譜新增／編輯
  CookLogView.vue          烹飪紀錄（批次 B）

src/components/cook/
  IngredientInput.vue    食材名稱輸入 + 自動完成 + 數量單位
  StepEditor.vue         步驟區塊（新增／鎖定／編輯／刪除）
  RecipeCard.vue         列表用的食譜卡片
  SourceLink.vue         參考來源（YT 縮圖或一般連結）
```

**路由**（`src/router/index.ts` 新增，皆為 `IndexView` 的子路由）

| 路徑 | 元件 | 批次 |
|---|---|---|
| `/cook` | `CookView.vue` | A |
| `/cook/recipe/new` | `CookRecipeEditView.vue` | A |
| `/cook/recipe/:id` | `CookRecipeView.vue` | A |
| `/cook/recipe/:id/edit` | `CookRecipeEditView.vue` | A |
| `/cook/log` | `CookLogView.vue` | B |

**導覽列**（`IndexView.vue`）在 `person.isActive` 區塊新增「獺廚娘」連結，
active 判定沿用既有寫法：`route.path.startsWith('/cook')`。

---

## 2. 型別定義（`types.ts`）

### 2.1 共用

```ts
/** 目前的資料格式版本，日後遷移用 */
export const COOK_SCHEMA_VERSION = 1;

/** 'YYYY-MM-DD'，一律以本地時區產生 */
export type DateString = string;

/** crypto.randomUUID() 產生的字串 id */
export type Id = string;

/** 時段。屬於「紀錄」，不屬於食譜 */
export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'lateNight' | 'snack';
```

`MealSlot` 的中文標籤（早／午／晚／消夜／點心）與顯示順序集中定義在 `types.ts`，
避免每個畫面各自硬寫一份對照表。

### 2.2 食材主檔

比照 Workout 的 `ExerciseDef`：獨立於食譜，跨食譜以名稱共用同一筆。
屬「參考資料」，允許修改（改名、調整預設單位）。

```ts
export interface Ingredient {
  id: Id;
  name: string;
  kind: 'food' | 'seasoning';
  /** 上次使用的單位，下次輸入時預選 */
  defaultUnit?: string;
  /** 被食譜引用的次數，自動完成的排序依據 */
  usageCount: number;
  lastUsedAt: string;
  createdAt: string;
  updatedAt: string;
}
```

> `usageCount` 在食譜存檔時重算（掃該食譜的引用做增減），不是每次輸入就 +1，
> 否則編輯同一張食譜三次會讓次數虛增。

### 2.3 食譜

```ts
/** 食譜中對食材的引用 + 用量 */
export interface RecipeIngredient {
  id: Id;
  ingredientId: Id;
  /** 名稱快照。主檔改名不影響歷史食譜的顯示 */
  nameSnapshot: string;
  kind: 'food' | 'seasoning';
  /** 未填 = 「適量」 */
  amount?: number;
  /** 單位代碼，或使用者自由輸入的字串 */
  unit?: string;
  note?: string;
}

export interface RecipeSource {
  url: string;
  title?: string;
  /** 由 url 解析而得，非 YT 連結則為空 */
  youtubeId?: string;
}

export interface Recipe {
  id: Id;
  schemaVersion: number;
  /** 菜名 */
  name: string;
  ingredients: RecipeIngredient[];   // kind 兩種混存，UI 分區顯示
  steps: string[];
  sources: RecipeSource[];
  note?: string;
  /**
   * 時段標籤。**由 CookLog 自動累積**，非手動輸入。
   * 用於「輸入『早』推薦早餐食譜」與今天煮什麼的篩選。
   */
  mealTags: MealSlot[];
  /** 被煮過的次數與最後一次日期，供加權隨機與列表排序 */
  cookCount: number;
  lastCookedAt?: DateString;
  createdAt: string;
  updatedAt: string;
}
```

> **食譜可修改**（打錯字、補步驟、加影片），與 Workout 的課表不同。
> 因為烹飪紀錄記的是「我煮了這道菜」，不是「我照這個版本的規格執行」，
> 事後修食譜不會讓歷史紀錄失真。故不需要 `locked` 與版本機制。

### 2.4 烹飪紀錄（型別在批次 A 定義，UI 在批次 B）

```ts
export interface CookLog {
  id: Id;
  date: DateString;
  meal: MealSlot;
  recipeId: Id;
  /** 食譜名稱快照，食譜被刪除後紀錄仍可讀 */
  nameSnapshot: string;
  /** 份量倍率，預設 1。食材用量統計時相乘 */
  servingMultiplier: number;
  note?: string;
  createdAt: string;
  updatedAt: string;
}
```

一天允許多筆（三餐各一筆、同一餐煮兩道也各一筆）。

### 2.5 設定與備份

```ts
export interface CookSettings {
  /** 晚餐紀錄後提示打卡「煮飯」 */
  workoutSyncEnabled: boolean;
  /** 提示中預填的分鐘數，預設 60 */
  workoutSyncMinutes: number;
  /** 哪些時段觸發提示，預設 ['dinner'] */
  workoutSyncMeals: MealSlot[];
}

export interface CookBackupFile {
  schemaVersion: number;
  exportedAt: string;
  ingredients: Ingredient[];
  recipes: Recipe[];
  logs: CookLog[];
  settings: CookSettings;
}
```

---

## 3. 單位表（`units.ts`）

純函式模組，無狀態。

```ts
export type UnitCategory = 'weight' | 'volume' | 'count';

export interface UnitDef {
  code: string;        // 'jin'
  label: string;       // '臺斤'
  category: UnitCategory;
  /** 換算到該分類基準單位的係數。count 類為 undefined */
  factor?: number;
}
```

| 分類 | 基準 | 內容 |
|---|---|---|
| `weight` | g | 公克 1、公斤 1000、**臺斤 600**、**兩 37.5**、磅 453.6 |
| `volume` | ml | 毫升 1、公升 1000、大匙 15、小匙 5、茶匙 5、杯 240 |
| `count` | 無 | 顆、粒、片、把、株、束、根、隻、包、罐、盒（**各自獨立統計，不互換**） |

**自由輸入的單位**：存原字串，視為 `count` 且無 `factor`，統計時單獨成列。

食材輸入區的單位候選清單依 `kind` 而異：

- `food` → 公克、臺斤、顆、把、片…
- `seasoning` → 大匙、小匙、毫升、公克、適量

「適量」以 `amount` 留空表達，不是一個單位。

---

## 4. 資料層（`repository.ts` / `localRepository.ts`）

**所有方法一律 async**，即使 localStorage 是同步的——日後換 `apiRepository` 時畫面層不必改。

```ts
export interface CookRepository {
  // 食材主檔
  listIngredients(): Promise<Ingredient[]>;
  /** 依 id 更新，或依 name + kind 建立／沿用既有食材 */
  upsertIngredient(input: Partial<Ingredient> & { name: string; kind: Ingredient['kind'] }): Promise<Ingredient>;

  // 食譜
  listRecipes(): Promise<Recipe[]>;          // 由新至舊
  getRecipe(id: Id): Promise<Recipe | null>;
  saveRecipe(recipe: Recipe): Promise<Recipe>;   // 內含 usageCount 重算
  deleteRecipe(id: Id): Promise<void>;

  // 烹飪紀錄（批次 A 只實作、不接 UI）
  listLogs(from: DateString, to: DateString): Promise<CookLog[]>;
  getLogsByDate(date: DateString): Promise<CookLog[]>;
  saveLog(log: CookLog): Promise<CookLog>;       // 內含 mealTags / cookCount 回填
  deleteLog(id: Id): Promise<void>;

  // 設定
  getSettings(): Promise<CookSettings>;
  saveSettings(settings: CookSettings): Promise<CookSettings>;

  // 備份
  exportAll(): Promise<CookBackupFile>;
  importAll(backup: CookBackupFile): Promise<void>;
}
```

### 4.1 localStorage 儲存鍵

| Key | 內容 |
|---|---|
| `lineboxy.cook.meta` | `{ schemaVersion, lastBackupAt }` |
| `lineboxy.cook.ingredients` | `Ingredient[]` |
| `lineboxy.cook.recipes` | `Recipe[]` |
| `lineboxy.cook.logs` | `CookLog[]` |
| `lineboxy.cook.settings` | `CookSettings` |

**容量評估**：食譜約 1–2 KB／份、紀錄約 0.2 KB／筆。
一千道食譜加十年三餐紀錄約 4 MB，接近 5 MB 上限但實務上不會達到；
匯出功能在批次 A 就做完，是唯一的保險。

### 4.2 兩個「回填」的副作用（刻意集中在 repository）

**`saveRecipe`**：比對舊版與新版的 `ingredients`，對主檔做 `usageCount` 增減，
並更新 `defaultUnit` 與 `lastUsedAt`。新出現的食材名稱在此建立主檔。

**`saveLog`**：把 `meal` 併入該食譜的 `mealTags`（去重），
`cookCount` +1、更新 `lastCookedAt`。刪除紀錄時反向處理。

> 放在 repository 而非 view，是為了讓日後的 `apiRepository` 有機會改成後端一次交易完成，
> 而畫面層不必知道有這回事。

### 4.3 食材自動完成（`suggest.ts`）

純函式：`suggestIngredients(all, keyword, kind): Ingredient[]`

排序規則（依序）：

1. **前綴命中**優先於中間命中（輸入「韭」時「韭菜」排在「韭黃炒蛋用韭黃」之前）
2. 同類命中內，`usageCount` 高者優先
3. 再同分，`lastUsedAt` 新者優先

只比對同 `kind` 的食材，且不做模糊比對（注音／錯字容錯不做，成本高效益低）。

---

## 5. 食譜編輯（`CookRecipeEditView.vue`）

### 5.1 版面（手機優先，單欄）

```
┌──────────────────────────────────────┐
│ 菜名  [                            ] │
├──────────────────────────────────────┤
│ 食材                                 │
│  [ 韭菜        ][ 200 ][ 公克 ▾] [×] │
│  [ 豬絞肉      ][ 半  ][ 臺斤 ▾] [×] │
│  [ + 新增食材 ]                      │
├──────────────────────────────────────┤
│ 調味料                               │
│  [ 醬油        ][ 2   ][ 大匙 ▾] [×] │
│  [ + 新增調味料 ]                    │
├──────────────────────────────────────┤
│ 步驟                                 │
│  1. [ 韭菜洗淨切段            ] [✓]  │
│  2. 豬絞肉加醬油抓醃       [編輯][×] │
│  [ + 新增步驟 ]                      │
├──────────────────────────────────────┤
│ 參考來源                             │
│  [ https://youtu.be/xxxx      ] [×]  │
│  ┌────────┐                          │
│  │ 縮圖   │ 點擊開啟 YouTube         │
│  └────────┘                          │
│  [ + 新增來源 ]                      │
├──────────────────────────────────────┤
│ 備註  [                            ] │
├──────────────────────────────────────┤
│         [ 取消 ]      [ 儲存 ]       │
└──────────────────────────────────────┘
```

### 5.2 步驟區塊的三個按鈕

| 狀態 | 顯示 | 行為 |
|---|---|---|
| 編輯中 | 輸入框 + `✓ 完成` | 按下後轉為唯讀，防止誤觸 |
| 已鎖定 | 純文字 + `編輯` + `刪除` | `編輯` 轉回輸入中；`刪除` 需二次確認（沿用 `ConfirmModalView.vue`） |

- 新增步驟時，新的那一格自動進入編輯中並取得 focus
- 鎖定狀態存在元件的 `ref<boolean[]>`，**不進 localStorage**
- 從既有食譜載入編輯時，所有步驟預設為**已鎖定**（避免誤刪已寫好的內容）
- 儲存時若仍有編輯中的步驟，內容照樣寫入，不強制先按完成

### 5.3 離開頁面的保護

有未儲存變更時，`onBeforeRouteLeave` 跳確認。手機上最容易發生的資料遺失就是誤觸返回。

---

## 6. YouTube 處理（`youtube.ts`）

```ts
/** 支援 youtu.be/xxx、watch?v=xxx、shorts/xxx、embed/xxx */
parseYoutubeId(url: string): string | null

/** https://img.youtube.com/vi/{id}/hqdefault.jpg */
youtubeThumbnail(id: string): string

/** https://www.youtube.com/watch?v={id} */
youtubeWatchUrl(id: string): string
```

- 縮圖以 `<img>` 直接載入，不需 API key
- 點擊縮圖 → 一般 `<a target="_blank">`，Android 會由 YouTube App 接手
- 縮圖載入失敗（影片已下架）時退回顯示連結文字，不留破圖
- 非 YT 連結：顯示網域名 + 標題（若使用者有填），不抓 og:image（需 CORS proxy，v1 不做）

---

## 7. 主頁（`CookView.vue`）

```
┌──────────────────────────────────────┐
│ 今天煮什麼？                         │
│ [早][午][晚][消夜][點心]             │
│ ──────────────────────────────────── │
│ 韭菜豬肉水餃                         │
│ 上次煮：7/12                         │
│ [ 換一道 ]  [ 看食譜 ]               │
└──────────────────────────────────────┘

[ + 新增食譜 ]

食譜（23 道）                  [ 搜尋 ]
┌──────────────────────────────────────┐
│ 韭菜豬肉水餃          晚 · 煮過 4 次 │
│ 番茄炒蛋              午晚 · 煮過 9 次│
│ …                                    │
└──────────────────────────────────────┘

[ 每日紀錄 ]  [ 匯出備份 ]
上次備份：尚未備份 ⚠
```

- 「今天煮什麼」在批次 A 先做成 disabled 佔位，批次 B 接上（需要 `CookLog` 才有加權依據）
- 食譜列表**由新至舊**（`createdAt` 倒序），搜尋比對菜名與食材名稱
- 備份提醒沿用 Workout 的做法：超過 30 天以警示色顯示

---

## 8. 匯出備份（`backup.ts`）

- 一鍵匯出整包 JSON，檔名 `lineboxy-cook-YYYY-MM-DD.json`
- 匯入時比對 `schemaVersion`：低於目前 → 跑 migrate；高於目前 → 擋下並提示更新 app
- 記錄 `lastBackupAt`

比照 `services/workout/backup.ts`，但**維持兩包獨立**（`lineboxy-workout-*.json` /
`lineboxy-cook-*.json`），不合併成單一備份檔。理由：兩個功能的 schema 版本各自演進，
合併後任一方升版都要動到另一方的匯入邏輯。日後若真的需要「全 app 備份」，
再包一層呼叫兩者的 `exportAll()` 即可，不必現在耦合。

---

## 9. 為後端預留的約定

後端本身的設計（API 格式、資料表、同步衝突解法）**不在本文件範圍**，
留到實際要做時再依當時的後端狀況生成。但下列五點**現在不做，日後補的成本很高**，
因為屆時資料已經躺在 localStorage 裡：

| 約定 | 原因 |
|---|---|
| id 一律 `crypto.randomUUID()`，不用流水號 | 離線建立的資料與後端合併時不會撞號 |
| repository 所有方法 async | 換成 HTTP 實作時畫面層一行都不用改 |
| 每筆資料帶 `createdAt` / `updatedAt`（ISO 字串） | 同步時的衝突判定依據；事後補要替舊資料編造假時間 |
| `schemaVersion` + `migrate.ts` 從第一版就有 | 沒有遷移機制的資料等同無法演進 |
| 日期一律 `DateString`（本地時區的 `YYYY-MM-DD`），不存 `Date` 或 ISO | 「7/31 的晚餐」是本地概念，轉 UTC 會跨日 |

---

## 10. 程式風格約束

沿用 Workout（見 roadmap 第 0 節）。**不使用 `watch` / `watchEffect`**：

| 情境 | 做法 |
|---|---|
| 登入後才載入資料 | 父層 `v-if="personStore.person.isActive"` 掛載，子元件 `onMounted` 載入 |
| 食材輸入的自動完成 | `computed` 從 `keyword` + 已載入的主檔清單衍生 |
| 搜尋食譜 | `computed` 過濾，不打 repository |
| 步驟鎖定狀態 | 元件內 `ref`，事件處理函式直接改 |
| 儲存後回列表 | 事件處理函式中 `router.push`，不靠 watch 路由 |

視覺沿用 `TotalView.vue` 的卡片樣式（14px 圓角、白底卡片），
主色可與 Workout 的 `#0f766e` 區隔，讓兩個頁籤一眼可辨。

---

## 11. 實作順序與驗收

| # | 項目 | 驗收方式 |
|---|---|---|
| 1 | `types.ts` + `units.ts` | `pnpm type-check` 通過；臺斤→公克、大匙→毫升換算正確 |
| 2 | `repository.ts` + `localRepository.ts` + `migrate.ts` | 可讀寫，重整後資料仍在 |
| 3 | `suggest.ts` | 輸入「韭」時前綴命中排在中間命中之前；常用者排前面 |
| 4 | `youtube.ts` | 四種 YT 網址格式皆能解出 id；非 YT 連結回 null |
| 5 | 路由 + 導覽列 | `/cook` 可進入，未登入時不顯示頁籤 |
| 6 | `IngredientInput.vue` | 自動完成可選取；自由輸入單位可用；「適量」可表達 |
| 7 | `StepEditor.vue` | 新增／鎖定／編輯／刪除四種操作皆正確，編號連續 |
| 8 | `CookRecipeEditView.vue` | 完整新增一道食譜並儲存；重新編輯時內容完整帶回 |
| 9 | `CookRecipeView.vue` | 唯讀顯示正確；YT 縮圖可載入並開啟 |
| 10 | `CookView.vue` | 列表由新至舊；搜尋可比對菜名與食材 |
| 11 | `backup.ts` | 匯出檔可重新匯入，食材／食譜／紀錄數一致 |

每項完成後執行 `pnpm lint` 與 `pnpm build`（專案無測試框架，以型別檢查與手動驗證為準）。

---

## 12. 批次 A 完成後的檢核點

實際在手機上輸入 3–5 道你常煮的菜，確認：

1. 食材自動完成在第二道菜就能派上用場
2. 常用單位的候選清單夠用，很少需要自由輸入
3. 步驟輸入在手機鍵盤彈出時不會被遮住
4. YT 縮圖載入速度可接受
5. 一道菜從按下「新增食譜」到儲存完成，操作次數不會讓人不想記

**若此時發現資料結構需要調整，成本接近零**（批次 B 尚未開始）。
第 5 點特別重要——記錄類 app 的死因幾乎都是輸入太累。

---

## 13. 後續批次（批次 A 不含）

### 批次 B：烹飪紀錄與推薦

- `CookLogView.vue`：日期 + 時段 + 選食譜 + 份量倍率 + 備註
- 月曆檢視：每格顯示當日煮了什麼，點擊看當日全部紀錄
- 「今天煮什麼」加權隨機（`recommend.ts`）：
  依 `mealTags` 篩選時段 → 3 天內煮過的排除、7 天內煮過的權重減半 → 加權抽取
- 補登過去日期的紀錄（比照 Workout 的「最近 14 天」）

### 批次 C：Workout 連動與食材統計

**連動打卡**（`services/cook/workoutSync.ts`，依賴方向嚴格單向 cook → workout）

- `CookLog` 存檔後，若 `settings.workoutSyncEnabled` 且 `meal` 在 `workoutSyncMeals` 中，
  跳確認彈窗「要順便打卡『煮飯 60 分鐘』嗎？」，分鐘數可改
- 確認後呼叫 `workoutRepository.saveLog()` 建 `source: 'freeform'` 的紀錄
- **需要 Workout schema v3**：`WorkoutLog` 新增 `origin?: 'cook'` 與 `originRefId?: Id`
  - **冪等**：存檔前先查當日有無同 `origin` 的紀錄，有就更新不新增
    （否則同一天編輯兩次晚餐就會打兩次卡）
  - **刪除**：刪掉烹飪紀錄時連帶收回對應打卡，但僅限 `origin === 'cook'`
    且使用者未手動編輯過（以 `updatedAt` 是否被改動判定）
- `workout` 模組**不得** import `cook` 模組的任何東西

**食材用量統計**

- 指定期間內各食材的用量加總（`amount × servingMultiplier`，依單位分類換算）
- 不可換算的自由單位單獨成列
- 時段分布、最常煮的菜、最久沒煮的菜

### 批次 D：接後端

新增 `apiRepository.ts`，views 不動。詳細設計屆時另行生成，
現階段只需遵守第 9 節的五點約定。
