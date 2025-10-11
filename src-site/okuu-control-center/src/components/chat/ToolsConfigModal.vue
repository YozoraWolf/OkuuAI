<template>
    <q-dialog v-model="showModal" persistent>
        <q-card class="tools-config-modal" style="min-width: 500px">
            <q-card-section class="row items-center">
                <div class="col">
                    <div class="text-h6 flex items-center">
                        <q-icon name="build" size="md" color="primary" class="q-mr-sm" />
                        Tools Configuration
                    </div>
                    <div class="text-subtitle2 text-grey-6">
                        Configure Okuu's intelligent capabilities
                    </div>
                </div>
                <q-btn flat round dense icon="close" @click="closeModal" />
            </q-card-section>

            <q-separator />

            <q-card-section>
                <!-- Loading State -->
                <div v-if="toolsStore.loading" class="text-center q-py-lg">
                    <q-spinner color="primary" size="50px" />
                    <div class="q-mt-md text-grey-6">Loading tools configuration...</div>
                </div>

                <!-- Error State -->
                <q-banner v-if="toolsStore.error && !toolsStore.loading" rounded class="bg-red-1 text-red q-mb-md">
                    <template v-slot:avatar>
                        <q-icon name="error" color="red" />
                    </template>
                    {{ toolsStore.error }}
                </q-banner>

                <!-- Configuration Content -->
                <div v-if="!toolsStore.loading" class="tools-config-content">
                    <!-- Master Switch -->
                    <div class="config-section q-mb-lg">
                        <div class="flex items-center justify-between q-mb-md">
                            <div>
                                <div class="text-h6 flex items-center">
                                    <q-icon name="power_settings_new" size="sm" color="primary" class="q-mr-sm" />
                                    Master Switch
                                </div>
                                <div class="text-caption text-grey-6">
                                    Enable or disable all tools globally
                                </div>
                            </div>
                            <q-toggle 
                                v-model="toolsStore.config.enabled" 
                                @update:model-value="toggleMasterSwitch"
                                color="primary"
                                size="lg"
                            />
                        </div>
                        
                        <!-- Auto Detect -->
                        <div class="flex items-center justify-between" :class="{ 'disabled-section': !toolsStore.config.enabled }">
                            <div>
                                <div class="text-subtitle1 flex items-center">
                                    <q-icon name="auto_fix_high" size="sm" color="secondary" class="q-mr-sm" />
                                    Smart Detection
                                </div>
                                <div class="text-caption text-grey-6">
                                    Let Okuu automatically decide when to use tools
                                </div>
                            </div>
                            <q-toggle 
                                v-model="toolsStore.config.auto_detect" 
                                @update:model-value="toggleAutoDetect"
                                :disable="!toolsStore.config.enabled"
                                color="secondary"
                            />
                        </div>
                    </div>

                    <q-separator class="q-mb-lg" />

                    <!-- Individual Tools -->
                    <div class="config-section">
                        <div class="text-h6 q-mb-md flex items-center">
                            <q-icon name="extension" size="sm" color="accent" class="q-mr-sm" />
                            Available Tools
                            <q-chip 
                                :label="`${toolsStore.enabledToolsCount} enabled`" 
                                color="accent" 
                                text-color="white" 
                                size="sm" 
                                class="q-ml-sm"
                            />
                        </div>

                        <div class="tools-grid">
                            <!-- Web Search -->
                            <q-card flat bordered class="tool-card" :class="{ 'tool-disabled': !toolsStore.config.enabled }">
                                <q-card-section class="q-pa-md">
                                    <div class="flex items-center justify-between">
                                        <div>
                                            <div class="flex items-center">
                                                <q-icon name="public" color="blue" size="sm" class="q-mr-sm" />
                                                <span class="text-subtitle1 text-weight-medium">Web Search</span>
                                            </div>
                                            <div class="text-caption text-grey-6 q-mt-xs">
                                                Search the internet for current information
                                            </div>
                                        </div>
                                        <q-toggle 
                                            v-model="toolsStore.config.web_search" 
                                            @update:model-value="(val) => updateToolConfig('web_search', val)"
                                            :disable="!toolsStore.config.enabled"
                                            color="blue"
                                        />
                                    </div>
                                </q-card-section>
                            </q-card>

                            <!-- Calculator -->
                            <q-card flat bordered class="tool-card" :class="{ 'tool-disabled': !toolsStore.config.enabled }">
                                <q-card-section class="q-pa-md">
                                    <div class="flex items-center justify-between">
                                        <div>
                                            <div class="flex items-center">
                                                <q-icon name="calculate" color="green" size="sm" class="q-mr-sm" />
                                                <span class="text-subtitle1 text-weight-medium">Calculator</span>
                                            </div>
                                            <div class="text-caption text-grey-6 q-mt-xs">
                                                Perform mathematical calculations
                                            </div>
                                        </div>
                                        <q-toggle 
                                            v-model="toolsStore.config.calculations" 
                                            @update:model-value="(val) => updateToolConfig('calculations', val)"
                                            :disable="!toolsStore.config.enabled"
                                            color="green"
                                        />
                                    </div>
                                </q-card-section>
                            </q-card>

                            <!-- Time & Date Info -->
                            <q-card flat bordered class="tool-card" :class="{ 'tool-disabled': !toolsStore.config.enabled }">
                                <q-card-section class="q-pa-md">
                                    <div class="flex items-center justify-between">
                                        <div>
                                            <div class="flex items-center">
                                                <q-icon name="schedule" color="teal" size="sm" class="q-mr-sm" />
                                                <span class="text-subtitle1 text-weight-medium">Time & Date</span>
                                            </div>
                                            <div class="text-caption text-grey-6 q-mt-xs">
                                                Get current time, date, and timezone info
                                            </div>
                                        </div>
                                        <q-toggle 
                                            v-model="toolsStore.config.time_info" 
                                            @update:model-value="(val) => updateToolConfig('time_info', val)"
                                            :disable="!toolsStore.config.enabled"
                                            color="teal"
                                        />
                                    </div>
                                </q-card-section>
                            </q-card>

                            <!-- Memory Search -->
                            <q-card flat bordered class="tool-card" :class="{ 'tool-disabled': !toolsStore.config.enabled }">
                                <q-card-section class="q-pa-md">
                                    <div class="flex items-center justify-between">
                                        <div>
                                            <div class="flex items-center">
                                                <q-icon name="psychology" color="purple" size="sm" class="q-mr-sm" />
                                                <span class="text-subtitle1 text-weight-medium">Memory Search</span>
                                            </div>
                                            <div class="text-caption text-grey-6 q-mt-xs">
                                                Search through conversation history
                                            </div>
                                        </div>
                                        <q-toggle 
                                            v-model="toolsStore.config.memory_search" 
                                            @update:model-value="(val) => updateToolConfig('memory_search', val)"
                                            :disable="!toolsStore.config.enabled"
                                            color="purple"
                                        />
                                    </div>
                                </q-card-section>
                            </q-card>
                        </div>
                    </div>

                    <!-- MCP Servers (Future) -->
                    <div v-if="toolsStore.config.mcp_servers.length > 0" class="config-section q-mt-lg">
                        <q-separator class="q-mb-md" />
                        <div class="text-h6 q-mb-md flex items-center">
                            <q-icon name="hub" size="sm" color="deep-purple" class="q-mr-sm" />
                            MCP Servers
                        </div>
                        <div class="text-caption text-grey-6 q-mb-md">
                            Model Context Protocol servers for extended capabilities
                        </div>
                        <!-- MCP server list will go here -->
                    </div>
                </div>
            </q-card-section>

            <q-separator />

            <q-card-actions align="right">
                <q-btn flat label="Close" @click="closeModal" />
                <q-btn 
                    unelevated 
                    color="primary" 
                    label="Test Tools" 
                    @click="testTools"
                    :disable="!toolsStore.config.enabled"
                    icon="play_arrow"
                />
            </q-card-actions>
        </q-card>
    </q-dialog>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { useQuasar } from 'quasar';
import { useToolsStore } from 'src/stores/tools.store';
import { storeToRefs } from 'pinia';

const $q = useQuasar();
const toolsStore = useToolsStore();

const props = defineProps<{
    show: boolean;
}>();

const emit = defineEmits<{
    'update:show': [value: boolean];
}>();

const { config } = storeToRefs(toolsStore);
const showModal = ref(props.show);

// Watch for prop changes
watch(() => props.show, (newVal) => {
    showModal.value = newVal;
});

// Watch for modal changes
watch(showModal, (newVal) => {
    emit('update:show', newVal);
});

onMounted(async () => {
    await toolsStore.fetchToolsConfig();
    await toolsStore.fetchAvailableTools();
});

const closeModal = () => {
    showModal.value = false;
};

const toggleMasterSwitch = async (enabled: boolean) => {
    const success = await toolsStore.updateConfig({ enabled });
    if (success) {
        $q.notify({
            message: `Tools ${enabled ? 'enabled' : 'disabled'} successfully`,
            color: enabled ? 'green' : 'orange',
            position: 'top',
            timeout: 2000,
            icon: enabled ? 'check_circle' : 'cancel'
        });
    }
};

const toggleAutoDetect = async (autoDetect: boolean) => {
    const success = await toolsStore.updateConfig({ auto_detect: autoDetect });
    if (success) {
        $q.notify({
            message: `Smart detection ${autoDetect ? 'enabled' : 'disabled'}`,
            color: autoDetect ? 'green' : 'grey',
            position: 'top',
            timeout: 2000,
            icon: 'auto_fix_high'
        });
    }
};

const updateToolConfig = async (toolKey: string, enabled: boolean) => {
    const success = await toolsStore.updateConfig({ [toolKey]: enabled });
    if (success) {
        $q.notify({
            message: `${toolKey.replace('_', ' ')} ${enabled ? 'enabled' : 'disabled'}`,
            color: enabled ? 'green' : 'grey',
            position: 'top',
            timeout: 1500,
            icon: enabled ? 'check' : 'close'
        });
    }
};

const testTools = () => {
    closeModal();
    $q.notify({
        message: 'Try asking Okuu: "What\'s 15% of 2,500?" or "What\'s the weather like today?"',
        color: 'blue',
        position: 'top',
        timeout: 4000,
        icon: 'lightbulb'
    });
};
</script>

<style lang="scss" scoped>
.tools-config-modal {
    max-width: 600px;
    width: 100%;
}

.config-section {
    .disabled-section {
        opacity: 0.5;
        pointer-events: none;
    }
}

.tools-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1rem;
}

.tool-card {
    border: 1px solid rgba(255, 255, 255, 0.12);
    transition: all 0.3s ease;
    
    &:hover:not(.tool-disabled) {
        border-color: rgba(255, 255, 255, 0.24);
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
    
    &.tool-disabled {
        opacity: 0.5;
        background-color: rgba(255, 255, 255, 0.02);
    }
}

.tools-config-content {
    min-height: 300px;
}
</style>