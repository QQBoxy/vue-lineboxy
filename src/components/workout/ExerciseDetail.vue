<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { DisplayItem } from '@/services/workout/display';
import { popModal, pushModal } from '@/utils/modalStack';

interface Props {
  item: DisplayItem;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  close: [];
  'update-video': [exerciseId: string, videoUrl: string];
}>();

const router = useRouter();

const editingVideo = ref(false);
const videoInput = ref('');

const startEditVideo = () => {
  videoInput.value = props.item.videoUrl ?? '';
  editingVideo.value = true;
};

const cancelEditVideo = () => {
  editingVideo.value = false;
};

const submitVideo = () => {
  if (!props.item.exerciseId) return;
  emit('update-video', props.item.exerciseId, videoInput.value.trim());
  editingVideo.value = false;
};

const handleClose = () => {
  emit('close');
};

const goToTrend = () => {
  handleClose();
  if (props.item.exerciseId) {
    router.push(`/workout/trend/${props.item.exerciseId}`);
  }
};

/** 編輯影片連結時，Esc 先取消編輯，避免打了一半的網址被一鍵清掉 */
const handleEscape = () => {
  if (editingVideo.value) {
    cancelEditVideo();
    return;
  }
  handleClose();
};

// 呼叫端以 v-if 控制掛載，所以「掛載中」等同「彈窗開著」
const modalEntry = { onEscape: handleEscape };
onMounted(() => pushModal(modalEntry));
onUnmounted(() => popModal(modalEntry));
</script>

<template>
  <teleport to="body">
    <div class="modal-overlay" @click.self="handleClose">
      <div class="modal-card">
        <header class="modal-head">
          <div>
            <h2>{{ props.item.name }}</h2>
            <p v-if="props.item.nameEn" class="name-en">{{ props.item.nameEn }}</p>
          </div>
          <div class="head-actions">
            <button v-if="props.item.exerciseId" class="trend-btn" type="button" @click="goToTrend">
              📈 趨勢
            </button>
            <button class="close-btn" type="button" @click="handleClose">✕</button>
          </div>
        </header>

        <section class="spec-row">
          <span class="spec-badge">{{ props.item.specText || '未提供規格' }}</span>
          <span v-if="props.item.perSide" class="tag">兩邊各做</span>
          <span v-if="props.item.resistance" class="tag">阻力 {{ props.item.resistance }}</span>
        </section>

        <section v-if="props.item.targetMuscles.length > 0" class="detail-section">
          <h3>訓練部位</h3>
          <div class="chip-row">
            <span v-for="muscle in props.item.targetMuscles" :key="muscle" class="chip">
              {{ muscle }}
            </span>
          </div>
        </section>

        <section v-if="props.item.equipment.length > 0" class="detail-section">
          <h3>所需設備</h3>
          <div class="chip-row">
            <span v-for="tool in props.item.equipment" :key="tool" class="chip chip-neutral">
              {{ tool }}
            </span>
          </div>
        </section>

        <section v-if="props.item.steps.length > 0" class="detail-section">
          <h3>動作步驟</h3>
          <ol class="step-list">
            <li v-for="(step, index) in props.item.steps" :key="index">{{ step }}</li>
          </ol>
        </section>

        <section v-if="props.item.cautions.length > 0" class="detail-section caution-section">
          <h3>⚠️ 注意事項</h3>
          <ul class="caution-list">
            <li v-for="(caution, index) in props.item.cautions" :key="index">{{ caution }}</li>
          </ul>
        </section>

        <section class="detail-section">
          <h3>參考影片</h3>
          <template v-if="editingVideo">
            <input
              v-model="videoInput"
              class="field-input"
              type="url"
              placeholder="https://www.youtube.com/watch?v=..."
            />
            <div class="edit-actions">
              <button class="action-btn" type="button" @click="submitVideo">儲存</button>
              <button class="action-btn action-btn-outline" type="button" @click="cancelEditVideo">
                取消
              </button>
            </div>
          </template>
          <template v-else>
            <a
              v-if="props.item.videoUrl"
              class="video-link"
              :href="props.item.videoUrl"
              target="_blank"
              rel="noopener noreferrer"
            >
              🎬 開啟影片
            </a>
            <p v-else class="empty-hint">尚未設定參考影片。</p>
            <button
              v-if="props.item.exerciseId"
              class="action-btn action-btn-outline"
              type="button"
              @click="startEditVideo"
            >
              {{ props.item.videoUrl ? '修改連結' : '新增連結' }}
            </button>
            <p v-else class="empty-hint">（匯入完成後即可編輯影片連結）</p>
          </template>
        </section>
      </div>
    </div>
  </teleport>
</template>

<style scoped>
.modal-overlay {
  backdrop-filter: blur(5px);
  background: rgba(15, 23, 42, 0.22);
  position: fixed;
  inset: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
  padding: 1rem;
}

.modal-card {
  width: min(560px, 100%);
  max-height: 88vh;
  overflow-y: auto;
  /* 捲到頂／底後不要把捲動事件傳給底層頁面 */
  overscroll-behavior: contain;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 1rem;
  box-shadow: 0 6px 22px -16px rgba(15, 23, 42, 0.38);
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  color: #1f2937;
}

.modal-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.6rem;
}

.modal-head h2 {
  margin: 0;
  font-size: 1.15rem;
  color: #0f172a;
}

.name-en {
  margin: 0.2rem 0 0;
  font-size: 0.85rem;
  color: #64748b;
}

.head-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.trend-btn {
  border: 1px solid #0f766e;
  background: #f0fdfa;
  border-radius: 10px;
  height: 36px;
  padding: 0 0.6rem;
  font-size: 0.9rem;
  font-weight: 700;
  color: #0f766e;
  cursor: pointer;
}

.trend-btn:hover {
  background: #ccfbf1;
}

.close-btn {
  border: 1px solid #e2e8f0;
  background: #ffffff;
  border-radius: 10px;
  width: 36px;
  height: 36px;
  font-size: 1rem;
  color: #475569;
  cursor: pointer;
  flex-shrink: 0;
}

.close-btn:hover {
  background: #f1f5f9;
}

.spec-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  align-items: center;
}

.spec-badge {
  padding: 0.3rem 0.6rem;
  border-radius: 10px;
  background: #0f766e;
  color: #ffffff;
  font-weight: 700;
  font-size: 0.9rem;
}

.tag {
  padding: 0.25rem 0.55rem;
  border-radius: 8px;
  background: #ecfeff;
  color: #0f766e;
  font-size: 0.8rem;
  font-weight: 700;
}

.detail-section h3 {
  margin: 0 0 0.45rem;
  font-size: 0.92rem;
  color: #0f172a;
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.chip {
  padding: 0.22rem 0.55rem;
  border-radius: 8px;
  background: #ccfbf1;
  color: #115e59;
  font-size: 0.82rem;
  font-weight: 600;
}

.chip-neutral {
  background: #f1f5f9;
  color: #475569;
}

.step-list {
  margin: 0;
  padding-left: 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.92rem;
  line-height: 1.55;
}

.caution-section {
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 10px;
  padding: 0.7rem 0.8rem;
}

.caution-section h3 {
  color: #78350f;
}

.caution-list {
  margin: 0;
  padding-left: 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.9rem;
  line-height: 1.5;
  color: #78350f;
}

.field-input {
  width: 100%;
  box-sizing: border-box;
  min-height: 44px;
  border-radius: 10px;
  border: 1px solid #cbd5e1;
  padding: 0.55rem 0.65rem;
  color: #1f2937;
  font-size: 0.96rem;
  outline: none;
}

.field-input:focus {
  border-color: #0f766e;
  box-shadow: 0 0 0 3px rgba(15, 118, 110, 0.12);
}

.edit-actions {
  margin-top: 0.55rem;
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.action-btn {
  min-height: 44px;
  padding: 0.5rem 0.9rem;
  border-radius: 10px;
  border: 1px solid #0f766e;
  background: #0f766e;
  color: #ffffff;
  font-size: 0.92rem;
  font-weight: 700;
  cursor: pointer;
  touch-action: manipulation;
  transition: background-color 0.18s ease;
}

.action-btn:hover {
  background: #115e59;
}

.action-btn-outline {
  background: #ffffff;
  color: #0f766e;
}

.action-btn-outline:hover {
  background: #ecfeff;
}

.video-link {
  display: inline-block;
  margin-bottom: 0.5rem;
  color: #0f766e;
  font-weight: 700;
  text-decoration: none;
}

.video-link:hover {
  text-decoration: underline;
}

.empty-hint {
  margin: 0 0 0.5rem;
  color: #94a3b8;
  font-size: 0.88rem;
}
</style>
