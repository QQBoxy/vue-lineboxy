<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  linkDisplayLabel,
  normalizeUrl,
  parseYoutubeId,
  youtubeThumbnail,
  youtubeWatchUrl,
} from '@/services/cook/youtube';
import type { RecipeSource } from '@/services/cook/types';

interface Props {
  source: RecipeSource;
}

const props = defineProps<Props>();

/** youtubeId 是存檔時解析好的；未存到（舊資料或剛貼上）時就地補算 */
const videoId = computed(() => props.source.youtubeId ?? parseYoutubeId(props.source.url));

const href = computed(() =>
  videoId.value ? youtubeWatchUrl(videoId.value) : normalizeUrl(props.source.url),
);

const label = computed(() => linkDisplayLabel(props.source.url, props.source.title));

/** 影片下架時縮圖會 404，退回純文字連結而不是留一張破圖 */
const thumbnailFailed = ref(false);
</script>

<template>
  <a class="source-link" :href="href" target="_blank" rel="noopener noreferrer">
    <img
      v-if="videoId && !thumbnailFailed"
      class="source-thumb"
      :src="youtubeThumbnail(videoId)"
      alt=""
      loading="lazy"
      @error="thumbnailFailed = true"
    />
    <span v-else class="source-icon">{{ videoId ? '▶' : '🔗' }}</span>
    <span class="source-body">
      <span class="source-title">{{ label }}</span>
      <span class="source-url">{{ videoId ? '在 YouTube 開啟' : props.source.url }}</span>
    </span>
  </a>
</template>

<style scoped>
.source-link {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-height: 52px;
  padding: 0.5rem 0.6rem;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
  color: #1f2937;
  text-decoration: none;
  transition: background-color 0.18s ease, border-color 0.18s ease;
}

.source-link:hover {
  background: #fff7ed;
  border-color: #fdba74;
}

.source-thumb {
  flex: 0 0 auto;
  width: 96px;
  height: 54px;
  border-radius: 8px;
  object-fit: cover;
  background: #e2e8f0;
}

.source-icon {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.4rem;
  height: 2.4rem;
  border-radius: 8px;
  background: #ffedd5;
  color: #9a3412;
  font-size: 1rem;
}

.source-body {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}

.source-title {
  font-size: 0.92rem;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.source-url {
  font-size: 0.78rem;
  color: #64748b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
