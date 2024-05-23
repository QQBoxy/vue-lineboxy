<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router'
import axios from 'axios';
import ModalView from '../components/ModalView.vue';

const route = useRoute();

interface Card {
  id: number;
  title: string;
  description: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

const kanbanBoardName = ref("");
const listName = ref("");
const cards = ref<Card[]>([]);

const handleCreateKanbanCard = async (data: Record<string, string>) => {
  await axios({
    method: 'post',
    url: `/api/kanban-cards`,
    data: {
      listId: route.params.listId,
      title: data.title,
      description: data.description,
    }
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
      }
    });
    cards.value = res.data.data;
  } catch (e) {
    console.log(e);
  }
};

const handleEditKanbanCard = async (data: Record<string, string>) => {
  console.log(data);
  const patch: Partial<Card> = {};
  if (data.title !== undefined) {
    patch.title = data.title;
  }
  if (data.description !== undefined) {
    patch.description = data.description;
  }
  if (data.order !== undefined) {
    patch.order = parseInt(data.order);
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
})
</script>

<template>
  <h1>
    Kanban
  </h1>
  <ModalView :cols="{ title: 'Card Title', description: 'Card Description' }" @submit="handleCreateKanbanCard">
    Create Card</ModalView>
  <h3>
    <RouterLink to="/kanban">Kanban</RouterLink> &gt;
    <RouterLink :to="`/kanban/${route.params.boardId}`">{{ kanbanBoardName }}</RouterLink> &gt;
    {{ listName }}
  </h3>
  <ul>
    <li v-for="card in cards" :key="card.id">
      [{{ card.order }}] {{ card.title }} | {{ card.description }} |
      <ModalView
        :cols="{ title: 'Kanban Card Title', description: 'Kanban Card Description', order: 'Kanban Card Order' }"
        :data="{ id: card.id }" @submit="handleEditKanbanCard">Edit</ModalView> |
      <button @click="handleDeleteKanbanCard(card.id)">Delete</button>
    </li>
  </ul>
</template>
