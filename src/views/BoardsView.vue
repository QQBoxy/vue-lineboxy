<script setup lang="ts">
import { ref, onMounted } from 'vue';
import axios from 'axios';
import ModalView from '../components/ModalView.vue';

interface Board {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
}

const kanbanBoards = ref<Board[]>([]);

const handleCreateKanbanBoard = async (data: Record<string, string>) => {
  await axios({
    method: 'post',
    url: '/api/kanban-boards',
    data: {
      name: data.name,
    }
  });
  await getKanbanBoards();
};

const handleEditKanbanBoard = async (data: Record<string, string>) => {
  await axios({
    method: 'patch',
    url: `/api/kanban-boards/${data.id}`,
    data: {
      name: data.name,
    }
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
        limit: 999
      }
    });
    kanbanBoards.value = res.data.data;
  } catch (e) {
    console.log(e);
  }
};

onMounted(() => {
  getKanbanBoards();
})
</script>

<template>
  <h1>Kanban</h1>
  <h3>Kanbans</h3>
  <ModalView :cols="{ name: 'Kanban Board Name' }" @submit="handleCreateKanbanBoard">
    Create Kanban</ModalView>
  <ul>
    <li v-for="board in kanbanBoards" :key="board.id">
      <RouterLink :to="`/kanban/${board.id}`">{{ board.name }}</RouterLink> |
      <ModalView :cols="{ name: 'Kanban Board Name' }" :data="{ id: board.id }" @submit="handleEditKanbanBoard">
        Edit</ModalView> |
      <button @click="handleDeleteKanbanBoard(board.id)">Delete</button>
    </li>
  </ul>
</template>
