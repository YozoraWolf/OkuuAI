<template>
    <q-page class="chat-page">
        <SessionsDrawer
            :sessions="sessions"
            :selected-session-id="selectedSessionId"
            :open="sidebarOpen"
            @add-session="addNewSession"
            @select-session="selectSession"
            @remove-session="removeSession"
            @close="sidebarOpen = false"
        />

        <section class="chat-container" :class="{ 'conversation-mode': conversationMode }">
                <header class="chat-toolbar" v-if="selectedSession">
                    <div class="toolbar-left">
                        <q-btn flat round dense icon="menu" class="mobile-menu" aria-label="Open conversations" @click="sidebarOpen = true" />
                        <span class="toolbar-title">{{ conversationMode ? 'Conversation Mode' : 'Chat' }}</span>
                    </div>
                    <div class="connection-pill" :class="statusColor">
                        <q-icon :name="statusIcon" size="16px" /> {{ statusMessage }}
                    </div>
                    <div class="toolbar-actions">
                        <q-btn
                            flat round dense
                            :icon="conversationMode ? 'chat' : 'screen_share'"
                            :color="conversationMode ? 'primary' : undefined"
                            :aria-label="conversationMode ? 'Return to chat' : 'Enter Conversation Mode'"
                            @click="toggleConversationMode"
                        ><q-tooltip>{{ conversationMode ? 'Return to chat' : 'Enter Conversation Mode' }}</q-tooltip></q-btn>
                        <q-btn flat round dense icon="add" aria-label="New conversation" @click="addNewSession"><q-tooltip>New conversation</q-tooltip></q-btn>
                        <q-btn flat round dense icon="delete_outline" aria-label="Delete conversation" @click="removeSession(selectedSession.sessionId)"><q-tooltip>Delete conversation</q-tooltip></q-btn>
                    </div>
                </header>
                <SharedScreenPanel v-if="conversationMode" @state-changed="handleScreenState" @frame="handleScreenFrame" />
                <div class="chat-messages" v-if="selectedSession && selectedSession.messages"
                    ref="chatMessagesRef" v-scale @scroll.passive="handleHistoryScroll">
                    <div class="history-control" v-if="historyState?.hasMore">
                        <q-btn flat no-caps :loading="historyState.loadingOlder" label="Load earlier messages"
                            icon="history" @click="loadOlderMessages" />
                    </div>
                    <q-inner-loading :showing="isLoadingSessionMessages">
                        <q-spinner color="primary" size="70" />
                    </q-inner-loading>
                    <ChatMessage v-for="(message, index) in selectedSession.messages" :key="message.memoryKey || `${message.sessionId}-${message.timestamp}-${index}`"
                        :timestamp="message.timestamp" :user="message.user"
                        :avatar="/^okuu/i.test(message.user) ? okuu_pfp : ''" :message="message"
                        :deleteBtn="index !== 0" :generating="/^okuu/i.test(message.user) && index === selectedSession.messages.length - 1 && !message.done" />
                </div>
                <div v-else class="chat-empty flex flex-center column">
                    <q-btn flat round dense icon="menu" class="mobile-menu empty-menu" aria-label="Open conversations" @click="sidebarOpen = true" />
                    <div class="empty-orb"><q-icon name="forum" size="44px" /></div>
                    <span class="eyebrow">OKUU CONTROL CENTER</span>
                    <h1>What would you like to explore?</h1>
                    <p>Choose a saved conversation or start a new one whenever you are ready.</p>
                </div>
                <ObservationFeed v-if="conversationMode" :observations="observations" />
                <ChatInput v-if="selectedSession" :loading="isLoadingResponse" :generating="isGenerating"
                    :disable-input="!selectedSession || (!isLoadingResponse && configLoading)"
                    @send="sendMessage" @stop="stopGeneration" @open-config="showConfigModal"
                    @open-tools-config="openToolsConfig" />
        </section>

        <!-- Tools Configuration Modal -->
        <ToolsConfigModal v-model:show="showToolsConfigModal" />
    </q-page>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted, computed, onBeforeUnmount, watch } from 'vue';
import { useSessionStore, type Message } from 'src/stores/session.store';
import { useQuasar } from 'quasar';
import ChatMessage from 'src/components/chat/ChatMessage.vue';
import SessionsDrawer from 'src/components/chat/SessionsDrawer.vue';
import ChatInput from 'src/components/chat/ChatInput.vue';
import { SocketioService, Status } from 'src/services/socketio.service';
import { Socket } from 'socket.io-client';
import { useConfigStore } from 'src/stores/config.store';
import ChatConfigModal from 'src/components/chat/ChatConfigModal.vue';
import ToolsConfigModal from 'src/components/chat/ToolsConfigModal.vue';
import { useAuthStore } from 'src/stores/auth.store';
import { useToolsStore } from 'src/stores/tools.store';
import { useRouter, useRoute } from 'vue-router';
import { storeToRefs } from 'pinia';
import SharedScreenPanel from 'src/components/conversation/SharedScreenPanel.vue';
import ObservationFeed from 'src/components/conversation/ObservationFeed.vue';
import type { ConversationObservation, ScreenFrame } from 'src/types/conversation';



// Use storeToRefs for all store properties we want to remain reactive
const sessionStore = useSessionStore();
const configStore = useConfigStore();
const authStore = useAuthStore();
const toolsStore = useToolsStore();

// Session store refs
const { sessions, currentSession, isStreaming, isGenerating } = storeToRefs(sessionStore);
const selectedSessionId = ref<string | undefined>(undefined);
const sidebarOpen = ref(false);
const chatMessagesRef = ref();
const conversationMode = ref(false);
const observations = ref<ConversationObservation[]>([]);

// Config store refs
const { stream, okuuPfp, toggleThinking, currentModel, modelList, configLoading } = storeToRefs(configStore);
const okuu_pfp = computed(() => okuuPfp.value);

// Auth store refs
// Note: authStore provides `isAuthenticated` and token/user state.

const isLoadingResponse = ref(false);
const isLoadingSessionMessages = ref(false);
const inputTimeout = ref();

const $q = useQuasar();
const router = useRouter();
const route = useRoute();

const socketIO = ref<SocketioService | null>();
const socket = ref<Socket>();

const statusIcon = ref('cloud_off');
const statusColor = ref('red');
const statusMessage = ref('Disconnected');





const showToolsConfigModal = ref(false);

const showConfigModal = () => {
    $q.dialog({
        component: ChatConfigModal,
        componentProps: {
            stream: configStore.stream
        }
    })
};

const openToolsConfig = () => {
    showToolsConfigModal.value = true;
};

onMounted(async () => {
    if (!authStore.isAuthenticated) {
        router.push('/login');
        return;
    }
    isLoadingSessionMessages.value = true;
    try {
        const loaded = await sessionStore.fetchAllSessions();
        if (!loaded || !authStore.isAuthenticated) return;
        await nextTick();
        sessionStore.orderSessions();
        await configStore.fetchOkuuPfp();
        await configStore.fetchThinkingState();
        await configStore.fetchAllDownloadedModels();
        await configStore.getOkuuModel();
        await toolsStore.fetchToolsConfig();
        await toolsStore.fetchAvailableTools();

        if (route.params.id) {
            await selectSession(route.params.id as string);
        } else {
            selectedSessionId.value = undefined;
        }
    } finally {
        isLoadingSessionMessages.value = false;
    }
});

// Watch for route changes to update chat session
watch(
    () => route.params.id,
    async (id) => {
        if (id) {
            await selectSession(id as string);
        } else {
            selectedSessionId.value = undefined;
        }
    }
);

onBeforeUnmount(() => {
    socket.value?.off('conversation:observation', receiveObservation);
    socket.value?.disconnect();
});

const selectSession = async (sessionId: string) => {
    conversationMode.value = false;
    observations.value = [];
    if (socketIO.value) {
        socketIO.value.disconnectSocket();
        socketIO.value = null;
    }
    isLoadingSessionMessages.value = true;
    const loaded = await sessionStore.fetchSessionMessages(sessionId);
    if (!loaded || !authStore.isAuthenticated) {
        isLoadingSessionMessages.value = false;
        return;
    }
    sessionStore.setCurrentSessionId(sessionId);
    selectedSessionId.value = sessionId;

    await nextTick();
    scrollToBottom();
    socketIO.value = new SocketioService();
    socket.value = await socketIO.value.initializeSocket(sessionId, sessionStore);
    socket.value.on('conversation:observation', receiveObservation);
    socket.value.on('conversation:error', (error: { message?: string }) => {
        $q.notify({ type: 'warning', message: error.message || 'Conversation Mode is unavailable.' });
    });
    isLoadingSessionMessages.value = false;

    if (route.params.id !== sessionId) {
        router.replace({ path: `/chat/${sessionId}` });
    }
};

const receiveObservation = (observation: ConversationObservation) => {
    if (observations.value.some(item => item.id === observation.id)) return;
    observations.value.push(observation);
    if (observations.value.length > 200) observations.value.shift();
};

const toggleConversationMode = () => {
    if (conversationMode.value) {
        conversationMode.value = false;
        return;
    }
    if (!socket.value?.connected) {
        $q.notify({ type: 'warning', message: 'Connect to OkuuAI before entering Conversation Mode.' });
        return;
    }
    socket.value.timeout(5000).emit(
        'conversation:join', { sessionId: selectedSession.value?.sessionId },
        (error: Error | null, result?: { enabled: boolean; observations: ConversationObservation[] }) => {
            if (error) {
                $q.notify({ type: 'negative', message: 'Conversation Mode did not respond.' });
                return;
            }
            if (!result?.enabled) {
                $q.notify({ type: 'warning', message: 'Conversation Mode is disabled. An administrator can enable it under Modules.' });
                return;
            }
            observations.value = result.observations;
            conversationMode.value = true;
        },
    );
};

const handleScreenState = (state: { shared: boolean; application?: string; stream?: 'screen' | 'camera' }) => {
    socket.value?.emit('conversation:screen-state', state);
};

const handleScreenFrame = (frame: ScreenFrame) => {
    socket.value?.emit('conversation:frame', frame, (result: { accepted: boolean; error?: string }) => {
        if (result?.error) console.warn('Screen frame was rejected:', result.error);
    });
};

const addNewSession = async () => {
    const sessionId = await sessionStore.addSession();
    sessionStore.orderSessions();
    router.replace({ path: `/chat/${sessionId}` });
};

const readImageAsBase64 = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
});

const sendMessage = async (messageText: string, file: File | null) => {
    if (selectedSession.value && (messageText.trim() || file)) {
        const timestamp = Date.now();
        const clientMessageId = globalThis.crypto?.randomUUID?.() ?? `${timestamp}-${Math.random().toString(36).slice(2)}`;
        const message: Message = {
            timestamp: timestamp,
            clientMessageId,
            user: 'wolf',
            message: messageText.trim() || 'Please analyze the attached file.',
            sessionId: selectedSession.value.sessionId,
            memoryKey: '',
            stream: stream.value,
            think: toggleThinking.value && configStore.modelSupportsThinking,
            done: true, // User messages are always done
        };

        isLoadingResponse.value = true;
        let outboundMessage: Message = message;
        if (file) {
            const fileName = await sessionStore.sendAttachment(file, message);
            if (!fileName) {
                isLoadingResponse.value = false;
                return;
            }
            outboundMessage = { ...message, file: fileName };
        }

        // Show image attachments immediately; the server echo persists the same
        // base64 attachment so it remains available when history is reloaded.
        const optimisticMessage = file?.type.startsWith('image/')
            ? { ...outboundMessage, attachment: await readImageAsBase64(file) }
            : outboundMessage;
        sessionStore.addMessageToSession(optimisticMessage);

        // Then emit to server
        socket.value?.emit('chat', outboundMessage);
        scrollToBottom();

        // After sending the message if theres 30 seconds of inactivity, renable the send button
        inputTimeout.value = setTimeout(() => {
            isLoadingResponse.value = false;
        }, 30000);
    }
};

const stopGeneration = () => {
    if (socket.value && selectedSession.value) {
        socket.value.emit('stopGeneration', { sessionId: selectedSession.value.sessionId });
        isLoadingResponse.value = false;
        sessionStore.setIsGenerating(false);
        sessionStore.isStreaming = false;
    }
};



const retryConnection = () => {
    socketIO.value?.retryConnection();
};

const scrollToBottom = () => {
    console.log('scrolling to bottom');
    nextTick(() => {
        chatMessagesRef.value.scrollTop = chatMessagesRef.value.scrollHeight;
    });
};

const renableInput = () => {
    clearTimeout(inputTimeout.value);
};



const removeSession = async (sessionId: string) => {
    $q.dialog({
        title: 'Confirm',
        message: `Are you sure you want to remove this session? (Id: ${sessionId})`,
        cancel: true,
        persistent: true
    }).onOk(async () => {
        await sessionStore.deleteSession(sessionId);
        if (selectedSessionId.value === sessionId) {
            selectedSessionId.value = undefined;
            // Update route to /chat (no id) using path navigation
            router.replace({ path: `/chat` });
        }
    }).onCancel(() => {
        //console.log('Cancelled');
    });
};



// computed



const status = computed(() => socketIO.value?.getStatus());

const selectedSession = computed(() => {
    return selectedSessionId.value ? sessionStore.getSessionById(selectedSessionId.value) : undefined;
});

const historyState = computed(() => selectedSessionId.value ? sessionStore.history[selectedSessionId.value] : undefined);

const loadOlderMessages = async () => {
    if (!selectedSessionId.value || !chatMessagesRef.value) return;
    const container = chatMessagesRef.value as HTMLElement;
    const oldHeight = container.scrollHeight;
    const oldTop = container.scrollTop;
    const loaded = await sessionStore.loadOlderMessages(selectedSessionId.value);
    if (loaded) {
        await nextTick();
        container.scrollTop = container.scrollHeight - oldHeight + oldTop;
    }
};

const handleHistoryScroll = () => {
    if (chatMessagesRef.value?.scrollTop < 72 && historyState.value?.hasMore && !historyState.value.loadingOlder) {
        void loadOlderMessages();
    }
};

// watch

// Watch for generation state changes to clear loading state
watch(() => isGenerating.value, (generating) => {
    console.log('isGenerating changed:', generating);
    if (generating) {
        // When generation starts, clear the loading state so stop button shows
        console.log('Setting isLoadingResponse to false');
        isLoadingResponse.value = false;
    }
});

// Watch isLoadingResponse changes
watch(() => isLoadingResponse.value, (loading) => {
    console.log('isLoadingResponse changed:', loading);
});

// Watch for streaming completion: if last message is from Okuu and done, clear loading
watch(
    () => selectedSession.value,
    (session) => {
        if (!session) return;
        renableInput();
        scrollToBottom();
        const lastMsg = session.messages[session.messages.length - 1];
        if (
            lastMsg &&
            lastMsg.user &&
            lastMsg.user.toLowerCase() === 'okuu' &&
            lastMsg.done === true &&
            (isLoadingResponse.value || isStreaming.value)
        ) {
            isLoadingResponse.value = false;
            isStreaming.value = false;
        }
    },
    { deep: true }
);

watch(() => status.value, (status) => {
    console.log('status', status);
    if (status === Status.CONNECTED) {
        statusIcon.value = 'cloud_done';
        statusColor.value = 'green';
        statusMessage.value = 'Connected';
    } else if (status === Status.DISCONNECTED) {
        statusIcon.value = 'cloud_off';
        statusColor.value = 'red';
        statusMessage.value = 'Disconnected';

    } else if (status === Status.PINGING) {
        statusIcon.value = 'cloud_upload';
        statusColor.value = 'blue';
        statusMessage.value = 'Connecting';
    } else if (status === Status.TIMEOUT) {
        statusIcon.value = 'cloud_off';
        statusColor.value = 'red';
        statusMessage.value = 'Connection timeout';
        $q.notify({
            message: 'Connection lost.',
            color: 'red',
            position: 'bottom',
            timeout: 2000,
        });
    }
});

// Replace sendMessage on enter with this handler


</script>

<style lang="scss" scoped>
.chat-container {
    display: flex;
    min-width: 0;
    flex: 1;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    background: var(--surface-0);
}

.chat-container.conversation-mode {
    display: grid;
    grid-template-areas:
        "toolbar toolbar"
        "screen screen"
        "messages commentary"
        "input commentary";
    grid-template-columns: minmax(0, 1fr) minmax(240px, 340px);
    grid-template-rows: auto minmax(220px, 1.1fr) minmax(0, 1fr) auto;
}

.conversation-mode .chat-toolbar { grid-area: toolbar; }
.conversation-mode .chat-messages { grid-area: messages; padding: .8rem 1rem; min-height: 0; }
.conversation-mode :deep(.chat-input) { grid-area: input; }
.conversation-mode .screen-panel { min-height: 0; }
.conversation-mode :deep(.observation-feed) { min-height: 0; }

.chat-page { display: flex; height: 100dvh; overflow: hidden; }

/* Narrow / tablet: stack everything full-width, keep the chat (what Okuu says) prominent. */
@media (max-width: 1024px) {
    .chat-container.conversation-mode {
        grid-template-areas:
            "toolbar"
            "screen"
            "messages"
            "commentary"
            "input";
        grid-template-columns: 1fr;
        grid-template-rows: auto minmax(160px, 38vh) minmax(0, 1fr) minmax(120px, 30vh) auto;
    }
}

/* Phones: tighten spacing and cap the preview/feed so the chat keeps the most room. */
@media (max-width: 560px) {
    .chat-container.conversation-mode {
        grid-template-rows: auto minmax(150px, 34vh) minmax(0, 1fr) minmax(110px, 26vh) auto;
    }
    .conversation-mode .chat-messages { padding: .7rem .8rem; }
}

.chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 1.25rem clamp(1rem, 4vw, 4.5rem) 2rem;
    scroll-behavior: smooth;
}

.chat-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 52px;
    padding: 0.55rem clamp(1rem, 4vw, 2rem);
    border-bottom: 1px solid var(--surface-border);
    background: color-mix(in srgb, var(--surface-0) 88%, transparent);
    backdrop-filter: blur(18px);
}

.chat-empty h1 {
    margin: 0.25rem 0 0;
    font-size: clamp(1.15rem, 2vw, 1.55rem);
    letter-spacing: -0.035em;
}

.toolbar-left, .toolbar-actions { display: flex; align-items: center; gap: 0.3rem; }
.toolbar-title { font-size: 0.88rem; font-weight: 750; letter-spacing: -0.02em; }
.toolbar-actions { margin-left: 0.5rem; }
.toolbar-actions :deep(.q-btn) { color: var(--text-muted); }
.toolbar-actions :deep(.q-btn:hover) { color: var(--accent-1); background: color-mix(in srgb, var(--accent-1) 10%, transparent); }

.mobile-menu { display: none; }

.eyebrow {
    color: var(--accent-1);
    font-size: 0.68rem;
    font-weight: 800;
    letter-spacing: 0.13em;
}

.connection-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.45rem 0.7rem;
    border: 1px solid var(--surface-border);
    border-radius: 999px;
    color: var(--text-muted);
    font-size: 0.78rem;
}

.connection-pill.green { color: #a8e8c6; }
.connection-pill.red { color: #ff9a9a; }

.history-control {
    display: flex;
    justify-content: center;
    margin: 0 0 0.8rem;
}

.history-control :deep(.q-btn) {
    color: var(--text-muted);
    border: 1px solid var(--surface-border);
    border-radius: 999px;
    background: var(--surface-1);
}

.chat-empty {
    flex: 1;
    text-align: center;
    padding: 2rem;
}

.empty-menu { position: absolute; top: 1rem; left: 1rem; }

.chat-empty p { color: var(--text-muted); margin: 0.75rem 0 0; }

.empty-orb {
    display: grid;
    place-items: center;
    width: 92px;
    height: 92px;
    margin-bottom: 1.35rem;
    border: 1px solid var(--surface-border);
    border-radius: 32px;
    color: var(--accent-1);
    background: var(--surface-2);
    box-shadow: none;
    transform: none;
}

.q-item--active {
    background-color: var(--q-primary) !important;
}

@media (max-width: 700px) {
    .mobile-menu { display: inline-flex; margin-right: 0.45rem; vertical-align: middle; }
    .chat-toolbar { padding: 0.45rem 0.75rem; }
    .connection-pill { font-size: 0; padding: 0.5rem; }
    .connection-pill .q-icon { margin: 0; }
    .chat-messages { padding: 0.75rem 0.85rem 1.25rem; }
}

@media (max-width: 900px) {
    .chat-container.conversation-mode {
        display: grid;
        overflow-y: auto;
        grid-template-areas: "toolbar" "screen" "commentary" "messages" "input";
        grid-template-columns: minmax(0, 1fr);
        grid-template-rows: auto minmax(310px, auto) auto minmax(260px, 1fr) auto;
    }
    .conversation-mode .chat-toolbar { position: sticky; top: 0; z-index: 5; }
    .conversation-mode .chat-messages { min-height: 260px; overflow-y: auto; }
}
</style>
