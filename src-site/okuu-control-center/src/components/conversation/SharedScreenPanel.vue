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
        <span>{{ unavailableReason || 'The preview stays in your browser. Raw frames are not stored or uploaded.' }}</span>
      </div>
      <div v-else class="privacy-label"><span></span> LIVE · LOCAL PREVIEW</div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { useQuasar } from 'quasar';

const emit = defineEmits<{
  stateChanged: [state: { shared: boolean; application?: string }];
}>();

const $q = useQuasar();
const video = ref<HTMLVideoElement>();
const stream = ref<MediaStream>();
const unavailableReason = computed(() => {
  if (!window.isSecureContext) return 'Screen sharing requires HTTPS or a localhost URL.';
  if (!navigator.mediaDevices) return 'This embedded browser does not expose media capture. Open OkuuAI in a current desktop browser.';
  if (!navigator.mediaDevices.getDisplayMedia) return 'This browser or webview does not implement screen capture.';
  return '';
});

const stopSharing = (notifyRuntime = true) => {
  const current = stream.value;
  stream.value = undefined;
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
    emit('stateChanged', { shared: true, application: displaySurface || 'shared screen' });
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
