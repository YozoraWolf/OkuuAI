import { defineStore } from 'pinia';
import { getToolsConfig, updateToolsConfig, getAvailableTools, ToolConfig, Tool } from 'src/services/tools.service';

interface ToolsStore {
    config: ToolConfig;
    availableTools: Tool[];
    loading: boolean;
    error: string | null;
}

export const useToolsStore = defineStore('tools', {
    state: (): ToolsStore => ({
        config: {
            enabled: true,
            auto_detect: true,
            web_search: true,
            calculations: true,
            memory_search: true,
            time_info: true,
            mcp_servers: []
        },
        availableTools: [],
        loading: false,
        error: null,
    }),

    actions: {
        async fetchToolsConfig() {
            this.loading = true;
            this.error = null;
            
            try {
                const { data } = await getToolsConfig();
                if (data.success) {
                    this.config = data.config;
                } else {
                    this.error = data.error || 'Failed to fetch tools configuration';
                }
            } catch (error: any) {
                console.error('Failed to fetch tools config:', error);
                this.error = error.message || 'Network error occurred';
            } finally {
                this.loading = false;
            }
        },

        async updateConfig(newConfig: Partial<ToolConfig>) {
            this.loading = true;
            this.error = null;
            
            try {
                const { data } = await updateToolsConfig(newConfig);
                if (data.success) {
                    this.config = data.config;
                    return true;
                } else {
                    this.error = data.error || 'Failed to update tools configuration';
                    return false;
                }
            } catch (error: any) {
                console.error('Failed to update tools config:', error);
                this.error = error.message || 'Network error occurred';
                return false;
            } finally {
                this.loading = false;
            }
        },

        async fetchAvailableTools() {
            try {
                const { data } = await getAvailableTools();
                if (data.success) {
                    this.availableTools = data.tools;
                }
            } catch (error) {
                console.error('Failed to fetch available tools:', error);
            }
        },

        async toggleTool(toolKey: keyof Omit<ToolConfig, 'mcp_servers'>) {
            const newValue = !this.config[toolKey];
            const success = await this.updateConfig({ [toolKey]: newValue });
            return success;
        },

        async toggleMasterSwitch() {
            return await this.toggleTool('enabled');
        },

        async toggleAutoDetect() {
            return await this.toggleTool('auto_detect');
        },

        getToolsByCategory() {
            const categories: Record<string, Tool[]> = {};
            
            this.availableTools.forEach(tool => {
                if (!categories[tool.category]) {
                    categories[tool.category] = [];
                }
                categories[tool.category]!.push(tool);
            });
            
            return categories;
        }
    },

    getters: {
        isToolsEnabled: (state) => state.config.enabled,
        isAutoDetectEnabled: (state) => state.config.auto_detect,
        enabledToolsCount: (state) => {
            const toolKeys: (keyof ToolConfig)[] = ['web_search', 'calculations', 'memory_search', 'time_info'];
            return toolKeys.filter(key => state.config[key]).length;
        }
    }
});