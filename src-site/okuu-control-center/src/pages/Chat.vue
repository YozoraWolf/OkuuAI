<template>
    <q-layout view="hHh Lpr lFf" class="full-height">
        <q-drawer side="right" bordered v-model="drawer" :mini="mini"
            class="border-left"
            @mouseenter="mini = false" @mouseleave="mini = true">
            <q-list>
                <q-item v-for="session in sessions" :key="session.sessionId" class="flex flex-center" clickable
                    @click="selectSession(session)">
                    <q-icon name="chat" class="q-mx-md" />
                    <q-item-section>{{ session.sessionId }}: {{ session.lastMessage }}</q-item-section>
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
                    <ChatMessage
                        v-for="(message, index) in selectedSession.messages"
                        :key="index"
                        :timestamp="message.timestamp"
                        :user="message.user"
                        :message="message.message"
                    />
                </div>
                <div v-else class="chat-messages">
                    <h1>Chat</h1>
                    <p>Select a session to start chatting</p>
                </div>
                <div class="chat-input">
                    <q-input :disable="!selectedSession" v-model="newMessage" placeholder="Type a message"
                        @keyup.enter="sendMessage" class="q-pb-md">
                        <template v-slot:append>
                            <q-btn :disable="sendBtnActive" flat round icon="send"
                                :color="`${!sendBtnActive ? 'primary' : 'gray-9'}`" @click="sendMessage" />
                        </template>
                    </q-input>
                </div>
            </div>
        </q-page-container>


    </q-layout>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, onBeforeUnmount } from 'vue';
import { Message, Session, useSessionStore } from 'src/stores/session.store';
import { useQuasar } from 'quasar';
import ChatMessage from 'src/components/ChatMessage.vue';
import { SocketioService } from 'src/services/socketio.service';

const drawer = ref(true);
const mini = ref(true);
const newMessage = ref('');
const sessionStore = useSessionStore();
const sessions = ref();
const selectedSession = ref<Session | null>(null);
const chatMessagesRef = ref();

const $q = useQuasar();

let socketIO: SocketioService | any = null;



onMounted(async () => {
    $q.loading.show();
    await sessionStore.fetchAllSessions();
    sessions.value = sessionStore.sessions;
    $q.loading.hide();

    socketIO = new SocketioService();

    socketIO.onConnect(() => {
        console.log('Connected to socket');
    });

    socketIO.onMessage((message: Message) => {
        const session = sessions.value.find((session: Session) => session.sessionId === sessionStore.currentSessionId);
        if (session) {
            session.messages.push(message);
            session.lastMessage = message.message;
        }
        chatMessagesRef.value.scrollTop = chatMessagesRef.value.scrollHeight;
    });
});

onBeforeUnmount(() => {
    socketIO.disconnect();
});

const selectSession = async (session: Session) => {
    selectedSession.value = session;
    await sessionStore.fetchSessionMessages(session.sessionId);
    chatMessagesRef.value.scrollTop = chatMessagesRef.value.scrollHeight;
    mini.value = true;
};

const addNewSession = async () => {
    await sessionStore.addSession();
    sessions.value = sessionStore.sessions;
};

const sendMessage = () => {
    if (selectedSession.value && newMessage.value.trim()) {
        const message = {
            timestamp: new Date().toISOString(),
            user: 'You',
            message: newMessage.value,
            sessionId: selectedSession.value.sessionId,
        };
        selectedSession.value.messages.push(message);
        socketIO.sendMessage(message);
        newMessage.value = '';
    }
};

// computed

const sendBtnActive = computed(() => {
    return !selectedSession.value || !newMessage.value.trim();
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
</style>