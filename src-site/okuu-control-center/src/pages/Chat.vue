<template>
    <q-layout view="hHh Lpr lFf" class="full-height">
        <q-drawer side="right" bordered v-model="drawer" :mini="mini" class="border-left" @mouseenter="startHoverTimer"
            @mouseleave="stopHoverTimer">
            <q-list>
                <q-item class="flex flex-center" clickable @click="addNewSession">
                    <q-icon name="add" size="sm" class="q-mx-md" />
                    <q-item-section>Add New Session</q-item-section>
                </q-item>
                <q-item v-for="session in sessions" :key="session.sessionId" class="flex flex-center" clickable
                    @click="selectSession(session.sessionId)" :active="session.sessionId === selectedSessionId">
                    <q-icon name="chat" color="white" class="q-mx-md" />
                    <q-item-section class="text-white">{{ session.sessionId }}: {{ session.lastMessage?.user as string
                        }}: {{ truncate(session.lastMessage?.message as string, 30)
                        }}</q-item-section>
                    <q-btn v-if="!mini" flat round color="white" icon="close"
                        @click="removeSession(session.sessionId)" />
                </q-item>

            </q-list>

        </q-drawer>

        <q-page-container class="q-pa-none window-height">
            <div class="chat-container full-width window-height">
                <div class="chat-messages q-pa-md" v-if="selectedSession && selectedSession.messages" ref="chatMessagesRef" v-scale>
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
                <div class="chat-input text-white q-pa-md" v-if="selectedSession">
                    <q-input type="textarea" autogrow :disable="!selectedSession || (!isLoadingResponse && configLoading)"
                        v-model="newMessage" placeholder="Type a message" @keyup.enter="onEnter" @keyup.shift.enter.stop
                        :readonly="isLoadingResponse || isStreaming"
                        class="q-pb-md">
                        <template v-slot:append>
                            <q-btn v-if="isGenerating" 
                                flat round icon="stop"
                                color="red" 
                                @click="stopGeneration" />
                            <q-btn v-else
                                :disable="sendBtnActive || isLoadingResponse" 
                                :loading="isLoadingResponse && !isGenerating"
                                flat round icon="send"
                                :color="`${(!sendBtnActive && !isLoadingResponse) ? 'primary' : 'gray-9'}`" 
                                @click="sendMessage" />
                        </template>
                    </q-input>
                    <div class="sub-actions row">
                        <div class="col-7 flex items-center">
                            <q-chip class="q-mx-sm" size="md" color="primary" :outline="!configStore.toggleThinking"
                                clickable @click="toggleThinkingFunc">
                                <q-icon name="mdi-brain" size="sm" class="q-mr-sm"></q-icon>
                                <div class="text-weight-bold">Think</div>
                            </q-chip>
                            <q-chip class="q-mx-sm" size="md" color="primary" :outline="!stream"
                                clickable @click="toggleStreaming">
                                <q-icon name="mdi-arrow-right" size="xs" class="q-mr-sm"></q-icon>
                                <div class="text-weight-bold">Stream</div>
                            </q-chip>
                            <q-chip class="q-mx-sm" size="md" color="primary" :outline="!ttsEnabled"
                                clickable @click="toggleTTS">
                                <q-icon name="volume_up" size="xs" class="q-mr-sm"></q-icon>
                                <div class="text-weight-bold">TTS</div>
                            </q-chip>
                            <q-select v-model="currentModel" :options="modelList"
                                option-value="name" option-label="name" emit-value
                                class="q-mx-sm" dense outlined
                                v-on:update:modelValue="configStore.setOkuuModel"
                                >
                                <template v-slot:prepend>
                                    <q-icon name="mdi-head-snowflake" />
                                </template>
                            </q-select>
                        </div>
                    </div>
                    <div class="sub-menu row">
                        <div class="status-bar col-9">
                            <q-icon :name="statusIcon" class="q-mr-sm" :color="statusColor" />
                            <span>{{ statusMessage }}</span>
                            <q-btn v-if="status === Status.DISCONNECTED" flat round icon="refresh" color="primary"
                                @click="retryConnection">
                            </q-btn>
                        </div>
                        <div class="col-2">
                            <q-file :disable="sendBtnActive" v-model="attachment"
                                accept=".txt, .pdf, .doc, .docx, .csv, .json">
                                <template v-slot:prepend>
                                    <q-icon name="attach_file" />
                                    <q-icon v-if="attachment" name="close" @click="removeAttachment" />
                                </template>
                            </q-file>
                        </div>
                        <div class="config col-1 flex justify-end">
                            <q-btn flat round icon="settings" @click="showConfigModal" />
                        </div>
                    </div>
                </div>
            </div>
        </q-page-container>


    </q-layout>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted, computed, onBeforeUnmount, watch } from 'vue';
import { useSessionStore } from 'src/stores/session.store';
import { useQuasar } from 'quasar';
import ChatMessage from 'src/components/chat/ChatMessage.vue';
import { SocketioService, Status } from 'src/services/socketio.service';
import { Socket } from 'socket.io-client';
import { truncate } from 'src/utils/okuuai_utils';
import { useConfigStore } from 'src/stores/config.store';
import ChatConfigModal from 'src/components/chat/ChatConfigModal.vue';
import { useAuthStore } from 'src/stores/auth.store';
import { useRouter, useRoute } from 'vue-router';
import { storeToRefs } from 'pinia';

const drawer = ref(true);
const mini = ref(true);
const newMessage = ref('');

// Use storeToRefs for all store properties we want to remain reactive
const sessionStore = useSessionStore();
const configStore = useConfigStore();
const authStore = useAuthStore();

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

// TTS functionality
const ttsEnabled = ref(true);
const audioQueue = ref<HTMLAudioElement[]>([]);
const currentAudio = ref<HTMLAudioElement | null>(null);

const $q = useQuasar();
const router = useRouter();
const route = useRoute();

const socketIO = ref<SocketioService | null>();
const socket = ref<Socket>();

const statusIcon = ref('cloud_off');
const statusColor = ref('red');
const statusMessage = ref('Disconnected');

const attachment = ref<File | null>(null);

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

const showConfigModal = () => {
    $q.dialog({
        component: ChatConfigModal,
        componentProps: {
            stream: configStore.stream
        }
    })
};

onMounted(async () => {
    authStore.loadApiKey();
    if(!apiKey.value) {
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
        // Stop any current audio when switching sessions
        stopCurrentAudio();
        clearAudioQueue();
        
        if (id) {
            await selectSession(id as string);
        } else {
            selectedSessionId.value = undefined;
        }
    }
);

onBeforeUnmount(() => {
    socket.value?.disconnect();
    // Clean up TTS audio
    stopCurrentAudio();
    clearAudioQueue();
    // Remove TTS event listeners
    window.removeEventListener('ttsAudio', handleTTSAudio);
    window.removeEventListener('ttsSettings', handleTTSSettings);
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
    mini.value = true;
    socketIO.value = new SocketioService();
    socket.value = await socketIO.value.initializeSocket(sessionId, sessionStore);
    
    // Set up TTS event listeners using window events (handled by SocketioService)
    console.log('🔊 Setting up TTS window event listeners for session:', sessionId);
    
    // Remove any existing listeners
    window.removeEventListener('ttsAudio', handleTTSAudio);
    window.removeEventListener('ttsSettings', handleTTSSettings);
    
    // Add new listeners
    window.addEventListener('ttsAudio', handleTTSAudio);
    window.addEventListener('ttsSettings', handleTTSSettings);
    
    if (socket.value) {
        // Request current TTS settings
        socket.value.emit('getTTSSettings');
        console.log('🔊 Requested TTS settings for session:', sessionId);
    }
    
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

const sendMessage = async () => {
    if (selectedSession.value && newMessage.value.trim()) {
        const message = {
            timestamp: Date.now(),
            user: 'wolf',
            message: newMessage.value,
            sessionId: selectedSession.value.sessionId,
            memoryKey: '',
            stream: stream.value,
            think: toggleThinking.value,
            done: false,
        };
        socket.value?.emit('chat', message);
        newMessage.value = '';
        isLoadingResponse.value = true;
        scrollToBottom();

        // After sending the message if theres 30 seconds of inactivity, renable the send button
        inputTimeout.value = setTimeout(() => {
            isLoadingResponse.value = false;
        }, 30000);

        if (attachment.value) {
            console.log('sending attachment');
            await sessionStore.sendAttachment(attachment.value, message);
            removeAttachment();
        }
    }
};

const stopGeneration = () => {
    if (socket.value && selectedSession.value) {
        socket.value.emit('stopGeneration', { sessionId: selectedSession.value.sessionId });
        isLoadingResponse.value = false;
        sessionStore.setIsGenerating(false);
        sessionStore.isStreaming = false;
        
        // Stop any current TTS audio and clear queue
        stopCurrentAudio();
        clearAudioQueue();
    }
};

const removeAttachment = () => {
    console.log('remove attachment');
    attachment.value = null;
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

const toggleThinkingFunc = async () => {
    configStore.toggleThinking = !toggleThinking.value;
    await configStore.updateToggleThinking(toggleThinking.value);
    $q.notify({
        message: `Thinking mode is now ${toggleThinking.value ? 'enabled' : 'disabled'}.`,
        color: toggleThinking.value ? 'green' : 'red',
        position: 'bottom',
        timeout: 2000,
    });
};

const toggleStreaming = () => {
    configStore.stream = !stream.value;
    $q.notify({
        message: `Streaming is now ${stream.value ? 'enabled' : 'disabled'}.`,
        color: stream.value ? 'green' : 'red',
        position: 'bottom',
        timeout: 2000,
    });
};

const toggleTTS = () => {
    ttsEnabled.value = !ttsEnabled.value;
    
    // Update TTS settings on backend
    if (socket.value) {
        socket.value.emit('updateTTSSettings', { enabled: ttsEnabled.value });
    }
    
    // Stop any current audio if disabling TTS
    if (!ttsEnabled.value) {
        stopCurrentAudio();
        clearAudioQueue();
    }
    
    $q.notify({
        message: `TTS is now ${ttsEnabled.value ? 'enabled' : 'disabled'}.`,
        color: ttsEnabled.value ? 'green' : 'red',
        position: 'bottom',
        timeout: 2000,
    });
};

const playTTSAudio = (audioData: string) => {
    if (!ttsEnabled.value) return;
    
    console.log('🔊 Processing TTS audio, data length:', audioData.length);
    
    try {
        // Convert base64 to blob and create audio element
        const byteCharacters = atob(audioData);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'audio/wav' });
        
        console.log('🔊 Created audio blob, size:', blob.size);
        
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        
        audio.onended = () => {
            console.log('🔊 Audio playback ended');
            URL.revokeObjectURL(audioUrl);
            playNextAudio();
        };
        
        audio.onerror = (error) => {
            console.error('🔊 Audio playback error:', error);
            URL.revokeObjectURL(audioUrl);
            playNextAudio();
        };
        
        audio.oncanplaythrough = () => {
            console.log('🔊 Audio can play through');
        };
        
        audioQueue.value.push(audio);
        
        // If no audio is currently playing, start playing
        if (!currentAudio.value) {
            playNextAudio();
        }
    } catch (error) {
        console.error('🔊 Error processing TTS audio:', error);
    }
};

const playNextAudio = () => {
    if (audioQueue.value.length > 0) {
        currentAudio.value = audioQueue.value.shift() || null;
        if (currentAudio.value) {
            console.log('🔊 Playing next audio from queue');
            currentAudio.value.play().catch(error => {
                console.error('🔊 Error playing audio:', error);
                playNextAudio();
            });
        }
    } else {
        currentAudio.value = null;
        console.log('🔊 Audio queue is empty');
    }
};

const stopCurrentAudio = () => {
    if (currentAudio.value) {
        currentAudio.value.pause();
        currentAudio.value = null;
    }
};

const clearAudioQueue = () => {
    audioQueue.value.forEach(audio => {
        audio.pause();
    });
    audioQueue.value = [];
};

// TTS event handlers for window events
const handleTTSAudio = (event: Event) => {
    const customEvent = event as CustomEvent;
    const audioData = customEvent.detail;
    console.log('🔊 Chat.vue received TTS audio event:', audioData);
    
    if (audioData.isComplete) {
        console.log('🔊 TTS generation completed');
        return;
    }
    
    console.log('🔊 Processing TTS audio chunk:', {
        index: audioData.index,
        text: audioData.text,
        audioLength: audioData.audio ? audioData.audio.length : 0,
        mimeType: audioData.mimeType
    });
    
    if (audioData.audio && ttsEnabled.value) {
        playTTSAudio(audioData.audio);
    } else if (!audioData.audio) {
        console.warn('🔊 No audio data in chunk');
    } else {
        console.log('🔊 TTS disabled, skipping audio playback');
    }
};

const handleTTSSettings = (event: Event) => {
    const customEvent = event as CustomEvent;
    const settings = customEvent.detail;
    console.log('🔊 Chat.vue received TTS settings:', settings);
    ttsEnabled.value = settings.enabled;
};

// computed

const sendBtnActive = computed(() => {
    return !selectedSession.value || !newMessage.value.trim();
});

const sendBtnLoading = computed(() => {
    return isLoadingResponse.value ||  configLoading.value;
});

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
const onEnter = (e: KeyboardEvent) => {
    if (e.shiftKey) {
        // Let Quasar handle new line (default behavior)
        return;
    }
    e.preventDefault();
    sendMessage();
};

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

.chat-input {
    flex-shrink: 0;
    z-index: 1;
    background-color: #222;
    border-top: gray 1px solid;
}

.status-bar {
    display: flex;
    align-items: center;
    margin-top: 10px;
    color: gray;
}

.status-bar q-icon {
    margin-right: 5px;
}

.q-item--active {
    background-color: var(--q-primary) !important;
}
</style>