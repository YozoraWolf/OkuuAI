<template>
    <div class="tools-config-button">
        <!-- Main Tools Button -->
        <q-btn
            round
            flat
            size="md"
            :color="toolsStore.isToolsEnabled ? 'primary' : 'grey-6'"
            :icon="toolsStore.isToolsEnabled ? 'build' : 'build_circle'"
            @click="showConfigModal = true"
            :class="{ 'tools-enabled': toolsStore.isToolsEnabled, 'tools-disabled': !toolsStore.isToolsEnabled }"
        >
            <q-tooltip 
                :delay="500"
                anchor="bottom middle" 
                self="top middle"
                class="text-body2"
            >
                <div v-if="toolsStore.isToolsEnabled">
                    <div class="text-weight-medium">Tools Enabled</div>
                    <div class="text-caption">
                        {{ toolsStore.enabledToolsCount }} of {{ totalToolsCount }} tools active
                    </div>
                    <div class="text-caption text-grey-4 q-mt-xs">
                        Click to configure
                    </div>
                </div>
                <div v-else>
                    <div class="text-weight-medium">Tools Disabled</div>
                    <div class="text-caption">Click to enable and configure</div>
                </div>
            </q-tooltip>

            <!-- Status indicator -->
            <q-badge 
                v-if="toolsStore.isToolsEnabled && toolsStore.enabledToolsCount > 0"
                floating 
                :color="toolsStore.isAutoDetectEnabled ? 'green' : 'blue'"
                rounded
                style="top: -2px; right: -2px; min-width: 18px; height: 18px; font-size: 10px;"
            >
                {{ toolsStore.enabledToolsCount }}
            </q-badge>
        </q-btn>

        <!-- Quick Status Indicators (optional, for compact display) -->
        <div v-if="showQuickStatus && toolsStore.isToolsEnabled" class="quick-status q-ml-xs">
            <q-chip 
                v-if="toolsStore.isAutoDetectEnabled"
                dense 
                size="sm" 
                color="secondary" 
                text-color="white"
                icon="auto_fix_high"
                :label="`Smart: ${toolsStore.enabledToolsCount}`"
                class="q-mr-xs"
            />
            
            <!-- Individual tool indicators -->
            <div class="flex q-gutter-xs">
                <q-icon 
                    v-if="toolsStore.config.web_search" 
                    name="public" 
                    size="xs" 
                    color="blue"
                    class="tool-indicator"
                >
                    <q-tooltip class="text-caption">Web Search</q-tooltip>
                </q-icon>
                
                <q-icon 
                    v-if="toolsStore.config.calculations" 
                    name="calculate" 
                    size="xs" 
                    color="green"
                    class="tool-indicator"
                >
                    <q-tooltip class="text-caption">Calculator</q-tooltip>
                </q-icon>
                
                <q-icon 
                    v-if="toolsStore.config.time_info" 
                    name="schedule" 
                    size="xs" 
                    color="teal"
                    class="tool-indicator"
                >
                    <q-tooltip class="text-caption">Time & Date</q-tooltip>
                </q-icon>
                
                <q-icon 
                    v-if="toolsStore.config.memory_search" 
                    name="psychology" 
                    size="xs" 
                    color="purple"
                    class="tool-indicator"
                >
                    <q-tooltip class="text-caption">Memory Search</q-tooltip>
                </q-icon>
            </div>
        </div>

        <!-- Tools Configuration Modal -->
        <ToolsConfigModal v-model:show="showConfigModal" />
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useToolsStore } from 'src/stores/tools.store';
import ToolsConfigModal from './ToolsConfigModal.vue';

const toolsStore = useToolsStore();

const props = withDefaults(defineProps<{
    showQuickStatus?: boolean;
    variant?: 'default' | 'compact' | 'minimal';
}>(), {
    showQuickStatus: false,
    variant: 'default'
});

const showConfigModal = ref(false);

// Calculate total available tools
const totalToolsCount = computed(() => {
    const basicTools = ['web_search', 'calculations', 'file_access', 'memory_search'];
    return basicTools.length + toolsStore.config.mcp_servers.length;
});

onMounted(async () => {
    // Load tools configuration on mount
    if (!toolsStore.config.enabled && toolsStore.config.web_search === undefined) {
        await toolsStore.fetchToolsConfig();
    }
});
</script>

<style lang="scss" scoped>
.tools-config-button {
    display: flex;
    align-items: center;
    
    .tools-enabled {
        transition: all 0.3s ease;
        
        &:hover {
            transform: scale(1.05);
        }
    }
    
    .tools-disabled {
        opacity: 0.7;
        
        &:hover {
            opacity: 1;
        }
    }
    
    .quick-status {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 4px;
    }
    
    .tool-indicator {
        cursor: pointer;
        opacity: 0.8;
        transition: opacity 0.2s ease;
        
        &:hover {
            opacity: 1;
        }
    }
}

// Variant styles
.tools-config-button {
    &.compact {
        .q-btn {
            min-width: 36px;
            min-height: 36px;
        }
    }
    
    &.minimal {
        .quick-status {
            display: none;
        }
    }
}
</style>