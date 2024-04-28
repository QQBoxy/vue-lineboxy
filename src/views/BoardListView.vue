<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router'
import axios from 'axios';

const route = useRoute();

const kanbanBoardName = ref("");
const listName = ref("");

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

const getList = async () => {
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

onMounted(() => {
  getKanban();
  getList();
})
</script>

<template>
  <h1>
    Kanban
  </h1>
  <h3>
    <RouterLink to="/kanban">Kanban</RouterLink> &gt;
    <RouterLink :to="`/kanban/${route.params.boardId}`">{{ kanbanBoardName }}</RouterLink> &gt;
    {{ listName }}
  </h3>
  List Id: {{ route.params.listId }}
</template>
