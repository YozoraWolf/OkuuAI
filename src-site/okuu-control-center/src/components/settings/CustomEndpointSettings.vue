<template>
    <div class="custom-endpoint-settings q-mt-lg">
        <h5 class="q-ma-none q-mb-md">Custom Endpoint Settings</h5>
        <p class="text-caption text-grey-7">
            Use your own OpenAI-compatible endpoint instead of Ollama. Embeddings will still use Ollama's nomic-embed-text.
        </p>
        
        <q-banner v-if="localUseCustomEndpoint" class="bg-info text-white q-mb-md">
            <template v-slot:avatar>
                <q-icon name="info" />
            </template>
            When using a custom endpoint, the model list will be fetched from your endpoint. 
            The current model "{{ getShortModelName(currentModel) }}" will be sent to your endpoint.
            <div v-if="modelList.length > 0" class="q-mt-sm">
                <strong>Available models:</strong> {{ modelList.slice(0, 5).map(m => getShortModelName(m.name)).join(', ') }}
                <span v-if="modelList.length > 5">... ({{ modelList.length }} total)</span>
            </div>
        </q-banner>
        
        <div class="q-gutter-md">
            <!-- Enable Custom Endpoint Toggle -->
            <q-toggle 
                v-model="localUseCustomEndpoint" 
                label="Use Custom Endpoint" 
                left-label
                @update:model-value="handleToggleChange"
            >
                <q-tooltip class="bg-primary text-body1">
                    Enable this to use a custom OpenAI-compatible endpoint
                </q-tooltip>
            </q-toggle>

            <!-- Endpoint URL Input -->
            <q-input
                v-model="localEndpointUrl"
                label="Endpoint URL"
                placeholder="http://localhost:8080"
                outlined
                dense
                :disable="!localUseCustomEndpoint"
                hint="Base URL for your OpenAI-compatible API (e.g., http://localhost:8080)"
            >
                <template v-slot:prepend>
                    <q-icon name="link" />
                </template>
            </q-input>

            <!-- API Key Input -->
            <q-input
                v-model="localEndpointApiKey"
                label="API Key (Optional)"
                placeholder="sk-..."
                outlined
                dense
                type="password"
                :disable="!localUseCustomEndpoint"
                hint="Leave empty if your endpoint doesn't require authentication"
            >
                <template v-slot:prepend>
                    <q-icon name="key" />
                </template>
            </q-input>

            <!-- Action Buttons -->
            <div class="row q-gutter-sm">
                <q-btn
                    label="Validate Endpoint"
                    icon="check_circle"
                    color="info"
                    @click="validateEndpoint"
                    :disable="!localUseCustomEndpoint || !localEndpointUrl || validating"
                    :loading="validating"
                />
                <q-btn
                    label="Save Settings"
                    icon="save"
                    color="primary"
                    @click="saveSettings"
                    :disable="!localUseCustomEndpoint || saving"
                    :loading="saving"
                />
            </div>

            <!-- Validation Result -->
            <q-banner v-if="validationResult" :class="validationResult.valid ? 'bg-positive' : 'bg-negative'" class="text-white q-mt-md">
                <template v-slot:avatar>
                    <q-icon :name="validationResult.valid ? 'check_circle' : 'error'" />
                </template>
                {{ validationResult.message }}
                <div v-if="validationResult.valid && validationResult.models && validationResult.models.length > 0" class="q-mt-sm">
                    <strong>Available models:</strong> {{ validationResult.models.slice(0, 5).map((m: any) => m.id || m).join(', ') }}
                    <span v-if="validationResult.models.length > 5">...</span>
                </div>
            </q-banner>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useConfigStore } from 'src/stores/config.store';
import { useQuasar } from 'quasar';
import { storeToRefs } from 'pinia';

const configStore = useConfigStore();
const $q = useQuasar();

const { currentModel, modelList } = storeToRefs(configStore);

// Helper to shorten model names
const getShortModelName = (name: string) => {
    if (!name) return '';
    const parts = name.split('/');
    return parts[parts.length - 1];
};

const localUseCustomEndpoint = ref(false);
const localEndpointUrl = ref('');
const localEndpointApiKey = ref('');
const validating = ref(false);
const saving = ref(false);
const validationResult = ref<any>(null);

const handleToggleChange = async (value: boolean) => {
    if (!value) {
        // If disabling, save immediately
        await saveSettings();
    }
};

const validateEndpoint = async () => {
    validating.value = true;
    validationResult.value = null;
    
    try {
        const result = await configStore.validateCustomEndpoint(
            localEndpointUrl.value,
            localEndpointApiKey.value
        );
        validationResult.value = result;
        
        if (result.valid) {
            $q.notify({
                type: 'positive',
                message: 'Endpoint validated successfully!',
                position: 'top'
            });
        } else {
            $q.notify({
                type: 'negative',
                message: `Validation failed: ${result.message}`,
                position: 'top'
            });
        }
    } catch (error: any) {
        console.error('Validation error:', error);
        validationResult.value = {
            valid: false,
            message: error.message || 'Unknown error'
        };
        $q.notify({
            type: 'negative',
            message: 'Failed to validate endpoint',
            position: 'top'
        });
    } finally {
        validating.value = false;
    }
};

const saveSettings = async () => {
    saving.value = true;
    
    try {
        await configStore.updateCustomEndpoint({
            use_custom_endpoint: localUseCustomEndpoint.value,
            custom_endpoint_url: localEndpointUrl.value,
            custom_endpoint_api_key: localEndpointApiKey.value
        });
        
        $q.notify({
            type: 'positive',
            message: 'Custom endpoint settings saved successfully!',
            position: 'top'
        });
    } catch (error) {
        console.error('Save error:', error);
        $q.notify({
            type: 'negative',
            message: 'Failed to save settings',
            position: 'top'
        });
    } finally {
        saving.value = false;
    }
};

const loadSettings = async () => {
    try {
        const settings = await configStore.fetchCustomEndpoint();
        localUseCustomEndpoint.value = settings.use_custom_endpoint;
        localEndpointUrl.value = settings.custom_endpoint_url;
        // API key is masked on server, so we don't load it
        if (settings.custom_endpoint_api_key) {
            localEndpointApiKey.value = ''; // Clear field, user needs to re-enter
        }
        // Fetch current model to display in info banner
        await configStore.getOkuuModel();
    } catch (error) {
        console.error('Failed to load custom endpoint settings:', error);
    }
};

onMounted(() => {
    loadSettings();
});
</script>

<style lang="scss" scoped>
.custom-endpoint-settings {
    max-width: 800px;
}

h5 {
    font-weight: 600;
    font-size: 1.25rem;
}
</style>
