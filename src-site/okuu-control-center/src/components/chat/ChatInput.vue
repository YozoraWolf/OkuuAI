<template>
    <div class="chat-input text-white q-pa-md">
        <div class="composer-field" :class="{ 'has-attachment': attachment }">
            <q-input v-if="!isRecording && !isTranscribing" type="textarea" autogrow borderless hide-bottom-space :disable="disableInput"
                v-model="newMessage" placeholder="Type a message" @keyup.enter="onEnter" @keyup.shift.enter.stop
                :readonly="loading || generating"
                class="composer-text">
                <template v-slot:append>
                    <ChatAttachment v-if="modelSupportsAttachments" v-model="attachment" :disable="disableInput || loading || generating" />
                    <q-btn v-if="generating" flat round icon="stop" color="negative"
                        @click="stopGeneration" />
                    <q-btn v-else-if="canSend"
                        :disable="!canSend || loading"
                        :loading="loading && !generating"
                        unelevated round icon="send"
                        :color="canSend && !loading ? 'primary' : 'grey-8'"
                        @click="onSend" />
                    <q-btn v-else-if="voiceMode" flat round icon="mic" color="primary" class="voice-trigger"
                        :disable="disableInput || loading" aria-label="Hold to record voice note"
                        @pointerdown.prevent="beginVoiceHold" @contextmenu.prevent>
                        <q-tooltip>Hold to record · slide left to cancel</q-tooltip>
                    </q-btn>
                    <q-btn v-else flat round icon="send" color="grey-6"
                        :disable="disableInput || loading" aria-label="Switch to voice recording"
                        @click="voiceMode = true">
                        <q-tooltip>Switch to voice note</q-tooltip>
                    </q-btn>
                </template>
            </q-input>
            <div v-else class="voice-recorder" :class="{ transcribing: isTranscribing }">
                <template v-if="isRecording">
                    <span class="recording-dot"></span>
                    <strong>{{ formattedRecordingTime }}</strong>
                    <div class="voice-bars" aria-hidden="true"><i v-for="bar in 18" :key="bar" :style="{ animationDelay: `${bar * -55}ms` }"></i></div>
                    <div class="cancel-hint" :class="{ armed: cancelArmed }" :style="{ transform: `translateX(${slideOffset}px)` }">
                        <q-icon name="chevron_left" size="18px" />
                        <span>{{ cancelArmed ? 'Release to cancel' : 'Slide left to cancel' }}</span>
                    </div>
                    <div class="recording-mic" :class="{ armed: cancelArmed }"><q-icon :name="cancelArmed ? 'delete_outline' : 'mic'" size="22px" /></div>
                </template>
                <template v-else>
                    <q-spinner-dots color="primary" size="28px" />
                    <span>Transcribing voice note…</span>
                </template>
            </div>
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
import { transcribeVoiceNote } from 'src/services/audio.service';

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
const isRecording = ref(false);
const isTranscribing = ref(false);
const voiceMode = ref(false);
const recordingSeconds = ref(0);
const cancelArmed = ref(false);
const slideOffset = ref(0);
let mediaRecorder: MediaRecorder | null = null;
let recordingStream: MediaStream | null = null;
let recordingTimer: ReturnType<typeof setInterval> | undefined;
let recordingLimitTimer: ReturnType<typeof setTimeout> | undefined;
let holdStartTimer: ReturnType<typeof setTimeout> | undefined;
let audioChunks: Blob[] = [];
let transcribeAfterStop = false;
let activePointerId: number | null = null;
let holdStartX = 0;
let holdReleased = false;
const attachmentExtension = computed(() => attachment.value?.name.split('.').pop()?.toUpperCase() || 'FILE');
const attachmentSize = computed(() => {
    if (!attachment.value) return '';
    const bytes = attachment.value.size;
    return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
});
const formattedRecordingTime = computed(() => `${Math.floor(recordingSeconds.value / 60)}:${String(recordingSeconds.value % 60).padStart(2, '0')}`);

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
    transcribeAfterStop = false;
    if (mediaRecorder?.state === 'recording') mediaRecorder.stop();
    removeHoldListeners();
    stopRecordingStream();
});

const stopRecordingStream = () => {
    recordingStream?.getTracks().forEach(track => track.stop());
    recordingStream = null;
    if (recordingTimer) clearInterval(recordingTimer);
    if (recordingLimitTimer) clearTimeout(recordingLimitTimer);
    recordingTimer = undefined;
    recordingLimitTimer = undefined;
};

const getRecorderMimeType = () => [
    'audio/webm;codecs=opus',
    'audio/mp4',
    'audio/webm',
    'audio/ogg;codecs=opus',
].find(type => MediaRecorder.isTypeSupported(type));

const addHoldListeners = () => {
    window.addEventListener('pointermove', handleVoiceHoldMove, { passive: false });
    window.addEventListener('pointerup', handleVoiceHoldEnd);
    window.addEventListener('pointercancel', handleVoiceHoldCancel);
};

const removeHoldListeners = () => {
    if (holdStartTimer) clearTimeout(holdStartTimer);
    holdStartTimer = undefined;
    window.removeEventListener('pointermove', handleVoiceHoldMove);
    window.removeEventListener('pointerup', handleVoiceHoldEnd);
    window.removeEventListener('pointercancel', handleVoiceHoldCancel);
    activePointerId = null;
};

const beginVoiceHold = (event: PointerEvent) => {
    if (props.disableInput || props.loading || props.generating || isRecording.value || isTranscribing.value) return;
    activePointerId = event.pointerId;
    holdStartX = event.clientX;
    holdReleased = false;
    cancelArmed.value = false;
    slideOffset.value = 0;
    addHoldListeners();
    holdStartTimer = setTimeout(() => {
        holdStartTimer = undefined;
        void startRecording();
    }, 280);
};

const handleVoiceHoldMove = (event: PointerEvent) => {
    if (event.pointerId !== activePointerId) return;
    event.preventDefault();
    const distance = Math.min(0, event.clientX - holdStartX);
    slideOffset.value = Math.max(-96, distance * .45);
    cancelArmed.value = distance <= -80;
};

const handleVoiceHoldEnd = (event: PointerEvent) => {
    if (event.pointerId !== activePointerId) return;
    holdReleased = true;
    const slidToCancel = cancelArmed.value;
    const recordingStarted = mediaRecorder?.state === 'recording';
    removeHoldListeners();
    if (recordingStarted) {
        if (slidToCancel) cancelRecording(); else finishRecording();
    } else {
        voiceMode.value = false;
    }
};

const handleVoiceHoldCancel = (event: PointerEvent) => {
    if (event.pointerId !== activePointerId) return;
    holdReleased = true;
    removeHoldListeners();
    if (mediaRecorder?.state === 'recording') cancelRecording();
};

const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        removeHoldListeners();
        $q.notify({
            type: 'negative',
            message: !window.isSecureContext
                ? 'Firefox requires HTTPS or localhost for microphone access.'
                : 'Microphone recording is disabled or unavailable in this browser.',
        });
        return;
    }
    try {
        recordingStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        if (holdReleased) {
            stopRecordingStream();
            return;
        }
        const mimeType = getRecorderMimeType();
        mediaRecorder = new MediaRecorder(recordingStream, mimeType ? { mimeType } : undefined);
        audioChunks = [];
        transcribeAfterStop = false;
        recordingSeconds.value = 0;
        mediaRecorder.ondataavailable = event => { if (event.data.size) audioChunks.push(event.data); };
        mediaRecorder.onstop = handleRecordingStopped;
        mediaRecorder.start(250);
        isRecording.value = true;
        recordingTimer = setInterval(() => { recordingSeconds.value += 1; }, 1000);
        recordingLimitTimer = setTimeout(() => {
            holdReleased = true;
            removeHoldListeners();
            finishRecording();
        }, 120000);
    } catch (error) {
        removeHoldListeners();
        stopRecordingStream();
        const permissionDenied = error instanceof DOMException && ['NotAllowedError', 'SecurityError'].includes(error.name);
        $q.notify({ type: 'negative', message: permissionDenied ? 'Microphone permission was denied. Check Firefox site permissions.' : 'Unable to start voice recording.' });
    }
};

const handleRecordingStopped = async () => {
    const shouldTranscribe = transcribeAfterStop;
    const mimeType = mediaRecorder?.mimeType || audioChunks[0]?.type || 'audio/webm';
    const audio = new Blob(audioChunks, { type: mimeType });
    isRecording.value = false;
    voiceMode.value = false;
    cancelArmed.value = false;
    slideOffset.value = 0;
    stopRecordingStream();
    if (!shouldTranscribe || !audio.size) return;

    isTranscribing.value = true;
    try {
        const extension = mimeType.includes('mp4') ? 'm4a' : mimeType.includes('ogg') ? 'ogg' : 'webm';
        const transcript = await transcribeVoiceNote(audio, `voice-note.${extension}`);
        if (!transcript) throw new Error('Empty transcription');
        emit('send', transcript, null);
    } catch {
        $q.notify({ type: 'negative', message: 'The voice note could not be transcribed.' });
    } finally {
        isTranscribing.value = false;
        audioChunks = [];
        mediaRecorder = null;
    }
};

const finishRecording = () => {
    if (!mediaRecorder || mediaRecorder.state !== 'recording') return;
    transcribeAfterStop = true;
    mediaRecorder.stop();
};

const cancelRecording = () => {
    if (!mediaRecorder || mediaRecorder.state !== 'recording') return;
    transcribeAfterStop = false;
    mediaRecorder.stop();
};

const onSend = () => {
    if (canSend.value) {
        emit('send', newMessage.value, attachment.value);
        newMessage.value = '';
        attachment.value = null;
        voiceMode.value = false;
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
.voice-trigger { touch-action: none; user-select: none; -webkit-user-select: none; }
.voice-recorder { display: flex; min-height: 62px; align-items: center; gap: 0.65rem; padding: 0.35rem 0.55rem; pointer-events: none; user-select: none; }
.recording-dot { width: 9px; height: 9px; flex: none; border-radius: 50%; background: #ef6262; box-shadow: 0 0 0 5px rgba(239,98,98,.12); animation: recording-pulse 1.2s ease-in-out infinite; }
.voice-recorder strong { width: 38px; flex: none; font-variant-numeric: tabular-nums; font-size: .76rem; }
.voice-bars { display: flex; height: 32px; min-width: 0; flex: 1; align-items: center; justify-content: center; gap: 3px; overflow: hidden; }
.voice-bars i { display: block; width: 3px; height: 8px; border-radius: 3px; background: color-mix(in srgb, var(--accent-1) 78%, var(--text-muted)); animation: voice-bar 900ms ease-in-out infinite alternate; }
.cancel-hint { display: flex; flex: none; align-items: center; color: var(--text-muted); font-size: .68rem; white-space: nowrap; transition: color 120ms ease; }
.cancel-hint.armed { color: #ef7878; }
.recording-mic { display: grid; width: 42px; height: 42px; flex: none; place-items: center; border-radius: 50%; color: var(--accent-text); background: var(--accent-1); box-shadow: 0 0 0 5px color-mix(in srgb, var(--accent-1) 12%, transparent); }
.recording-mic.armed { color: white; background: #d95858; box-shadow: 0 0 0 7px rgba(217,88,88,.15); }
.voice-recorder.transcribing { justify-content: center; color: var(--text-muted); font-size: .78rem; }
.composer-footer { display: flex; align-items: center; gap: 0.5rem; min-width: 0; }
.composer-controls { display: flex; align-items: center; min-width: 0; overflow-x: auto; }
.composer-actions { display: flex; align-items: center; order: 3; margin-left: 0.35rem; }
.send-hint { order: 2; margin-left: auto; color: var(--text-muted); font-size: 0.68rem; white-space: nowrap; }

@media (max-width: 700px) {
    .send-hint { display: none; }
    .composer-controls { flex: 1; }
    .voice-recorder { gap: .4rem; }
    .voice-bars { gap: 2px; }
    .voice-bars i:nth-child(even) { display: none; }
    .cancel-hint span { max-width: 92px; overflow: hidden; text-overflow: ellipsis; }
}

@keyframes recording-pulse { 50% { opacity: .55; transform: scale(.82); } }
@keyframes voice-bar { from { height: 6px; opacity: .45; } to { height: 26px; opacity: 1; } }
</style>
