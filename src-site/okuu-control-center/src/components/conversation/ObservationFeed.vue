<template>
  <aside class="observation-feed">
    <header>
      <div><span class="eyebrow">LIVE COMMENTARY</span><h2>What OkuuAI notices</h2></div>
      <q-btn flat round dense icon="filter_list" aria-label="Filter observations">
        <q-menu>
          <q-list dense>
            <q-item v-for="option in filterOptions" :key="option.value" clickable v-close-popup @click="filter = option.value">
              <q-item-section>{{ option.label }}</q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-btn>
    </header>
    <div class="filter-label">{{ activeFilterLabel }}</div>
    <div ref="feed" class="feed-list">
      <article v-for="observation in filteredObservations" :key="observation.id" :class="observation.category">
        <div class="observation-icon"><q-icon :name="icons[observation.category]" size="17px" /></div>
        <div>
          <div class="observation-meta"><span>{{ observation.category }}</span><time>{{ formatTime(observation.timestamp) }}</time></div>
          <p>{{ observation.message }}</p>
          <small v-if="observation.application || observation.stream">
            <q-icon v-if="observation.stream === 'camera'" name="videocam" size="12px" class="source-icon" />
            <q-icon v-else-if="observation.stream === 'screen'" name="desktop_windows" size="12px" class="source-icon" />
            {{ observation.application || (observation.stream === 'camera' ? 'camera' : 'screen') }}
          </small>
        </div>
      </article>
      <div v-if="filteredObservations.length === 0" class="empty-feed">
        <q-icon name="visibility" size="26px" />
        <span>Observations will appear here as the shared workspace changes.</span>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import type { ConversationObservation, ObservationCategory } from 'src/types/conversation';

const props = defineProps<{ observations: ConversationObservation[] }>();
const feed = ref<HTMLElement>();
const filter = ref<'all' | ObservationCategory>('all');
const filterOptions: { label: string; value: 'all' | ObservationCategory }[] = [
  { label: 'All observations', value: 'all' },
  { label: 'Info', value: 'info' },
  { label: 'Suggestions', value: 'suggestion' },
  { label: 'Warnings', value: 'warning' },
  { label: 'Errors', value: 'error' },
  { label: 'Success', value: 'success' },
];
const icons: Record<ObservationCategory, string> = {
  info: 'visibility', suggestion: 'lightbulb', warning: 'warning_amber', error: 'error_outline', success: 'check_circle',
};
const filteredObservations = computed(() => filter.value === 'all'
  ? props.observations
  : props.observations.filter(observation => observation.category === filter.value));
const activeFilterLabel = computed(() => filterOptions.find(option => option.value === filter.value)?.label);
const formatTime = (timestamp: number) => new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

watch(() => props.observations.length, () => nextTick(() => {
  if (feed.value) feed.value.scrollTop = feed.value.scrollHeight;
}));
</script>

<style lang="scss" scoped>
.observation-feed { grid-area: commentary; display: flex; min-height: 0; flex-direction: column; overflow: hidden; border-left: 1px solid var(--surface-border); background: color-mix(in srgb, var(--surface-1) 78%, var(--surface-0)); }
header { display: flex; align-items: center; justify-content: space-between; padding: 1rem 1rem .65rem; }
.eyebrow { color: var(--accent-1); font-size: .6rem; font-weight: 850; letter-spacing: .15em; }
h2 { margin: .15rem 0 0; font-size: .98rem; letter-spacing: -.025em; }
.filter-label { margin: 0 1rem .7rem; color: var(--text-muted); font-size: .64rem; }
.feed-list { flex: 1; overflow-y: auto; padding: 0 .75rem 1rem; }
article { display: grid; grid-template-columns: 30px 1fr; gap: .65rem; padding: .75rem .55rem; border-top: 1px solid var(--surface-border); }
.observation-icon { display: grid; width: 28px; height: 28px; place-items: center; border-radius: 9px; color: #9db9c8; background: rgba(120,160,185,.11); }
article.suggestion .observation-icon { color: #f1c561; background: rgba(241,197,97,.1); }
article.warning .observation-icon, article.error .observation-icon { color: #f28a7c; background: rgba(242,138,124,.1); }
article.success .observation-icon { color: #75d4a5; background: rgba(117,212,165,.1); }
.observation-meta { display: flex; justify-content: space-between; gap: .5rem; color: var(--text-muted); font-size: .57rem; letter-spacing: .07em; text-transform: uppercase; }
.observation-meta time { letter-spacing: 0; }
p { margin: .28rem 0 0; color: var(--text-strong); font-size: .73rem; line-height: 1.45; }
small { display: block; margin-top: .3rem; color: var(--text-muted); font-size: .6rem; }
.source-icon { vertical-align: -2px; margin-right: 3px; }
.empty-feed { display: grid; min-height: 180px; place-items: center; align-content: center; gap: .65rem; padding: 1.5rem; color: var(--text-muted); text-align: center; font-size: .7rem; line-height: 1.45; }
@media (max-width: 900px) { .observation-feed { border-top: 1px solid var(--surface-border); border-left: 0; } .feed-list { max-height: 220px; } }
</style>
