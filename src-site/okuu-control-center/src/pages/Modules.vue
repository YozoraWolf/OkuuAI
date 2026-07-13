<template>
  <q-page class="modules-page">
    <header class="modules-header">
      <div>
        <span class="eyebrow">RUNTIME MODULES</span>
        <h1>Service switches</h1>
        <p>Inspect and control optional Okuu services without leaving the control center.</p>
      </div>
      <div class="live-indicator"><span></span>Live · {{ lastUpdated }}</div>
    </header>

    <q-banner v-if="error" rounded class="error-banner">{{ error }}</q-banner>

    <section class="module-grid">
      <article v-for="module in modules" :key="module.id" class="module-card" :class="module.status">
        <div class="module-topline">
          <div class="module-icon"><q-icon :name="module.id === 'okuu-claw' ? 'hub' : 'graphic_eq'" size="26px" /></div>
          <div class="state-pill"><span></span>{{ module.status }}</div>
        </div>

        <div class="module-copy">
          <h2>{{ module.name }}</h2>
          <p>{{ module.description }}</p>
        </div>

        <div class="module-detail">
          <span>{{ module.detail }}</span>
          <small v-if="module.endpoint">{{ module.endpoint }}</small>
        </div>

        <div class="module-actions">
          <div>
            <strong>{{ module.enabled ? 'Enabled' : 'Disabled' }}</strong>
            <small>{{ module.available ? 'Available on this host' : 'Runtime unavailable' }}</small>
          </div>
          <q-btn
            :label="module.enabled ? 'Disable' : 'Enable'"
            :icon="module.enabled ? 'power_settings_new' : 'play_arrow'"
            :color="module.enabled ? 'negative' : 'primary'"
            :outline="module.enabled"
            no-caps
            :loading="busy[module.id] || isTransitioning(module)"
            :disable="!module.available || isTransitioning(module)"
            @click="toggleModule(module)"
          />
        </div>
      </article>
    </section>
  </q-page>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useQuasar } from 'quasar';
import { fetchModules, setModuleEnabled, type ModuleState } from 'src/services/modules.service';

const $q = useQuasar();
const modules = ref<ModuleState[]>([]);
const error = ref('');
const lastUpdated = ref('Waiting for status');
const busy = reactive<Record<string, boolean>>({});
let refreshTimer: ReturnType<typeof setInterval> | undefined;

const isTransitioning = (module: ModuleState) => module.status === 'enabling' || module.status === 'disabling';

const refresh = async () => {
  try {
    const response = await fetchModules();
    modules.value = response.modules;
    lastUpdated.value = new Date(response.timestamp).toLocaleTimeString();
    error.value = '';
  } catch (reason: any) {
    error.value = reason?.response?.status === 403 ? 'Administrator access is required.' : 'Unable to load module status.';
  }
};

const toggleModule = (module: ModuleState) => {
  const enabling = !module.enabled;
  $q.dialog({
    title: `${enabling ? 'Enable' : 'Disable'} ${module.name}?`,
    message: enabling ? 'The service will start on this host.' : 'The running service will be stopped immediately.',
    cancel: true,
    persistent: true,
  }).onOk(async () => {
    busy[module.id] = true;
    try {
      const updated = await setModuleEnabled(module.id, enabling);
      const index = modules.value.findIndex(item => item.id === module.id);
      if (index >= 0) modules.value.splice(index, 1, updated);
      $q.notify({ type: 'positive', message: `${module.name} ${enabling ? 'enabled' : 'disabled'}.` });
    } catch (reason: any) {
      $q.notify({ type: 'negative', message: reason?.response?.data?.error || `Unable to ${enabling ? 'enable' : 'disable'} ${module.name}.` });
    } finally {
      busy[module.id] = false;
      await refresh();
    }
  });
};

onMounted(() => {
  void refresh();
  refreshTimer = setInterval(refresh, 15000);
});
onBeforeUnmount(() => { if (refreshTimer) clearInterval(refreshTimer); });
</script>

<style lang="scss" scoped>
.modules-page { min-height: 100%; padding: clamp(1rem, 4vw, 3rem); background: radial-gradient(circle at 85% 8%, color-mix(in srgb, var(--accent-1) 14%, transparent), transparent 32%), linear-gradient(160deg, var(--surface-0), color-mix(in srgb, var(--surface-0) 88%, #09111a)); }
.modules-header { display: flex; align-items: flex-end; gap: 1rem; max-width: 1100px; margin: 0 auto 2rem; }
.modules-header > div:first-child { margin-right: auto; }
.eyebrow { color: var(--accent-1); font-size: .66rem; font-weight: 850; letter-spacing: .16em; }
.modules-header h1 { margin: .25rem 0 0; font-size: clamp(1.8rem, 5vw, 3.15rem); letter-spacing: -.055em; }
.modules-header p { max-width: 620px; margin: .45rem 0 0; color: var(--text-muted); }
.live-indicator { display: flex; align-items: center; gap: .45rem; color: var(--text-muted); font-size: .72rem; white-space: nowrap; }
.live-indicator span { width: 7px; height: 7px; border-radius: 50%; background: #65d69d; box-shadow: 0 0 0 5px rgba(101,214,157,.1); }
.error-banner { max-width: 1100px; margin: 0 auto 1rem; color: #ffb9b9; background: rgba(180,40,40,.2); }
.module-grid { display: grid; max-width: 1100px; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; margin: 0 auto; }
.module-card { position: relative; display: flex; min-height: 330px; flex-direction: column; padding: 1.25rem; overflow: hidden; border: 1px solid var(--surface-border); border-radius: 22px; background: linear-gradient(145deg, color-mix(in srgb, var(--surface-2) 88%, transparent), var(--surface-1)); box-shadow: 0 22px 50px rgba(0,0,0,.18); }
.module-card::before { position: absolute; width: 180px; height: 180px; top: -95px; right: -70px; border-radius: 50%; background: color-mix(in srgb, var(--accent-1) 12%, transparent); content: ''; filter: blur(4px); }
.module-card.offline, .module-card.unavailable { opacity: .78; }
.module-topline, .module-actions { position: relative; display: flex; align-items: center; justify-content: space-between; gap: .75rem; }
.module-icon { display: grid; width: 48px; height: 48px; place-items: center; border: 1px solid color-mix(in srgb, var(--accent-1) 28%, var(--surface-border)); border-radius: 15px; color: var(--accent-1); background: color-mix(in srgb, var(--accent-1) 9%, var(--surface-1)); }
.state-pill { display: flex; align-items: center; gap: .4rem; padding: .35rem .58rem; border: 1px solid var(--surface-border); border-radius: 999px; color: var(--text-muted); font-size: .61rem; letter-spacing: .08em; text-transform: uppercase; }
.state-pill span { width: 7px; height: 7px; border-radius: 50%; background: #818a92; }.online .state-pill span { background: #65d69d; }.degraded .state-pill span, .enabling .state-pill span, .disabling .state-pill span { background: #e8bd63; }.offline .state-pill span, .unavailable .state-pill span { background: #ef7474; }
.module-copy { position: relative; margin-top: 2rem; }.module-copy h2 { margin: 0; font-size: 1.55rem; letter-spacing: -.035em; }.module-copy p { margin: .35rem 0 0; color: var(--text-muted); }
.module-detail { position: relative; display: grid; gap: .25rem; margin: 1.4rem 0; padding: .75rem; border-left: 2px solid color-mix(in srgb, var(--accent-1) 60%, transparent); color: var(--text-strong); background: color-mix(in srgb, var(--surface-0) 42%, transparent); font-size: .75rem; }.module-detail small { overflow: hidden; color: var(--text-muted); font-size: .64rem; text-overflow: ellipsis; white-space: nowrap; }
.module-actions { margin-top: auto; padding-top: 1rem; border-top: 1px solid var(--surface-border); }.module-actions strong, .module-actions small { display: block; }.module-actions strong { font-size: .82rem; }.module-actions small { margin-top: .15rem; color: var(--text-muted); font-size: .64rem; }
@media (max-width: 760px) { .modules-header { align-items: flex-start; flex-direction: column; }.module-grid { grid-template-columns: 1fr; }.module-card { min-height: 300px; } }
</style>
