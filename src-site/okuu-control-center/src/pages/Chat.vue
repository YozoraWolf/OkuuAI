<template>
    <q-layout view="hHh Lpr lFf" class="full-height">
        <SessionsDrawer
            :sessions="sessions"
            :selected-session-id="selectedSessionId"
            @add-session="addNewSession"
            @select-session="selectSession"
            @remove-session="removeSession"
        />

        <q-page-container class="q-pa-none window-height">
            <div class="chat-container full-width window-height">
                <div class="chat-messages q-pa-md" v-if="selectedSession && selectedSession.messages"
                    ref="chatMessagesRef" v-scale>
                    <q-inner-loading :showing="isLoadingSessionMessages">
                        <q-spinner color="primary" size="70" />
                    </q-inner-loading>
                    <ChatMessage v-for="(message, index) in selectedSession.messages" :key="index"
                        :timestamp="message.timestamp" :user="message.user"
                        :avatar="message.user.toLocaleLowerCase() === 'okuu' ? okuu_pfp : ''" :message="message"
                        :deleteBtn="index !== 0" />
                </div>
                <div v-else class="chat-messages q-pa-md flex flex-center column">
                    <q-icon name="chat" size="100px" color="white" />
                    <h1>Chat</h1>
                    <h2>Select a session to start chatting</h2>
                </div>
                <div v-if="isLoadingResponse || isStreaming">
                    <q-spinner-dots color="primary" size="md" class="q-mx-md" />
                </div>
                <ChatInput v-if="selectedSession" :loading="isLoadingResponse" :generating="isGenerating"
                    :disable-input="!selectedSession || (!isLoadingResponse && configLoading)" :status="status"
                    :status-message="statusMessage" :status-icon="statusIcon" :status-color="statusColor"
                    @send="sendMessage" @stop="stopGeneration" @retry="retryConnection" @open-config="showConfigModal"
                    @open-tools-config="openToolsConfig" />
            </div>
        </q-page-container>

        <!-- Tools Configuration Modal -->
        <ToolsConfigModal v-model:show="showToolsConfigModal" />
    </q-layout>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted, computed, onBeforeUnmount, watch } from 'vue';
import { useSessionStore } from 'src/stores/session.store';
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



// Use storeToRefs for all store properties we want to remain reactive
const sessionStore = useSessionStore();
const configStore = useConfigStore();
const authStore = useAuthStore();
const toolsStore = useToolsStore();

// Session store refs
const { sessions, currentSession, isStreaming, isGenerating } = storeToRefs(sessionStore);
const selectedSessionId = ref<string | undefined>(undefined);
const chatMessagesRef = ref();

// Config store refs
const { stream, okuuPfp, toggleThinking, currentModel, modelList, configLoading } = storeToRefs(configStore);
const okuu_pfp = computed(() => okuuPfp.value);

// Auth store refs
const { apiKey } = storeToRefs(authStore);

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
    authStore.loadApiKey();
    if (!apiKey.value) {
        router.push('/login');
        return;
    }
    isLoadingSessionMessages.value = true;
    await sessionStore.fetchAllSessions();
    await nextTick();
    sessionStore.orderSessions();
    await configStore.fetchOkuuPfp();
    // fetch thinking mode status from config store
    await configStore.fetchThinkingState();
    // fetch all downloadable models
    await configStore.fetchAllDownloadedModels();
    // fetch current model
    await configStore.getOkuuModel();
    // fetch tools configuration
    await toolsStore.fetchToolsConfig();
    await toolsStore.fetchAvailableTools();

    // If route param id is present, select that session
    if (route.params.id) {
        selectSession(route.params.id as string);
    } else {
        selectedSessionId.value = undefined;
    }
    isLoadingSessionMessages.value = false;
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
    socket.value?.disconnect();
});

const selectSession = async (sessionId: string) => {
    if (socketIO.value) {
        socketIO.value.disconnectSocket();
        socketIO.value = null;
    }
    isLoadingSessionMessages.value = true;
    await sessionStore.fetchSessionMessages(sessionId);
    sessionStore.setCurrentSessionId(sessionId);
    selectedSessionId.value = sessionId;

    scrollToBottom();
    scrollToBottom();
    socketIO.value = new SocketioService();
    socket.value = await socketIO.value.initializeSocket(sessionId, sessionStore);
    isLoadingSessionMessages.value = false;

    if (route.params.id !== sessionId) {
        router.replace({ path: `/chat/${sessionId}` });
    }
};

const addNewSession = async () => {
    const sessionId = await sessionStore.addSession();
    sessionStore.orderSessions();
    router.replace({ path: `/chat/${sessionId}` });
};

const sendMessage = async (messageText: string, file: File | null) => {
    if (selectedSession.value && messageText.trim()) {
        const timestamp = Date.now();
        const message = {
            timestamp: timestamp,
            user: 'wolf',
            message: messageText,
            sessionId: selectedSession.value.sessionId,
            memoryKey: '',
            stream: stream.value,
            think: toggleThinking.value,
            done: true, // User messages are always done
        };

        // Immediately add user message to UI for instant feedback
        sessionStore.addMessageToSession(message);

        // Then emit to server
        socket.value?.emit('chat', message);
        isLoadingResponse.value = true;
        scrollToBottom();

        if (file) {
            console.log('sending attachment');
            await sessionStore.sendAttachment(file, message);
        }

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
    flex-direction: column;
    height: 100%;
    overflow: hidden;
}

.chat-messages {
    flex: 1;
    overflow-y: auto;
}

.q-item--active {
    background-color: var(--q-primary) !important;
}
</style>