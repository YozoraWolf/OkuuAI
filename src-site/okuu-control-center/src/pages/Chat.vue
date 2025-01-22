<template>
    <q-layout view="hHh Lpr lFf" class="full-height">
        <q-drawer side="right" bordered v-model="drawer" :mini="mini" class="border-left" @mouseenter="mini = false"
            @mouseleave="mini = true">
            <q-list>
                <q-item v-for="session in sessions" :key="session.sessionId" class="flex flex-center" clickable
                    @click="selectSession(session)">
                    <q-icon name="chat" class="q-mx-md" />
                    <q-item-section>{{ session.sessionId }}: {{ truncate(session.lastMessage || '', 30) }}</q-item-section>
                </q-item>
                <q-item class="flex flex-center" clickable @click="addNewSession">
                    <q-icon name="add" size="sm" class="q-mx-md" />
                    <q-item-section>Add New Session</q-item-section>
                </q-item>
            </q-list>

        </q-drawer>

        <q-page-container class="q-pa-none window-height">
            <div class="chat-container full-width window-height q-pa-md">
                <div class="chat-messages" v-if="selectedSession" ref="chatMessagesRef">
                    <ChatMessage v-for="(message, index) in selectedSession.messages" :key="index"
                        :timestamp="message.timestamp" :user="message.user" :message="message.message" />
                </div>
                <div v-else class="chat-messages">
                    <h1>Chat</h1>
                    <p>Select a session to start chatting</p>
                </div>
                <div v-if="isLoadingResponse">
                    <q-spinner-dots color="primary" size="md" />
                </div>
                <div class="chat-input">
                    <q-input :disable="!selectedSession || isLoadingResponse" v-model="newMessage" placeholder="Type a message"
                        @keyup.enter="sendMessage" class="q-pb-md">
                        <template v-slot:append>
                            <q-btn :disable="sendBtnActive" flat round icon="send"
                                :color="`${!sendBtnActive ? 'primary' : 'gray-9'}`" @click="sendMessage" />
                        </template>
                    </q-input>
                    <div class="status-bar">
                        <q-icon :name="statusIcon" class="q-mr-sm" :color="statusColor" />
                        <span>{{ statusMessage }}</span>
                        <q-btn v-if="status === Status.DISCONNECTED" flat round icon="refresh" color="primary"
                            @click="retryConnection">
                        </q-btn>
                    </div>

                </div>
            </div>
        </q-page-container>


    </q-layout>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, onBeforeUnmount, watch } from 'vue';
import { Session, useSessionStore } from 'src/stores/session.store';
import { useQuasar } from 'quasar';
import ChatMessage from 'src/components/ChatMessage.vue';
import { SocketioService, Status } from 'src/services/socketio.service';
import { Socket } from 'socket.io-client';
import { truncate } from 'src/utils/okuuai_utils';

const drawer = ref(true);
const mini = ref(true);
const newMessage = ref('');
const sessionStore = useSessionStore();
const sessions = computed(() => sessionStore.sessions);
const selectedSession = ref<Session | null>(null);
const chatMessagesRef = ref();

const isLoadingResponse = ref(false);

const $q = useQuasar();

const socketIO = ref<SocketioService>();
const socket = ref<Socket>();

const statusIcon = ref('cloud_off');
const statusColor = ref('red');
const statusMessage = ref('Disconnected');



onMounted(async () => {
    $q.loading.show();
    await sessionStore.fetchAllSessions();
    $q.loading.hide();
});

onBeforeUnmount(() => {
    socket.value?.disconnect();
});

const selectSession = async (session: Session) => {
    selectedSession.value = session;
    await sessionStore.fetchSessionMessages(session.sessionId);
    scrollToBottom();
    mini.value = true;

    socketIO.value = new SocketioService();
    socket.value = await socketIO.value.initializeSocket(session.sessionId, sessionStore);


};

const addNewSession = async () => {
    await sessionStore.addSession();
};

const sendMessage = () => {
    if (selectedSession.value && newMessage.value.trim()) {
        const message = {
            timestamp: Date.now(),
            user: 'wolf',
            message: newMessage.value,
            sessionId: selectedSession.value.sessionId,
        };
        sessionStore.addMessageToSession(message);
        socket.value?.emit('chat', message);
        newMessage.value = '';
        isLoadingResponse.value = true;
        scrollToBottom();

        // After sending the message if theres 15 seconds of inactivity, renable the send button
        setTimeout(() => {
            isLoadingResponse.value = false;
        }, 15000);
    }
};

const retryConnection = () => {
    socketIO.value?.retryConnection();
};

const scrollToBottom = () => {
    chatMessagesRef.value.scrollTop = chatMessagesRef.value.scrollHeight;
};

// computed

const sendBtnActive = computed(() => {
    return !selectedSession.value || !newMessage.value.trim();
});

const status = computed(() => socketIO.value?.getStatus());

// watch
watch(() => selectedSession.value?.messages, (messages) => {
    if (messages?.length) {
        scrollToBottom();
        console.log("Messages", messages);
        console.log('last message', messages[messages.length - 1]);
        if(messages[messages.length-1]?.user.toLowerCase() === "okuu") isLoadingResponse.value = false;
    }
}, { deep: true });

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
</style>