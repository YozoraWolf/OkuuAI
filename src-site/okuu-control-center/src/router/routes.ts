import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('pages/OkuuAIHealthPing.vue')
  },
  {
    path: '/login',
    component: () => import('pages/Login.vue')
  },
  {
    path: '/change-password',
    component: () => import('pages/ChangePassword.vue')
  },
  {
    path: '/settings',
    component: () => import('pages/Settings.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/chat',
    component: () => import('pages/Chat.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/chat/:id',
    component: () => import('pages/Chat.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/admin',
    component: () => import('pages/Admin.vue'),
    meta: { requiresAuth: true, admin: true }
  },
  {
    path: '/modules',
    component: () => import('pages/Modules.vue'),
    meta: { requiresAuth: true, admin: true }
  },
  {
    path: '/inactive',
    component: () => import('pages/OkuuInactive.vue')
  },

  // Always leave this as last one,
  // but you can also remove it
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue'),
  },
];

export default routes;
