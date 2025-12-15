import { defineRouter } from '#q-app/wrappers';
import {
  createMemoryHistory,
  createRouter,
  createWebHashHistory,
  createWebHistory,
} from 'vue-router';
import routes from './routes';
import { useAuthStore } from 'src/stores/auth.store';

/*
 * If not building with SSR mode, you can
 * directly export the Router instantiation;
 *
 * The function below can be async too; either use
 * async/await or return a Promise which resolves
 * with the Router instance.
 */

export default defineRouter(function (/* { store, ssrContext } */) {
  const createHistory = process.env.SERVER
    ? createMemoryHistory
    : (process.env.VUE_ROUTER_MODE === 'history' ? createWebHistory : createWebHashHistory);

  const Router = createRouter({
    scrollBehavior: () => ({ left: 0, top: 0 }),
    routes,

    // Leave this as is and make changes in quasar.conf.js instead!
    // quasar.conf.js -> build -> vueRouterMode
    // quasar.conf.js -> build -> publicPath
    history: createHistory(process.env.VUE_ROUTER_BASE),
  });

  // Navigation guard to enforce password change
  Router.beforeEach((to, from, next) => {
    const authStore = useAuthStore();
    
    // If user must change password and is not going to change-password page
    if (authStore.isAuthenticated && authStore.mustChangePassword && to.path !== '/change-password') {
      next('/change-password');
    } 
    // If user doesn't need to change password but is on change-password page
    else if (authStore.isAuthenticated && !authStore.mustChangePassword && to.path === '/change-password') {
      next('/');
    }
    // Otherwise proceed normally
    else {
      next();
    }
  });

  return Router;
});
