<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router'
import axios from 'axios';
import ModalView from '../components/ModalView.vue';

const route = useRoute();

interface List {
  id: number;
  name: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

const kanbanBoardName = ref("");
const kanbanLists = ref<List[]>([]);

const handleCreateKanbanList = async (data: Record<string, string>) => {
  await axios({
    method: 'post',
    url: '/api/kanban-lists',
    data: {
      boardId: route.params.id,
      name: data.name,
    }
  });
  await getKanbanLists();
};

const getKanban = async () => {
  try {
    const res = await axios({
      method: 'get',
      url: `/api/kanban-boards/${route.params.id}`,
    });
    console.log(res.data);
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
      }
    });
    console.log(res.data);
    kanbanLists.value = res.data.data;
  } catch (e) {
    console.log(e);
  }
};

const handleEditKanbanList = async (data: Record<string, string>) => {
  const patch: Partial<List> = {};
  if (data.name !== "") {
    patch.name = data.name;
  }
  if (data.order !== "") {
    patch.order = parseInt(data.order);
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
})
</script>

<template>
  <h1>{{ kanbanBoardName }} | Kanban</h1>
  <ModalView :cols="{ name: 'Kanban List Name' }" @submit="handleCreateKanbanList">
    Create List</ModalView>
  <ul>
    <li v-for="list in kanbanLists" :key="list.id">
      [{{ list.order }}] {{ list.name }} |
      <ModalView :cols="{ name: 'Kanban List Name', order: 'Kanban List Order' }" :data="{ id: list.id }"
        @submit="handleEditKanbanList">
        Edit</ModalView> |
      <button @click="handleDeleteKanbanList(list.id)">Delete</button>
    </li>
  </ul>
</template>
