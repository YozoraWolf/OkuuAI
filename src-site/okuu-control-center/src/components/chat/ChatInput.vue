<template>
    <div class="chat-input text-white q-pa-md">
        <q-input type="textarea" autogrow :disable="disableInput"
            v-model="newMessage" placeholder="Type a message" @keyup.enter="onEnter" @keyup.shift.enter.stop
            :readonly="loading || generating"
            class="q-pb-md">
            <template v-slot:append>
                <q-btn v-if="generating" 
                    flat round icon="stop"
                    color="red" 
                    @click="stopGeneration" />
                <q-btn v-else
                    :disable="!canSend || loading" 
                    :loading="loading && !generating"
                    flat round icon="send"
                    :color="`${(!canSend && !loading) ? 'primary' : 'gray-9'}`" 
                    @click="onSend" />
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
                <q-chip class="q-mx-sm" size="md" 
                    :color="toolsStore.isToolsEnabled ? 'secondary' : 'grey-6'" 
                    :outline="!toolsStore.isToolsEnabled"
                    clickable @click="openToolsConfig"
                    @contextmenu.prevent="quickToggleTools">
                    <q-icon :name="toolsStore.isToolsEnabled ? 'build' : 'build_circle'" size="sm" class="q-mr-sm"></q-icon>
                    <div class="text-weight-bold">Tools {{ toolsStore.isToolsEnabled ? `(${toolsStore.enabledToolsCount})` : '' }}</div>
                    <q-tooltip class="text-body2">
                        <div>Left click: Configure tools</div>
                        <div>Right click: Quick toggle on/off</div>
                        <div v-if="toolsStore.isAutoDetectEnabled" class="q-mt-xs text-green">✨ Smart Detection Active</div>
                    </q-tooltip>
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
            <div class="status-bar col-7">
                <q-icon :name="statusIcon" class="q-mr-sm" :color="statusColor" />
                <span>{{ statusMessage }}</span>
                <q-btn v-if="status === Status.DISCONNECTED" flat round icon="refresh" color="primary"
                    @click="$emit('retry')">
                </q-btn>
            </div>
            <div class="tools-status col-2 flex items-center">
                <div v-if="toolsStore.isToolsEnabled" class="flex items-center">
                    <q-icon name="build" color="secondary" size="xs" class="q-mr-xs" />
                    <span class="text-caption text-secondary">
                        {{ toolsStore.enabledToolsCount }}/4 tools
                        <q-tooltip class="text-body2">
                            <div>Active Tools:</div>
                            <div v-if="toolsStore.config.web_search">🌐 Web Search</div>
                            <div v-if="toolsStore.config.calculations">🔢 Calculator</div>
                            <div v-if="toolsStore.config.memory_search">🧠 Memory Search</div>
                            <div v-if="toolsStore.config.time_info">⏰ Time & Date</div>
                            <div v-if="toolsStore.isAutoDetectEnabled" class="q-mt-xs text-green">✨ Smart Detection ON</div>
                        </q-tooltip>
                    </span>
                </div>
                <div v-else class="flex items-center">
                    <q-icon name="build_circle" color="grey-6" size="xs" class="q-mr-xs" />
                    <span class="text-caption text-grey-6">Tools disabled</span>
                </div>
            </div>
            <div class="col-2">
                <ChatAttachment v-model="attachment" :disable="!canSend" />
            </div>
            <div class="config col-1 flex justify-end">
                <q-btn flat round icon="settings" @click="$emit('open-config')" />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useConfigStore } from 'src/stores/config.store';
import { useToolsStore } from 'src/stores/tools.store';
import { storeToRefs } from 'pinia';
import { useQuasar } from 'quasar';
import ChatAttachment from './ChatAttachment.vue';
import { Status } from 'src/services/socketio.service';

const props = defineProps<{
    loading: boolean;
    generating: boolean;
    disableInput: boolean;
    status: Status | undefined;
    statusMessage: string;
    statusIcon: string;
    statusColor: string;
}>();

const emit = defineEmits<{
    (e: 'send', message: string, attachment: File | null): void;
    (e: 'stop'): void;
    (e: 'retry'): void;
    (e: 'open-config'): void;
    (e: 'open-tools-config'): void;
}>();

const configStore = useConfigStore();
const toolsStore = useToolsStore();
const $q = useQuasar();

const { stream, toggleThinking, currentModel, modelList } = storeToRefs(configStore);

const newMessage = ref('');
const attachment = ref<File | null>(null);

const canSend = computed(() => {
    return !!newMessage.value.trim() && !props.disableInput;
});

const onSend = () => {
    if (canSend.value) {
        emit('send', newMessage.value, attachment.value);
        newMessage.value = '';
        attachment.value = null;
    }
};

const onEnter = (e: KeyboardEvent) => {
    if (e.shiftKey) return;
    e.preventDefault();
    onSend();
};

const stopGeneration = () => {
    emit('stop');
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

const openToolsConfig = () => {
    emit('open-tools-config');
};

const quickToggleTools = async () => {
    const newState = !toolsStore.isToolsEnabled;
    const success = await toolsStore.updateConfig({ enabled: newState });
    if (success) {
        $q.notify({
            message: `Tools ${newState ? 'enabled' : 'disabled'}`,
            color: newState ? 'green' : 'orange',
            position: 'bottom',
            timeout: 2000,
            icon: newState ? 'build' : 'build_circle'
        });
    }
};
</script>

<style lang="scss" scoped>
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

.tools-status {
    .text-caption {
        font-size: 0.75rem;
        font-weight: 500;
    }
}
</style>
