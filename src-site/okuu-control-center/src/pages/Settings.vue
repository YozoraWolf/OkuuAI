<template>
    <q-page class="settings-page">
        <header class="settings-header">
            <span class="settings-kicker">CONTROL CENTER</span>
            <h1>Make Okuu feel like yours.</h1>
            <p>Personalize appearance and response behavior without interrupting your conversations.</p>
        </header>

        <div class="settings-grid">
            <section class="settings-card profile-card">
                <div class="card-heading">
                    <div><span class="card-kicker">IDENTITY</span><h2>Okuu profile</h2></div>
                    <q-icon name="face_6" size="24px" />
                </div>
                <div class="profile-content">
                    <q-avatar size="112px" class="profile-avatar">
                        <q-img v-if="currentOkuuPfp" :src="currentOkuuPfp" />
                        <q-icon v-else name="face_6" size="56px" />
                    </q-avatar>
                    <div class="profile-copy">
                        <strong>Assistant avatar</strong>
                        <p>This image appears beside Okuu's messages in every conversation.</p>
                        <q-btn v-if="authStore.isAdmin" unelevated no-caps icon="image" label="Choose image" @click="toggleOkuuPfpSelector" />
                    </div>
                </div>
            </section>

            <section class="settings-card">
                <div class="card-heading"><div><span class="card-kicker">APPEARANCE</span><h2>Reading comfort</h2></div><q-icon name="zoom_in" size="24px" /></div>
                <Zoom />
            </section>

            <section class="settings-card behavior-card">
                <div class="card-heading"><div><span class="card-kicker">RESPONSE STYLE</span><h2>Thinking controls</h2></div><q-icon name="psychology" size="24px" /></div>
                <GlobalToggles />
            </section>

            <section class="settings-card tint-card">
                <div class="card-heading"><div><span class="card-kicker">COLOR</span><h2>App tint</h2></div><q-icon name="palette" size="24px" /></div>
                <p class="tint-description">Choose the accent color used for controls, selections, and highlights.</p>
                <div class="tint-options">
                    <button v-for="tint in tints" :key="tint.value" class="tint-option" :class="{ selected: configStore.appTint === tint.value }" @click="configStore.setAppTint(tint.value)">
                        <span :class="`tint-swatch ${tint.value}`"></span>{{ tint.label }}
                    </button>
                </div>
            </section>
        </div>
        <ImageSelectorModal v-if="authStore.isAdmin" :showModal="showOkuuPfpModal" @close="toggleOkuuPfpSelector" @save="fetchCurrentOkuuPfp" />
    </q-page>
</template>

<script setup lang="ts">
import ImageSelectorModal from 'src/components/settings/ImageSelectorModal.vue';
import Zoom from 'src/components/settings/Zoom.vue';
import { ref, onMounted } from 'vue';
import { useConfigStore } from 'src/stores/config.store';
import { useQuasar } from 'quasar';
import GlobalToggles from 'src/components/settings/GlobalToggles.vue';
import { useAuthStore } from 'src/stores/auth.store';

const showOkuuPfpModal = ref(false);
const configStore = useConfigStore();
const authStore = useAuthStore();
const currentOkuuPfp = ref<string | null>(null);

const $q = useQuasar();
const tints = [
    { value: 'utsuho', label: 'Utsuho' },
    { value: 'ocean', label: 'Ocean' },
    { value: 'forest', label: 'Forest' },
    { value: 'violet', label: 'Violet' },
    { value: 'rose', label: 'Rose' },
    { value: 'arctic', label: 'Arctic' },
];

const toggleOkuuPfpSelector = () => {
    showOkuuPfpModal.value = !showOkuuPfpModal.value;
};

const fetchCurrentOkuuPfp = async () => {
    $q.loading.show();
    await configStore.fetchOkuuPfp();
    currentOkuuPfp.value = configStore.okuuPfp;
    $q.loading.hide();
};

onMounted(() => {
    fetchCurrentOkuuPfp();
});
</script>

<style lang="scss" scoped>
.settings-page { min-height: 100%; padding: clamp(1.25rem, 4vw, 4rem); background: var(--surface-0); }
.settings-header { max-width: 640px; margin-bottom: clamp(1.75rem, 4vw, 3rem); animation: enter 260ms var(--ease-snappy) both; }
.settings-kicker, .card-kicker { color: var(--accent-1); font-size: 0.66rem; font-weight: 800; letter-spacing: 0.14em; }
.settings-header h1 { margin: 0.4rem 0 0.75rem; font-size: clamp(2rem, 5vw, 3.4rem); line-height: 1; letter-spacing: -0.055em; }
.settings-header p { max-width: 540px; margin: 0; color: var(--text-muted); font-size: 1rem; line-height: 1.6; }
.settings-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; max-width: 1050px; }
.settings-card { min-width: 0; padding: clamp(1.2rem, 3vw, 1.7rem); border: 1px solid var(--surface-border); border-radius: 20px; background: color-mix(in srgb, var(--surface-2) 74%, transparent); box-shadow: 0 18px 45px rgba(0,0,0,0.12); animation: enter 300ms var(--ease-snappy) both; }
.profile-card { grid-column: span 2; }
.card-heading { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 1.5rem; color: var(--accent-2); }
.card-heading h2 { margin: 0.28rem 0 0; color: var(--text-strong); font-size: 1.15rem; letter-spacing: -0.03em; }
.profile-content { display: flex; align-items: center; gap: 1.25rem; }
.profile-avatar { flex: none; color: var(--accent-1); background: linear-gradient(135deg, color-mix(in srgb, var(--accent-1) 23%, transparent), color-mix(in srgb, var(--accent-2) 25%, transparent)); box-shadow: 0 0 0 5px rgba(255,255,255,0.04); }
.profile-copy { max-width: 420px; }
.profile-copy strong { font-size: 0.95rem; }
.profile-copy p { margin: 0.35rem 0 0.9rem; color: var(--text-muted); font-size: 0.85rem; line-height: 1.55; }
.profile-copy :deep(.q-btn) { border-radius: 10px; color: var(--accent-text); background: var(--accent-1); font-weight: 750; }
.tint-description { margin: -0.5rem 0 1rem; color: var(--text-muted); font-size: 0.82rem; }
.tint-options { display: flex; flex-wrap: wrap; gap: 0.6rem; }
.tint-option { display: inline-flex; align-items: center; gap: 0.45rem; padding: 0.5rem 0.7rem; border: 1px solid var(--surface-border); border-radius: 9px; color: var(--text-strong); cursor: pointer; background: transparent; }
.tint-option.selected { border-color: var(--accent-1); background: color-mix(in srgb, var(--accent-1) 15%, transparent); }
.tint-swatch { width: 12px; height: 12px; border-radius: 50%; background: #f06a45; }.tint-swatch.ocean { background: #72c9d1; }.tint-swatch.forest { background: #83c99a; }.tint-swatch.violet { background: #b89be8; }.tint-swatch.rose { background: #ed8cac; }.tint-swatch.arctic { background: #8ccce8; }
@keyframes enter { from { opacity: 0; transform: translateY(9px); } to { opacity: 1; transform: translateY(0); } }
@media (max-width: 760px) { .settings-page { padding: 1.25rem; } .settings-grid { grid-template-columns: 1fr; } .profile-card { grid-column: auto; } .profile-content { align-items: flex-start; flex-direction: column; } }
</style>
