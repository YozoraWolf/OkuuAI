<template>
    <div>
        <q-drawer side="right" bordered v-model="drawer" :mini="mini" mini-to-overlay :width="300" class="border-left chat-drawer" @mouseenter="startHoverTimer"
            @mouseleave="stopHoverTimer">
            <q-list>
                <q-item class="flex flex-center" clickable @click="$emit('add-session')">
                    <q-icon name="add" size="sm" class="q-mx-md" />
                    <q-item-section>Add New Session</q-item-section>
                </q-item>
                <q-item v-for="session in sessions" :key="session.sessionId" class="flex flex-center session-item" clickable
                    @click="$emit('select-session', session.sessionId)" :active="session.sessionId === selectedSessionId">
                    <q-icon name="chat" color="white" class="q-mx-md" />
                    <q-item-section class="text-white">{{ session.sessionId }}: {{ session.lastMessage?.user as string
                        }}: {{ truncate(session.lastMessage?.message as string, 30)
                        }}</q-item-section>
                    <q-btn v-if="!mini" flat round color="white" icon="close" class="delete-btn"
                        @click.stop="$emit('remove-session', session.sessionId)" />
                </q-item>

            </q-list>

        </q-drawer>

        <transition name="backdrop-fade">
          <div v-if="!mini" class="drawer-backdrop" @click="stopHoverTimer"></div>
        </transition>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { truncate } from 'src/utils/okuuai_utils';
import { Session } from 'src/stores/session.store'; // Assuming Session type is exported from store or we can use 'any' if not easily available, but better to be typed.

// We need to know what 'Session' type is. In Chat.vue it uses `sessionStore.sessions`.
// Let's check session.store.ts to see if Session interface is exported.
// For now I will use 'any' for the prop type to avoid import errors if I'm not sure, 
// but looking at Chat.vue imports: import { useSessionStore } from 'src/stores/session.store';
// I'll assume I can import the type or just define the prop without strict type for now to match existing code style if needed, 
// but Vue 3 + TS usually wants types. 
// Chat.vue doesn't import a Session type explicitly in the script setup, it infers from store.
// I'll use `any[]` for sessions prop for now to be safe and avoid compilation error if type isn't exported, 
// or I can check the store file.
// Let's check the store file first to be better.

defineProps<{
    sessions: any[];
    selectedSessionId: string | undefined;
}>();

defineEmits<{
    (e: 'add-session'): void;
    (e: 'select-session', sessionId: string): void;
    (e: 'remove-session', sessionId: string): void;
}>();

const drawer = ref(true);
const mini = ref(true);
const hoverTimer = ref<number | null>(null);

const startHoverTimer = () => {
    hoverTimer.value = window.setTimeout(() => {
        mini.value = false;
    }, 500);
};

const stopHoverTimer = () => {
    if (hoverTimer.value) {
        clearTimeout(hoverTimer.value);
        hoverTimer.value = null;
    }
    mini.value = true;
};
</script>

<style lang="scss" scoped>
.drawer-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 2000;
  pointer-events: all;
}

.backdrop-fade-enter-active,
.backdrop-fade-leave-active {
  transition: opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.backdrop-fade-enter-from,
.backdrop-fade-leave-to {
  opacity: 0;
}

.q-item--active {
    background-color: var(--q-primary) !important;
}

.delete-btn {
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s ease-in-out;
}

.session-item:hover .delete-btn {
    opacity: 1;
    pointer-events: auto;
}
</style>
