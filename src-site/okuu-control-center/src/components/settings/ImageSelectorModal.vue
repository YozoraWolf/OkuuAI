<template>
    <q-dialog v-model="localShowModal" @click-outside="closeModal" persistent>
        <q-card style="max-width: 600px; max-height: 800px;">
            <q-card-section>
                <div class="text-h6">Select and Crop Image</div>
            </q-card-section>

            <q-card-section class="image-container flex row">
                <q-file outlined v-model="file" @update:model-value="onFileChange" class="full-width">
                    <template v-slot:prepend>
                        <q-icon name="attach_file" />
                    </template>
                </q-file>
                <div v-if="imageUrl" class="cropper-wrapper q-my-md">
                    <img :src="imageUrl" ref="image" class="cropper-image" />
                </div>
            </q-card-section>

            <q-card-actions align="right">
                <q-btn flat label="Cancel" color="primary" @click="closeModal" />
                <q-btn flat label="Save" color="primary" @click="saveImage" />
            </q-card-actions>
        </q-card>
    </q-dialog>
</template>

<script setup lang="ts">
import { ref, watch, defineEmits, defineProps, nextTick } from 'vue';
import Cropper from 'cropperjs';
import 'cropperjs/dist/cropper.css';
import { uploadOkuuPfp } from 'src/services/config.service';

const props = defineProps({
    showModal: Boolean,
});

const emit = defineEmits(['close', 'save']);

const localShowModal = ref(props.showModal);
watch(() => props.showModal, (newVal) => {
    localShowModal.value = newVal;
});

const file = ref<File | null>(null);
const imageUrl = ref<string | null>(null);
const cropper = ref<Cropper | null>(null);

const onFileChange = () => {
    if (file.value) {
        const reader = new FileReader();
        reader.onload = (e) => {
            imageUrl.value = e.target?.result as string;
        };
        reader.readAsDataURL(file.value);
    }
};

watch(imageUrl, async (newUrl) => {
    if (newUrl && cropper.value) {
        cropper.value.destroy();
        cropper.value = null;
    }
    if (newUrl) {
        await nextTick();
        const imageElement = document.querySelector('.cropper-image') as HTMLImageElement;
        cropper.value = new Cropper(imageElement, {
            aspectRatio: 1,
            viewMode: 1,
            autoCropArea: 0.8,
            scalable: false,
            zoomable: false,
            responsive: true,
            background: false,
        });
    }
});

const saveImage = async () => {
    if (cropper.value) {
        const canvas = cropper.value.getCroppedCanvas({
            width: 600,
            height: 800,
        });
        canvas.toBlob(async (blob) => {
            if (blob) {
                try {
                    await uploadOkuuPfp(new File([blob], 'cropped-image.png', { type: blob.type }));
                } catch (error) {
                    console.error('Failed to save image:', error);
                }
            }
        });
    }
    closeModal();
};

const closeModal = () => {
    imageUrl.value = null;
    file.value = null;
    if (cropper.value) {
        cropper.value.destroy();
        cropper.value = null;
    }
    emit('close');
};
</script>

<style scoped>
.cropper-wrapper {
    width: 100%;
    height: 40%;
    max-height: 600px;
}
</style>
