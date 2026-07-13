<template>
  <q-page class="admin-page">
    <header class="admin-header">
      <div>
        <span class="eyebrow">ADMIN CONSOLE</span>
        <h1>System overview</h1>
        <p>Live host resources and service availability.</p>
      </div>
      <div class="header-meta" v-if="overview">
        <q-icon name="dns" />
        <span>{{ overview.host.hostname }}</span>
        <small>{{ overview.host.platform }}</small>
        <q-select
          v-model="refreshRate"
          :options="refreshOptions"
          emit-value
          map-options
          dense
          borderless
          options-dense
          class="refresh-select"
          aria-label="Statistics refresh rate"
        >
          <template #prepend><q-icon name="schedule" size="14px" /></template>
          <q-tooltip>Statistics refresh interval. Short intervals are disabled to avoid excessive requests.</q-tooltip>
        </q-select>
      </div>
    </header>

    <q-banner v-if="error" class="error-banner" rounded>{{ error }}</q-banner>

    <section class="service-grid">
      <article v-for="service in overview?.services || []" :key="service.name" class="service-card">
        <span class="status-dot" :class="service.status"></span>
        <div><strong>{{ service.name }}</strong><small>{{ service.detail }}</small></div>
        <span class="service-state">{{ service.status }}</span>
      </article>
    </section>

    <ModuleControls />

    <section class="metrics-grid">
      <article class="metric-card">
        <div class="metric-heading"><div><span>CPU</span><small>{{ overview?.metrics.cpu.cores || 0 }} cores</small></div><strong>{{ latest.cpu.toFixed(1) }}%</strong></div>
        <svg viewBox="0 0 300 110" preserveAspectRatio="none" aria-label="CPU usage graph">
          <defs><linearGradient id="cpuFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent-1)" stop-opacity=".34"/><stop offset="1" stop-color="var(--accent-1)" stop-opacity="0"/></linearGradient></defs>
          <path :d="areaPath(history.cpu)" fill="url(#cpuFill)"/><polyline :points="linePoints(history.cpu)" class="chart-line" />
        </svg>
        <small class="metric-detail">{{ overview?.metrics.cpu.model }}</small>
      </article>

      <article class="metric-card">
        <div class="metric-heading"><div><span>Memory</span><small>System RAM</small></div><strong>{{ latest.memory.toFixed(1) }}%</strong></div>
        <svg viewBox="0 0 300 110" preserveAspectRatio="none" aria-label="RAM usage graph">
          <defs><linearGradient id="ramFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent-2)" stop-opacity=".34"/><stop offset="1" stop-color="var(--accent-2)" stop-opacity="0"/></linearGradient></defs>
          <path :d="areaPath(history.memory)" fill="url(#ramFill)"/><polyline :points="linePoints(history.memory)" class="chart-line secondary" />
        </svg>
        <small class="metric-detail">{{ formatBytes(overview?.metrics.memory.usedBytes) }} / {{ formatBytes(overview?.metrics.memory.totalBytes) }}</small>
      </article>

      <article class="metric-card" :class="{ unavailable: !overview?.metrics.gpu.available }">
        <div class="metric-heading"><div><span>GPU</span><small>{{ overview?.metrics.gpu.name || 'Not detected' }}</small></div><strong>{{ overview?.metrics.gpu.available ? `${latest.gpu.toFixed(1)}%` : 'N/A' }}</strong></div>
        <svg v-if="overview?.metrics.gpu.available" viewBox="0 0 300 110" preserveAspectRatio="none" aria-label="GPU usage graph">
          <defs><linearGradient id="gpuFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent-1)" stop-opacity=".34"/><stop offset="1" stop-color="var(--accent-1)" stop-opacity="0"/></linearGradient></defs>
          <path :d="areaPath(history.gpu)" fill="url(#gpuFill)"/><polyline :points="linePoints(history.gpu)" class="chart-line" />
        </svg>
        <div v-else class="no-gpu"><q-icon name="videocam_off" size="28px"/><span>No NVIDIA metrics available</span></div>
        <small v-if="overview?.metrics.gpu.available" class="metric-detail">{{ overview.metrics.gpu.memoryUsedMb }} / {{ overview.metrics.gpu.memoryTotalMb }} MB · {{ overview.metrics.gpu.temperatureC }}°C</small>
      </article>
    </section>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { fetchAdminOverview } from 'src/services/admin.service';
import ModuleControls from 'src/components/admin/ModuleControls.vue';

const overview = ref<any>(null);
const error = ref('');
const history = reactive({ cpu: [] as number[], memory: [] as number[], gpu: [] as number[] });
let timer: ReturnType<typeof setInterval> | undefined;
const refreshOptions = [
  { label: '15 sec', value: 15000 },
  { label: '30 sec', value: 30000 },
  { label: '1 min', value: 60000 },
  { label: '2 min', value: 120000 },
];
const savedRefreshRate = Number(localStorage.getItem('adminStatsRefreshRate'));
const refreshRate = ref(refreshOptions.some(option => option.value === savedRefreshRate) ? savedRefreshRate : 30000);

const latest = computed(() => ({
  cpu: history.cpu.at(-1) || 0,
  memory: history.memory.at(-1) || 0,
  gpu: history.gpu.at(-1) || 0,
}));

const addPoint = (points: number[], value: number) => {
  points.push(Number.isFinite(value) ? value : 0);
  if (points.length > 30) points.shift();
};

const refresh = async () => {
  try {
    overview.value = await fetchAdminOverview();
    addPoint(history.cpu, overview.value.metrics.cpu.usagePercent);
    addPoint(history.memory, overview.value.metrics.memory.usagePercent);
    if (overview.value.metrics.gpu.available) addPoint(history.gpu, overview.value.metrics.gpu.usagePercent);
    error.value = '';
  } catch (reason: any) {
    error.value = reason?.response?.status === 403 ? 'Administrator access is required.' : 'Unable to load system metrics.';
  }
};

const linePoints = (points: number[]) => points.map((value, index) => `${points.length === 1 ? 300 : index * 300 / (points.length - 1)},${110 - value * 1.1}`).join(' ');
const areaPath = (points: number[]) => points.length ? `M0 110 L${linePoints(points).replaceAll(' ', ' L')} L300 110 Z` : '';
const formatBytes = (bytes = 0) => `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;

const scheduleRefresh = () => {
  if (timer) clearInterval(timer);
  timer = setInterval(refresh, refreshRate.value);
};

watch(refreshRate, value => {
  localStorage.setItem('adminStatsRefreshRate', String(value));
  scheduleRefresh();
});

onMounted(() => { void refresh(); scheduleRefresh(); });
onBeforeUnmount(() => { if (timer) clearInterval(timer); });
</script>

<style lang="scss" scoped>
.admin-page { min-height: 100%; padding: clamp(1rem, 3vw, 2.5rem); background: radial-gradient(circle at 85% 5%, color-mix(in srgb, var(--accent-1) 12%, transparent), transparent 30%), var(--surface-0); }
.admin-header { display: flex; align-items: flex-end; gap: 1rem; margin-bottom: 1.5rem; }
.admin-header > div:first-child { margin-right: auto; }
.eyebrow { color: var(--accent-1); font-size: .66rem; font-weight: 850; letter-spacing: .15em; }
.admin-header h1 { margin: .25rem 0 0; font-size: clamp(1.65rem, 4vw, 2.5rem); letter-spacing: -.045em; }
.admin-header p { margin: .35rem 0 0; color: var(--text-muted); }
.header-meta { display: grid; width: 210px; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: .15rem .45rem; padding: .65rem .8rem .35rem; border: 1px solid var(--surface-border); border-radius: 12px; background: var(--surface-1); }
.header-meta > .q-icon { grid-row: span 2; color: var(--accent-1); }.header-meta > span, .header-meta > small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.header-meta > small { color: var(--text-muted); }
.refresh-select { width: 100%; grid-column: 1 / -1; margin-top: .4rem; padding-top: .15rem; border-top: 1px solid var(--surface-border); color: var(--text-muted); font-size: .68rem; opacity: .65; transition: opacity 150ms ease; }
.refresh-select:hover, .refresh-select:focus-within { opacity: 1; }
.refresh-select :deep(.q-field__native), .refresh-select :deep(.q-field__prepend), .refresh-select :deep(.q-field__append) { color: var(--text-muted); }
.error-banner { margin-bottom: 1rem; color: #ffb9b9; background: rgba(180,40,40,.2); }
.service-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .75rem; margin-bottom: 1rem; }
.service-card { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: .7rem; min-width: 0; padding: .85rem; border: 1px solid var(--surface-border); border-radius: 14px; background: color-mix(in srgb, var(--surface-1) 94%, transparent); }
.service-card strong, .service-card small { display: block; }.service-card small { overflow: hidden; margin-top: .1rem; color: var(--text-muted); font-size: .67rem; text-overflow: ellipsis; white-space: nowrap; }
.status-dot { width: 9px; height: 9px; border-radius: 50%; background: #7b8790; box-shadow: 0 0 0 5px rgba(123,135,144,.1); }.status-dot.online { background: #64d89b; box-shadow: 0 0 0 5px rgba(100,216,155,.1); }.status-dot.offline { background: #ef6f6f; }.status-dot.degraded { background: #e9bd5c; }
.service-state { color: var(--text-muted); font-size: .62rem; text-transform: uppercase; letter-spacing: .08em; }
.metrics-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; }
.metric-card { min-width: 0; padding: 1rem; overflow: hidden; border: 1px solid var(--surface-border); border-radius: 18px; background: linear-gradient(145deg, color-mix(in srgb, var(--surface-2) 76%, transparent), var(--surface-1)); box-shadow: 0 18px 45px rgba(0,0,0,.14); }
.metric-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: .75rem; }.metric-heading span, .metric-heading small { display: block; }.metric-heading span { font-weight: 800; }.metric-heading small { overflow: hidden; max-width: 190px; margin-top: .18rem; color: var(--text-muted); font-size: .66rem; text-overflow: ellipsis; white-space: nowrap; }.metric-heading strong { color: var(--accent-1); font-size: 1.45rem; }
svg { display: block; width: 100%; height: 150px; margin: .75rem 0 .3rem; overflow: visible; }.chart-line { fill: none; stroke: var(--accent-1); stroke-width: 2; vector-effect: non-scaling-stroke; }.chart-line.secondary { stroke: var(--accent-2); }
.metric-detail { display: block; overflow: hidden; color: var(--text-muted); font-size: .68rem; text-overflow: ellipsis; white-space: nowrap; }
.no-gpu { display: grid; height: 150px; place-items: center; align-content: center; gap: .45rem; color: var(--text-muted); font-size: .72rem; }.unavailable { opacity: .72; }
@media (max-width: 1000px) { .metrics-grid { grid-template-columns: 1fr; }.service-grid { grid-template-columns: 1fr; } }
@media (max-width: 600px) { .admin-header { align-items: flex-start; flex-direction: column; }.admin-header > div:first-child { margin-right: 0; }.header-meta { width: 100%; } }
</style>
