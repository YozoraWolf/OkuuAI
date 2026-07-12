<template>
    <div class="chat-input text-white q-pa-md">
        <div class="composer-field" :class="{ 'has-attachment': attachment }">
            <q-input type="textarea" autogrow borderless hide-bottom-space :disable="disableInput"
                v-model="newMessage" placeholder="Type a message" @keyup.enter="onEnter" @keyup.shift.enter.stop
                :readonly="loading || generating"
                class="composer-text">
                <template v-slot:append>
                    <ChatAttachment v-if="modelSupportsAttachments" v-model="attachment" :disable="disableInput || loading || generating" />
                    <q-btn v-if="generating" flat round icon="stop" color="negative"
                        @click="stopGeneration" />
                    <q-btn v-else
                        :disable="!canSend || loading"
                        :loading="loading && !generating"
                        unelevated round icon="send"
                        :color="canSend && !loading ? 'primary' : 'grey-8'"
                        @click="onSend" />
                </template>
            </q-input>
            <div v-if="attachment" class="attachment-preview" :title="attachment.name">
                <div class="attachment-visual">
                    <img v-if="attachmentPreviewUrl" :src="attachmentPreviewUrl" alt="Selected image preview" />
                    <q-icon v-else name="description" size="36px" />
                    <span v-if="!attachmentPreviewUrl" class="attachment-kind">{{ attachmentExtension }}</span>
                </div>
                <div class="attachment-copy">
                    <strong>{{ attachment.name }}</strong>
                    <span>{{ attachmentSize }}</span>
                </div>
            </div>
        </div>
        <div class="composer-footer">
            <div class="composer-controls">
                <q-chip v-if="modelSupportsThinking" class="q-mx-sm" size="md" color="primary" :outline="!configStore.toggleThinking"
                    clickable @click="toggleThinkingFunc">
                    <q-icon name="mdi-brain" size="sm" class="q-mr-sm"></q-icon>
                    <div class="text-weight-bold">Think</div>
                </q-chip>
                <q-chip v-else class="q-mx-sm" size="md" outline color="grey-6">
                    <q-icon name="psychology_alt" size="sm" class="q-mr-sm" /><div>Thinking unavailable</div>
                    <q-tooltip>This model does not advertise thinking or reasoning support.</q-tooltip>
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
            <div class="composer-actions">
                <q-btn flat round icon="settings" @click="$emit('open-config')" />
            </div>
            <span class="send-hint">Enter to send · Shift+Enter for a line break</span>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue';
import { useConfigStore } from 'src/stores/config.store';
import { useToolsStore } from 'src/stores/tools.store';
import { storeToRefs } from 'pinia';
import { useQuasar } from 'quasar';
import ChatAttachment from './ChatAttachment.vue';

const props = defineProps<{
    loading: boolean;
    generating: boolean;
    disableInput: boolean;
}>();

const emit = defineEmits<{
    (e: 'send', message: string, attachment: File | null): void;
    (e: 'stop'): void;
    (e: 'open-config'): void;
    (e: 'open-tools-config'): void;
}>();

const configStore = useConfigStore();
const toolsStore = useToolsStore();
const $q = useQuasar();

const { stream, toggleThinking, currentModel, modelList } = storeToRefs(configStore);

const newMessage = ref('');
const attachment = ref<File | null>(null);
const attachmentPreviewUrl = ref('');
const attachmentExtension = computed(() => attachment.value?.name.split('.').pop()?.toUpperCase() || 'FILE');
const attachmentSize = computed(() => {
    if (!attachment.value) return '';
    const bytes = attachment.value.size;
    return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
});

const canSend = computed(() => {
    return (!!newMessage.value.trim() || !!attachment.value) && !props.disableInput;
});
const modelSupportsThinking = computed(() => configStore.modelSupportsThinking);
const modelSupportsAttachments = computed(() => {
    const selectedModel = modelList.value.find((model: any) => model.name === currentModel.value);
    return selectedModel?.multimodal === true || /(?:vision|(?:^|[-_])vl(?:[-_]|$)|llava|bakllava|minicpm-v|qwen(?:[-_]?3(?:[._-][5-9])?))/i.test(currentModel.value);
});

watch(modelSupportsThinking, supported => {
    if (!supported && toggleThinking.value) {
        void configStore.updateToggleThinking(false);
    }
}, { immediate: true });

watch(modelSupportsAttachments, supports => {
    if (!supports) attachment.value = null;
});

watch(attachment, file => {
    if (attachmentPreviewUrl.value) URL.revokeObjectURL(attachmentPreviewUrl.value);
    attachmentPreviewUrl.value = file?.type.startsWith('image/') ? URL.createObjectURL(file) : '';
});

onBeforeUnmount(() => {
    if (attachmentPreviewUrl.value) URL.revokeObjectURL(attachmentPreviewUrl.value);
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
    padding: 0.9rem clamp(0.85rem, 3vw, 2rem) !important;
    background: color-mix(in srgb, var(--surface-1) 92%, transparent);
    border-top: 1px solid var(--surface-border);
    backdrop-filter: blur(18px);
}

.composer-field { overflow: hidden; margin-bottom: 1.05rem; border: 1px solid var(--surface-border); border-radius: 16px; background: linear-gradient(135deg, color-mix(in srgb, var(--surface-2) 92%, var(--accent-1)), var(--surface-2)); transition: border-color 150ms var(--ease-snappy), background 150ms var(--ease-snappy), box-shadow 150ms var(--ease-snappy); }
.composer-field:hover, .composer-field:focus-within { border-color: color-mix(in srgb, var(--accent-1) 55%, var(--surface-border)); background: linear-gradient(135deg, color-mix(in srgb, var(--surface-raised) 90%, var(--accent-1)), var(--surface-raised)); box-shadow: 0 8px 28px color-mix(in srgb, var(--accent-1) 9%, transparent); }
.composer-field :deep(.q-field__control) { min-height: 62px; padding: 0.2rem 0.3rem; }
.composer-field :deep(textarea) { min-height: 38px !important; padding: 0.55rem 0.45rem; line-height: 1.45; }
.composer-field :deep(.q-field__append) { align-self: flex-end; padding: 0 0.1rem 0.2rem 0.25rem; }
.attachment-preview { display: flex; width: fit-content; max-width: min(320px, calc(100% - 1.5rem)); align-items: center; gap: 0.7rem; margin: 0 0.75rem 0.75rem; padding: 0.45rem 0.7rem 0.45rem 0.45rem; border: 1px solid color-mix(in srgb, var(--accent-1) 24%, var(--surface-border)); border-radius: 12px; color: var(--text-muted); background: linear-gradient(120deg, color-mix(in srgb, var(--accent-1) 10%, var(--surface-1)), var(--surface-1)); box-shadow: 0 5px 16px rgba(0,0,0,0.14); }
.attachment-visual { position: relative; display: grid; width: 76px; height: 76px; flex: none; place-items: center; overflow: hidden; border-radius: 9px; color: var(--accent-1); background: color-mix(in srgb, var(--accent-1) 10%, var(--surface-2)); }
.attachment-visual img { width: 100%; height: 100%; object-fit: cover; }
.attachment-kind { position: absolute; right: 4px; bottom: 4px; max-width: 62px; padding: 0.12rem 0.28rem; overflow: hidden; border-radius: 4px; color: var(--accent-text); background: var(--accent-1); font-size: 0.55rem; font-weight: 850; letter-spacing: 0.04em; text-overflow: ellipsis; }
.attachment-copy { display: grid; min-width: 0; gap: 0.18rem; }
.attachment-copy strong { overflow: hidden; color: var(--text-strong); font-size: 0.78rem; text-overflow: ellipsis; white-space: nowrap; }
.attachment-copy span { color: var(--text-muted); font-size: 0.67rem; }
.composer-footer { display: flex; align-items: center; gap: 0.5rem; min-width: 0; }
.composer-controls { display: flex; align-items: center; min-width: 0; overflow-x: auto; }
.composer-actions { display: flex; align-items: center; order: 3; margin-left: 0.35rem; }
.send-hint { order: 2; margin-left: auto; color: var(--text-muted); font-size: 0.68rem; white-space: nowrap; }

@media (max-width: 700px) {
    .send-hint { display: none; }
    .composer-controls { flex: 1; }
}
</style>
