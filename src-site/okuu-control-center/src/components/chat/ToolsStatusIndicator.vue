<template>
    <div class="tools-status-indicator">
        <!-- Compact Status Display -->
        <div 
            v-if="variant === 'compact'" 
            class="compact-status cursor-pointer"
            @click="$emit('configure')"
        >
            <q-icon 
                :name="statusIcon" 
                :color="statusColor"
                size="sm"
                class="q-mr-xs"
            />
            <span class="text-caption text-weight-medium">
                {{ statusText }}
            </span>
            <q-tooltip class="text-body2">
                {{ tooltipText }}
            </q-tooltip>
        </div>

        <!-- Badge Style Display -->
        <q-chip
            v-else-if="variant === 'badge'"
            :color="statusColor"
            text-color="white"
            :icon="statusIcon"
            :label="statusText"
            size="sm"
            clickable
            @click="$emit('configure')"
        >
            <q-tooltip class="text-body2">
                {{ tooltipText }}
            </q-tooltip>
        </q-chip>

        <!-- Minimal Icon Only -->
        <q-btn
            v-else-if="variant === 'icon'"
            flat
            round
            dense
            :color="statusColor"
            :icon="statusIcon"
            size="sm"
            @click="$emit('configure')"
        >
            <q-tooltip class="text-body2">
                {{ tooltipText }}
            </q-tooltip>
        </q-btn>

        <!-- Default Card Style -->
        <q-card v-else flat bordered class="status-card cursor-pointer" @click="$emit('configure')">
            <q-card-section class="q-pa-sm">
                <div class="flex items-center">
                    <q-icon :name="statusIcon" :color="statusColor" size="md" class="q-mr-sm" />
                    <div>
                        <div class="text-subtitle2 text-weight-medium">
                            {{ toolsStore.isToolsEnabled ? 'Tools Active' : 'Tools Disabled' }}
                        </div>
                        <div class="text-caption text-grey-6">
                            {{ statusDetails }}
                        </div>
                    </div>
                </div>
            </q-card-section>
        </q-card>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useToolsStore } from 'src/stores/tools.store';

const toolsStore = useToolsStore();

const props = withDefaults(defineProps<{
    variant?: 'default' | 'compact' | 'badge' | 'icon';
}>(), {
    variant: 'compact'
});

const emit = defineEmits<{
    configure: [];
}>();

const statusIcon = computed(() => {
    if (!toolsStore.isToolsEnabled) return 'build_circle';
    if (toolsStore.isAutoDetectEnabled) return 'auto_fix_high';
    return 'build';
});

const statusColor = computed(() => {
    if (!toolsStore.isToolsEnabled) return 'grey-6';
    if (toolsStore.isAutoDetectEnabled) return 'secondary';
    return 'primary';
});

const statusText = computed(() => {
    if (!toolsStore.isToolsEnabled) return 'Tools Off';
    if (toolsStore.enabledToolsCount === 0) return 'No Tools';
    if (toolsStore.isAutoDetectEnabled) return `Smart (${toolsStore.enabledToolsCount})`;
    return `${toolsStore.enabledToolsCount} Tools`;
});

const statusDetails = computed(() => {
    if (!toolsStore.isToolsEnabled) {
        return 'Click to enable tools';
    }
    
    const enabled = [];
    if (toolsStore.config.web_search) enabled.push('Web');
    if (toolsStore.config.calculations) enabled.push('Calc');
    if (toolsStore.config.time_info) enabled.push('Time');
    if (toolsStore.config.memory_search) enabled.push('Memory');
    
    if (enabled.length === 0) return 'No tools enabled';
    if (enabled.length <= 2) return enabled.join(', ');
    return `${enabled.length} tools enabled`;
});

const tooltipText = computed(() => {
    if (!toolsStore.isToolsEnabled) {
        return 'Tools are disabled. Click to configure.';
    }
    
    const details = [];
    if (toolsStore.config.web_search) details.push('🌐 Web Search');
    if (toolsStore.config.calculations) details.push('🔢 Calculator');
    if (toolsStore.config.time_info) details.push('⏰ Time & Date');
    if (toolsStore.config.memory_search) details.push('🧠 Memory Search');
    
    if (details.length === 0) return 'Tools enabled but none configured. Click to setup.';
    
    const status = toolsStore.isAutoDetectEnabled ? 'Smart Detection ON' : 'Manual Mode';
    return `${status}\n${details.join('\n')}`;
});

onMounted(async () => {
    // Load tools configuration if not already loaded
    if (toolsStore.config.web_search === undefined) {
        await toolsStore.fetchToolsConfig();
    }
});
</script>

<style lang="scss" scoped>
.tools-status-indicator {
    .compact-status {
        display: flex;
        align-items: center;
        padding: 4px 8px;
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.05);
        transition: background-color 0.2s ease;
        
        &:hover {
            background: rgba(255, 255, 255, 0.1);
        }
    }
    
    .status-card {
        min-width: 140px;
        transition: all 0.2s ease;
        
        &:hover {
            transform: translateY(-1px);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
    }
}
</style>