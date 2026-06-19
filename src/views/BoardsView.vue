<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';
import ModalView from '../components/ModalView.vue';
import ConfirmModalView from '../components/ConfirmModalView.vue';

interface Board {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
}

const kanbanBoards = ref<Board[]>([]);
const router = useRouter();

const handleOpenBoard = (id: number, event: MouseEvent) => {
  const target = event.target as HTMLElement;
  if (target.closest('a, button')) {
    return;
  }
  router.push(`/kanban/${id}`);
};

const handleCreateKanbanBoard = async (data: Record<string, string>) => {
  await axios({
    method: 'post',
    url: '/api/kanban-boards',
    data: {
      name: data.name,
    },
  });
  await getKanbanBoards();
};

const handleEditKanbanBoard = async (data: Record<string, string>) => {
  await axios({
    method: 'patch',
    url: `/api/kanban-boards/${data.id}`,
    data: {
      name: data.name,
    },
  });
  await getKanbanBoards();
};

const handleDeleteKanbanBoard = async (id: number) => {
  await axios({
    method: 'delete',
    url: `/api/kanban-boards/${id}`,
  });
  await getKanbanBoards();
};

const getKanbanBoards = async () => {
  try {
    const res = await axios({
      method: 'get',
      url: '/api/kanban-boards',
      params: {
        limit: 999,
      },
    });
    kanbanBoards.value = res.data.data;
  } catch (e) {
    console.log(e);
  }
};

onMounted(() => {
  getKanbanBoards();
});
</script>

<template>
  <main class="boards-page">
    <header class="page-header">
      <h1>Kanban</h1>
    </header>

    <section class="control-card">
      <h2>Kanbans</h2>
      <ModalView class="action-btn-wrap" :cols="{ name: 'Kanban Board Name' }" @submit="handleCreateKanbanBoard">
        Create Kanban
      </ModalView>
    </section>

    <section class="control-card">
      <ul v-if="kanbanBoards.length" class="board-list">
        <li v-for="board in kanbanBoards" :key="board.id" class="board-item" @click="handleOpenBoard(board.id, $event)">
          <RouterLink class="board-link" :to="`/kanban/${board.id}`">
            {{ board.name }}
          </RouterLink>
          <div class="board-actions">
            <ModalView
              class="action-btn-wrap action-btn-wrap-outline"
              :cols="{ name: 'Kanban Board Name' }"
              :data="{ id: board.id, name: board.name }"
              trigger-variant="outline"
              @submit="handleEditKanbanBoard"
            >
              ✎
            </ModalView>
            <ConfirmModalView
              title="Delete board?"
              :message='`Delete "${board.name}"?`'
              confirm-text="Confirm Delete"
              @confirmed="handleDeleteKanbanBoard(board.id)"
            >
              &times;
            </ConfirmModalView>
          </div>
        </li>
      </ul>
      <p v-else class="empty-text">No kanban board yet. Create one to get started.</p>
    </section>
  </main>
</template>

<style scoped>
.boards-page {
  max-width: 860px;
  margin: 0 auto;
  padding: 1rem 0.9rem 2rem;
  color: #1f2937;
}

.page-header {
  margin-bottom: 1rem;
}

.page-header h1 {
  margin: 0;
  font-size: clamp(1.55rem, 2.6vw, 2rem);
}

.control-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 0.95rem;
  margin-top: 0.85rem;
  box-shadow: 0 6px 22px -16px rgba(15, 23, 42, 0.38);
}

.control-card h2 {
  margin: 0 0 0.75rem;
  font-size: 1.02rem;
}

.board-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.board-item {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 0.75rem;
  display: flex;
  gap: 0.8rem;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  cursor: pointer;
}

.board-link {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  flex: 1 1 240px;
  min-height: 54px;
  padding: 0.55rem 0.65rem;
  border-radius: 10px;
  color: #0f172a;
  font-weight: 700;
  text-decoration: none;
}

.board-link:hover {
  background: #ecfeff;
  color: #0f766e;
}

.board-actions {
  flex: 0 0 auto;
  display: flex;
  gap: 0.55rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.action-btn-wrap :deep(button) {
  width: 100%;
}

.action-btn-wrap-outline :deep(button) {
  background: #ffffff;
  color: #0f766e;
}

.action-btn-wrap-outline :deep(button):hover {
  background: #ecfeff;
}

.action-btn-wrap :deep(button) {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 54px;
  min-width: 54px;
  padding: 0.65rem 0.75rem;
  border-radius: 12px;
  border: 1px solid #0f766e;
  background: #0f766e;
  color: #ffffff;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.01em;
  line-height: 1;
  touch-action: manipulation;
  cursor: pointer;
  transition: background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease;
}

.action-btn-wrap :deep(button):hover {
  background: #115e59;
}

.empty-text {
  margin: 0;
  color: #64748b;
  font-weight: 600;
}

@media (min-width: 960px) {
  .boards-page {
    padding-top: 1.2rem;
  }
}

@media (max-width: 640px) {
  .board-actions {
    width: 100%;
  }
}
</style>
