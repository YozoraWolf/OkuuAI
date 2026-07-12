<template>
  <aside class="conversation-rail" :class="{ open }">
    <div class="rail-header">
      <div>
        <span class="rail-label">WORKSPACE</span>
        <h2>Conversations</h2>
      </div>
      <q-btn flat round dense icon="close" class="mobile-close" aria-label="Close conversations" @click="$emit('close')" />
    </div>

    <q-btn class="new-chat" unelevated no-caps icon="add" label="New conversation" @click="$emit('add-session')" />

    <q-input v-model="search" dense borderless placeholder="Search" class="session-search">
      <template #prepend><q-icon name="search" size="18px" /></template>
    </q-input>

    <div class="session-list" role="navigation" aria-label="Conversations">
      <button v-for="session in filteredSessions" :key="session.sessionId" class="session-row"
        :class="{ active: session.sessionId === selectedSessionId }" @click="selectSession(session.sessionId)">
        <span class="session-icon"><q-icon name="chat_bubble_outline" size="16px" /></span>
        <span class="session-copy">
          <span class="session-title">{{ sessionTitle(session) }}</span>
          <span class="session-preview">{{ session.lastMessage?.message || 'Ready when you are' }}</span>
        </span>
        <q-btn flat round dense icon="more_horiz" class="session-delete" aria-label="Delete conversation"
          @click.stop="$emit('remove-session', session.sessionId)" />
      </button>
    </div>

  </aside>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Session } from 'src/stores/session.store';

const props = defineProps<{
  sessions: Session[];
  selectedSessionId: string | undefined;
  open: boolean;
}>();

const emit = defineEmits<{
  (e: 'add-session'): void;
  (e: 'select-session', sessionId: string): void;
  (e: 'remove-session', sessionId: string): void;
  (e: 'close'): void;
}>();

const search = ref('');

const filteredSessions = computed(() => {
  const query = search.value.trim().toLowerCase();
  if (!query) return props.sessions;
  return props.sessions.filter(session =>
    [session.sessionId, session.lastMessage?.message, session.lastMessage?.user]
      .filter(Boolean)
      .some(value => String(value).toLowerCase().includes(query))
  );
});

const sessionTitle = (session: Session) => session.lastMessage?.message?.trim().slice(0, 42) || `Conversation ${session.sessionId}`;

const selectSession = (sessionId: string) => {
  emit('select-session', sessionId);
  emit('close');
};
</script>

<style lang="scss" scoped>
.conversation-rail { display: flex; width: 300px; flex: 0 0 300px; height: 100%; flex-direction: column; padding: 1.1rem 0.8rem; border-right: 1px solid var(--surface-border); background: var(--surface-1); }
.rail-header { display: flex; align-items: center; justify-content: space-between; padding: 0.25rem 0.35rem 1.15rem; }
.rail-label { color: var(--accent-1); font-size: 0.63rem; font-weight: 800; letter-spacing: 0.14em; }
.rail-header h2 { margin: 0.22rem 0 0; font-size: 1.08rem; letter-spacing: -0.035em; }
.new-chat { justify-content: flex-start; min-height: 42px; margin-bottom: 0.75rem; border-radius: 11px; color: var(--accent-text); font-weight: 750; background: var(--accent-1); transition: transform 150ms var(--ease-snappy), filter 150ms var(--ease-snappy); }
.new-chat:hover { filter: brightness(1.05); transform: translateY(-1px); }
.session-search { margin: 0 0.2rem 0.8rem; padding: 0.12rem 0.55rem; border: 1px solid var(--surface-border); border-radius: 10px; background: rgba(255,255,255,0.045); }
.session-list { flex: 1; overflow-x: hidden; overflow-y: auto; }
.session-row { display: flex; width: 100%; align-items: center; gap: 0.65rem; margin-bottom: 0.25rem; padding: 0.65rem; border: 1px solid transparent; border-radius: 11px; color: inherit; text-align: left; cursor: pointer; background: transparent; transition: background 160ms ease, border-color 160ms ease, transform 160ms ease; }
.session-row:hover { border-color: var(--surface-border); background: rgba(255,255,255,0.05); transform: translateX(2px); }
.session-row.active { border-color: color-mix(in srgb, var(--accent-1) 34%, transparent); background: linear-gradient(115deg, color-mix(in srgb, var(--accent-1) 15%, transparent), color-mix(in srgb, var(--accent-2) 14%, transparent)); }
.session-icon { display: grid; width: 29px; height: 29px; flex: none; place-items: center; border-radius: 9px; color: var(--accent-1); background: color-mix(in srgb, var(--accent-1) 13%, transparent); }
.session-copy { display: grid; min-width: 0; flex: 1; gap: 0.18rem; }
.session-title, .session-preview { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.session-title { font-size: 0.82rem; font-weight: 700; }
.session-preview { color: var(--text-muted); font-size: 0.72rem; }
.session-delete { opacity: 0; color: var(--text-muted); transition: opacity 160ms ease; }
.session-row:hover .session-delete, .session-row.active .session-delete { opacity: 1; }
.mobile-close { display: none; }

@media (max-width: 900px) {
  .conversation-rail { position: fixed; z-index: 30; width: min(86vw, 330px); height: 100dvh; transform: translateX(-105%); box-shadow: 24px 0 50px rgba(0,0,0,0.35); transition: transform 240ms cubic-bezier(.2,.8,.2,1); }
  .conversation-rail.open { transform: translateX(0); }
  .mobile-close { display: inline-flex; }
  .session-delete { opacity: 1; }
}
</style>
