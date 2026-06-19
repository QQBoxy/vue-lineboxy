<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';
import ModalView from '../components/ModalView.vue';
import ConfirmModalView from '../components/ConfirmModalView.vue';

const route = useRoute();
const router = useRouter();

interface List {
  id: number;
  name: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

const kanbanBoardName = ref('');
const kanbanLists = ref<List[]>([]);

const handleOpenList = (id: number, event: MouseEvent) => {
  const target = event.target as HTMLElement;
  if (target.closest('a, button')) {
    return;
  }
  router.push(`/kanban/${route.params.id}/${id}`);
};

const handleCreateKanbanList = async (data: Record<string, string>) => {
  await axios({
    method: 'post',
    url: '/api/kanban-lists',
    data: {
      boardId: route.params.id,
      name: data.name,
    },
  });
  await getKanbanLists();
};

const getKanban = async () => {
  try {
    const res = await axios({
      method: 'get',
      url: `/api/kanban-boards/${route.params.id}`,
    });
    kanbanBoardName.value = res.data.name;
  } catch (e) {
    console.log(e);
  }
};

const getKanbanLists = async () => {
  try {
    const res = await axios({
      method: 'get',
      url: '/api/kanban-lists',
      params: {
        boardId: route.params.id,
        limit: 999,
      },
    });
    kanbanLists.value = res.data.data;
  } catch (e) {
    console.log(e);
  }
};

const handleEditKanbanList = async (data: Record<string, string>) => {
  const patch: Partial<List> = {};
  if (data.name !== undefined) {
    patch.name = data.name;
  }
  if (data.order !== undefined) {
    const parsedOrder = Number.parseInt(data.order, 10);
    if (!Number.isNaN(parsedOrder)) {
      patch.order = parsedOrder;
    }
  }
  await axios({
    method: 'patch',
    url: `/api/kanban-lists/${data.id}`,
    data: patch,
  });
  getKanbanLists();
};

const handleDeleteKanbanList = async (id: number) => {
  await axios({
    method: 'delete',
    url: `/api/kanban-lists/${id}`,
  });
  await getKanbanLists();
};

onMounted(() => {
  getKanban();
  getKanbanLists();
});
</script>

<template>
  <main class="board-page">
    <header class="page-header">
      <h1>Kanban</h1>
    </header>

    <section class="control-card">
      <h2>
        <RouterLink class="crumb-link" to="/kanban">Kanbans</RouterLink>
        <span class="crumb-sep">➡️</span>
        <span>{{ kanbanBoardName }}</span>
      </h2>
      <ModalView class="action-btn-wrap" :cols="{ name: 'Kanban List Name' }" @submit="handleCreateKanbanList">
        Create List
      </ModalView>
    </section>

    <section class="control-card">
      <ul v-if="kanbanLists.length" class="list-grid">
        <li v-for="list in kanbanLists" :key="list.id" class="list-item" @click="handleOpenList(list.id, $event)">
          <RouterLink class="list-link" :to="`/kanban/${route.params.id}/${list.id}`">
            <span class="list-order">{{ list.order }}</span>
            <span class="list-name">{{ list.name }}</span>
          </RouterLink>
          <div class="list-actions">
            <ModalView
              class="action-btn-wrap action-btn-wrap-outline"
              :cols="{ name: 'Kanban List Name', order: 'Kanban List Order' }"
              :data="{ id: list.id, name: list.name, order: list.order }"
              trigger-variant="outline"
              @submit="handleEditKanbanList"
            >
              ✎
            </ModalView>
            <ConfirmModalView
              title="Delete list?"
              :message='`Delete \"${list.name}\"? This action cannot be undone.`'
              confirm-text="Confirm Delete"
              @confirmed="handleDeleteKanbanList(list.id)"
            >
              &times;
            </ConfirmModalView>
          </div>
        </li>
      </ul>
      <p v-else class="empty-text">No list yet. Create one to get started.</p>
    </section>
  </main>
</template>

<style scoped>
.board-page {
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
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.crumb-link {
  color: #0f766e;
  text-decoration: none;
  font-weight: 700;
}

.crumb-link:hover {
  color: #115e59;
}

.crumb-sep {
  color: #64748b;
}

.list-grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.list-item {
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

.list-link {
  box-sizing: border-box;
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  column-gap: 0.7rem;
  flex: 1 1 240px;
  min-height: 54px;
  padding: 0.55rem 0.65rem;
  border-radius: 10px;
  color: #0f172a;
  font-weight: 700;
  text-decoration: none;
}

.list-order {
  min-width: 2rem;
  text-align: center;
  border-radius: 8px;
  padding: 0.2rem 0.35rem;
  background: #f1f5f9;
  color: #334155;
  font-size: 0.9rem;
}

.list-name {
  min-width: 0;
}

.list-link:hover {
  background: #ecfeff;
  color: #0f766e;
}

.list-actions {
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
  .board-page {
    padding-top: 1.2rem;
  }
}

@media (max-width: 640px) {
  .list-actions {
    width: 100%;
  }
}
</style>
