<template>
  <section class="screen-panel">
    <header>
      <div>
        <span class="eyebrow">SHARED SCREEN</span>
        <h2>{{ stream ? 'Previewing the selected screen' : 'Choose a screen to preview' }}</h2>
      </div>
      <q-btn
        no-caps
        unelevated
        :color="stream ? 'negative' : 'primary'"
        :icon="stream ? 'stop_screen_share' : 'screen_share'"
        :label="stream ? 'Stop sharing' : 'Share screen'"
        @click="stream ? stopSharing() : startSharing()"
      />
    </header>

    <div class="screen-stage" :class="{ active: stream }">
      <video v-show="stream" ref="video" autoplay muted playsinline />
      <div v-if="!stream" class="screen-placeholder">
        <div class="screen-glyph"><q-icon name="desktop_windows" size="42px" /></div>
        <strong>No screen is being observed</strong>
        <span>{{ unavailableReason || 'Sampled frames are analyzed in memory and are never persisted.' }}</span>
      </div>
      <div v-else class="privacy-label"><span></span> LIVE · AI VISION</div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { useQuasar } from 'quasar';
import type { ScreenFrame } from 'src/types/conversation';

const emit = defineEmits<{
  stateChanged: [state: { shared: boolean; application?: string }];
  frame: [frame: ScreenFrame];
}>();

const $q = useQuasar();
const video = ref<HTMLVideoElement>();
const stream = ref<MediaStream>();
let captureTimer: ReturnType<typeof setInterval> | undefined;
let lastSignature: Uint8ClampedArray | undefined;
let application = 'shared screen';
const unavailableReason = computed(() => {
  if (!window.isSecureContext) return 'Screen sharing requires HTTPS or a localhost URL.';
  if (!navigator.mediaDevices) return 'This embedded browser does not expose media capture. Open OkuuAI in a current desktop browser.';
  if (!navigator.mediaDevices.getDisplayMedia) return 'This browser or webview does not implement screen capture.';
  return '';
});

const stopSharing = (notifyRuntime = true) => {
  const current = stream.value;
  stream.value = undefined;
  if (captureTimer) clearInterval(captureTimer);
  captureTimer = undefined;
  lastSignature = undefined;
  current?.getTracks().forEach(track => track.stop());
  if (video.value) video.value.srcObject = null;
  if (notifyRuntime && current) emit('stateChanged', { shared: false });
};

const startSharing = async () => {
  if (unavailableReason.value) {
    $q.notify({ type: 'negative', message: unavailableReason.value });
    return;
  }
  try {
    const selected = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 12 }, audio: false });
    stream.value = selected;
    if (video.value) video.value.srcObject = selected;
    const track = selected.getVideoTracks()[0];
    track?.addEventListener('ended', () => stopSharing(), { once: true });
    const displaySurface = track?.getSettings().displaySurface;
    application = displaySurface || 'shared screen';
    emit('stateChanged', { shared: true, application });
    captureTimer = setInterval(captureFrame, 3000);
    setTimeout(captureFrame, 800);
  } catch (error) {
    const messages: Record<string, string> = {
      NotAllowedError: 'Screen sharing permission was denied.',
      NotReadableError: 'The operating system could not provide the selected screen.',
      InvalidStateError: 'Screen sharing must be started from the active browser tab.',
      AbortError: 'Screen sharing was cancelled before it could start.',
    };
    const message = error instanceof DOMException ? messages[error.name] : undefined;
    $q.notify({ type: 'negative', message: message || 'Unable to start screen sharing.' });
  }
};

const captureFrame = () => {
  const source = video.value;
  if (!source || !stream.value || source.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !source.videoWidth) return;

  const signatureCanvas = document.createElement('canvas');
  signatureCanvas.width = 32;
  signatureCanvas.height = 18;
  const signatureContext = signatureCanvas.getContext('2d', { willReadFrequently: true });
  if (!signatureContext) return;
  signatureContext.drawImage(source, 0, 0, 32, 18);
  const signature = signatureContext.getImageData(0, 0, 32, 18).data;
  if (lastSignature) {
    let difference = 0;
    for (let index = 0; index < signature.length; index += 4) {
      difference += Math.abs((signature[index] ?? 0) - (lastSignature[index] ?? 0));
      difference += Math.abs((signature[index + 1] ?? 0) - (lastSignature[index + 1] ?? 0));
      difference += Math.abs((signature[index + 2] ?? 0) - (lastSignature[index + 2] ?? 0));
    }
    if (difference / (signature.length * 0.75 * 255) < 0.015) return;
  }
  lastSignature = new Uint8ClampedArray(signature);

  const scale = Math.min(1, 1024 / source.videoWidth, 640 / source.videoHeight);
  const width = Math.max(1, Math.round(source.videoWidth * scale));
  const height = Math.max(1, Math.round(source.videoHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return;
  context.drawImage(source, 0, 0, width, height);
  const base64 = canvas.toDataURL('image/jpeg', 0.68).split(',')[1];
  if (base64) emit('frame', { capturedAt: Date.now(), mimeType: 'image/jpeg', base64, width, height, application });
};

onBeforeUnmount(() => stopSharing());
</script>

<style lang="scss" scoped>
.screen-panel { grid-area: screen; display: flex; min-height: 0; flex-direction: column; padding: 1rem 1.15rem 1.15rem; border-bottom: 1px solid var(--surface-border); background: linear-gradient(145deg, var(--surface-1), var(--surface-0)); }
header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: .8rem; }
.eyebrow { color: var(--accent-1); font-size: .61rem; font-weight: 850; letter-spacing: .15em; }
h2 { margin: .15rem 0 0; font-size: clamp(.95rem, 2vw, 1.18rem); letter-spacing: -.025em; }
.screen-stage { position: relative; display: grid; min-height: 190px; flex: 1; place-items: center; overflow: hidden; border: 1px solid var(--surface-border); border-radius: 17px; background: #0c0a0b; }
.screen-stage.active { box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent-1) 22%, transparent); }
video { width: 100%; height: 100%; object-fit: contain; background: #080708; }
.screen-placeholder { display: grid; max-width: 410px; justify-items: center; padding: 1.5rem; color: var(--text-muted); text-align: center; }
.screen-placeholder strong { margin-top: .8rem; color: var(--text-strong); font-size: .92rem; }
.screen-placeholder span { margin-top: .35rem; font-size: .72rem; line-height: 1.5; }
.screen-glyph { display: grid; width: 76px; height: 58px; place-items: center; border: 1px solid var(--surface-border); border-radius: 14px; color: var(--accent-1); background: var(--surface-1); }
.privacy-label { position: absolute; top: .65rem; right: .65rem; display: flex; align-items: center; gap: .4rem; padding: .35rem .55rem; border: 1px solid rgba(255,255,255,.14); border-radius: 999px; color: #fff; background: rgba(12,10,11,.78); backdrop-filter: blur(8px); font-size: .58rem; font-weight: 800; letter-spacing: .08em; }
.privacy-label span { width: 6px; height: 6px; border-radius: 50%; background: #ef6c62; box-shadow: 0 0 0 4px rgba(239,108,98,.16); }
@media (max-width: 760px) { .screen-panel { padding: .8rem; } .screen-stage { min-height: 210px; } header :deep(.q-btn__content) { font-size: 0; } }
</style>
