<template>
    <div class="q-mx-lg">
        <h1 class="q-ma-none q-py-md">Settings</h1>
        <div v-if="currentOkuuPfp" class="q-my-lg">
            <div class="avatar-cont row flex-center" style="width: 250px;" >
                <q-avatar size="200px" round>
                    <q-img :src="currentOkuuPfp" />
                </q-avatar>

                <q-btn label="Set Okuu Pfp" icon="image" size="lg" class="q-mt-md q-mx-md" color="primary"
                    @click="toggleOkuuPfpSelector" />
            </div>
            <Zoom/>
            <GlobalToggles />
            <MicSelect />
        </div>
        <ImageSelectorModal :showModal="showOkuuPfpModal" @close="toggleOkuuPfpSelector" @save="fetchCurrentOkuuPfp" />
    </div>
</template>

<script setup lang="ts">
import ImageSelectorModal from 'src/components/settings/ImageSelectorModal.vue';
import Zoom from 'src/components/settings/Zoom.vue';
import { ref, onMounted } from 'vue';
import { useConfigStore } from 'src/stores/config.store';
import { useQuasar } from 'quasar';
import GlobalToggles from 'src/components/settings/GlobalToggles.vue';
import MicSelect from 'src/components/settings/MicSelect.vue';

const showOkuuPfpModal = ref(false);
const configStore = useConfigStore();
const currentOkuuPfp = ref<string | null>(null);

const $q = useQuasar();

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

<style scoped>
p {
    font-size: 16px;
}

.current-pfp {
    max-width: 200px;
    max-height: 200px;
    border-radius: 50%;
    display: block;
    margin: 0 auto;
}
</style>