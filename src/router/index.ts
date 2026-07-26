import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: () => import('../views/IndexView.vue'),
      children: [
        {
          path: '/',
          component: () => import('../views/HomeView.vue')
        },
        {
          path: '/person',
          component: () => import('../views/PersonView.vue')
        },
        {
          path: '/login',
          component: () => import('../views/LoginView.vue')
        },
        {
          path: '/logout',
          component: () => import('../views/LogoutView.vue')
        },
        {
          path: '/total',
          component: () => import('../views/TotalView.vue')
        },
        {
          path: '/workout',
          component: () => import('../views/WorkoutView.vue')
        },
        {
          path: '/workout/import',
          component: () => import('../views/WorkoutImportView.vue')
        },
        {
          path: '/workout/log',
          component: () => import('../views/WorkoutLogView.vue')
        },
        {
          path: '/workout/plan/:id',
          component: () => import('../views/WorkoutPlanView.vue')
        },
        {
          path: '/kanban',
          component: () => import('../views/BoardsView.vue')
        },
        {
          path: '/kanban/:id',
          component: () => import('../views/BoardView.vue')
        },
        {
          path: '/kanban/:boardId/:listId',
          component: () => import('../views/BoardListView.vue')
        },
      ]
    },
  ]
})

export default router
