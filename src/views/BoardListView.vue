<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import axios from 'axios';
import ModalView from '../components/ModalView.vue';
import ConfirmModalView from '../components/ConfirmModalView.vue';

const route = useRoute();

interface Card {
  id: number;
  title: string;
  description: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

const kanbanBoardName = ref('');
const listName = ref('');
const cards = ref<Card[]>([]);

const handleCreateKanbanCard = async (data: Record<string, string>) => {
  await axios({
    method: 'post',
    url: `/api/kanban-cards`,
    data: {
      listId: route.params.listId,
      title: data.title,
      description: data.description,
    },
  });
  await getKanbanCards();
};

const getKanban = async () => {
  try {
    const res = await axios({
      method: 'get',
      url: `/api/kanban-boards/${route.params.boardId}`,
    });
    kanbanBoardName.value = res.data.name;
  } catch (e) {
    console.log(e);
  }
};

const getKanbanList = async () => {
  try {
    const res = await axios({
      method: 'get',
      url: `/api/kanban-lists/${route.params.listId}`,
    });
    listName.value = res.data.name;
  } catch (e) {
    console.log(e);
  }
};

const getKanbanCards = async () => {
  try {
    const res = await axios({
      method: 'get',
      url: `/api/kanban-cards`,
      params: {
        listId: route.params.listId,
        limit: 999,
      },
    });
    cards.value = res.data.data;
  } catch (e) {
    console.log(e);
  }
};

const handleEditKanbanCard = async (data: Record<string, string>) => {
  const patch: Partial<Card> = {};
  if (data.title !== undefined) {
    patch.title = data.title;
  }
  if (data.description !== undefined) {
    patch.description = data.description;
  }
  if (data.order !== undefined) {
    const parsedOrder = Number.parseInt(data.order, 10);
    if (!Number.isNaN(parsedOrder)) {
      patch.order = parsedOrder;
    }
  }
  await axios({
    method: 'patch',
    url: `/api/kanban-cards/${data.id}`,
    data: patch,
  });
  getKanbanCards();
};

const handleDeleteKanbanCard = async (id: number) => {
  await axios({
    method: 'delete',
    url: `/api/kanban-cards/${id}`,
  });
  await getKanbanCards();
};

onMounted(() => {
  getKanban();
  getKanbanList();
  getKanbanCards();
});
</script>

<template>
  <main class="board-list-page">
    <header class="page-header">
      <h1>Kanban</h1>
    </header>

    <section class="control-card">
      <h2>
        <RouterLink class="crumb-link" to="/kanban">Kanbans</RouterLink>
        <span class="crumb-sep">➡️</span>
        <RouterLink class="crumb-link" :to="`/kanban/${route.params.boardId}`">{{ kanbanBoardName }}</RouterLink>
        <span class="crumb-sep">➡️</span>
        <span>{{ listName }}</span>
      </h2>
      <ModalView class="action-btn-wrap" :cols="{ title: 'Card Title', description: 'Card Description' }" @submit="handleCreateKanbanCard">
        Create Card
      </ModalView>
    </section>

    <section class="control-card">
      <ul v-if="cards.length" class="card-grid">
        <li v-for="card in cards" :key="card.id" class="card-item">
          <div class="card-main">
            <span class="card-order">{{ card.order }}</span>
            <div class="card-copy">
              <p class="card-title">{{ card.title }}</p>
              <p class="card-desc">{{ card.description || 'No description' }}</p>
            </div>
          </div>
          <div class="card-actions">
            <ModalView
              class="action-btn-wrap action-btn-wrap-outline"
              :cols="{ title: 'Kanban Card Title', description: 'Kanban Card Description', order: 'Kanban Card Order' }"
              :data="{ id: card.id, title: card.title, description: card.description, order: card.order }"
              @submit="handleEditKanbanCard"
            >
              Edit
            </ModalView>
            <ConfirmModalView
              title="Delete card?"
              :message='`Delete \"${card.title}\"? This action cannot be undone.`'
              confirm-text="Confirm Delete"
              @confirmed="handleDeleteKanbanCard(card.id)"
            >
              Delete
            </ConfirmModalView>
          </div>
        </li>
      </ul>
      <p v-else class="empty-text">No card yet. Create one to get started.</p>
    </section>
  </main>
</template>

<style scoped>
.board-list-page {
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

.card-grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.card-item {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 0.75rem;
  display: flex;
  gap: 0.8rem;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
}

.card-main {
  box-sizing: border-box;
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  column-gap: 0.7rem;
  flex: 1 1 260px;
  min-height: 54px;
  padding: 0.55rem 0.65rem;
  border-radius: 10px;
}

.card-order {
  min-width: 2rem;
  text-align: center;
  border-radius: 8px;
  padding: 0.2rem 0.35rem;
  background: #f1f5f9;
  color: #334155;
  font-size: 0.9rem;
  font-weight: 700;
}

.card-copy {
  min-width: 0;
}

.card-title {
  margin: 0;
  color: #0f172a;
  font-weight: 700;
}

.card-desc {
  margin: 0.2rem 0 0;
  color: #64748b;
  font-size: 0.94rem;
}

.card-actions {
  flex: 0 0 auto;
  display: flex;
  gap: 0.55rem;
  flex-wrap: wrap;
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
  .board-list-page {
    padding-top: 1.2rem;
  }
}
</style>

