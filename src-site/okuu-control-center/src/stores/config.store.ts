import { defineStore } from 'pinia';
import { getOkuuPfp, uploadOkuuPfp, deleteOkuuPfp, getSystemPrompt, UpdateSystemPrompt, UpdateGlobalMemory, FetchGlobalMemory, CheckOkuuAIStatus, UpdateThink, FetchThink, getDownloadedModels, setOkuuModel, getOkuuModel } from 'src/services/config.service';

export const useConfigStore = defineStore('config', {
    state: () => ({
        okuuPfp: '',
        zoomLevel: 100,
        stream: false,
        systemPrompt: '',
        globalMemory: false,
        toggleThinking: false,
        showThinkingInChat: true,

        modelList: [] as any[],
        currentModel: '',

        configLoading: false,
    }),
    actions: {
        setZoomLevel(zoomLevel: number) {
            this.zoomLevel = zoomLevel;
        },
        getZoomLevel() {
            return this.zoomLevel;
        },

        // Okuu Profile Picture related

        // fetch Okuu profile picture
        async fetchOkuuPfp() {
            try {
                const response = await getOkuuPfp();
                const imageUrl = URL.createObjectURL(response);
                this.okuuPfp = imageUrl;
            } catch (error) {
                console.error('Failed to fetch Okuu profile picture:', error);
            }
        },
        // upload Okuu profile picture
        async uploadOkuuPfp(file: File) {
            try {
                await uploadOkuuPfp(file);
            } catch (error) {
                console.error('Failed to upload Okuu profile picture:', error);
            }
        },
        // delete Okuu profile picture
        async deleteOkuuPfp() {
            try {
                await deleteOkuuPfp();
                this.okuuPfp = '';
            } catch (error) {
                console.error('Failed to delete Okuu profile picture:', error);
            }
        },
        setStream(stream: boolean) {
            this.stream = stream;
        },

        // Stream related

        // fetch system prompt
        async fetchSystemPrompt() {
            try {
                const response = await getSystemPrompt();
                this.systemPrompt = response.system_prompt;
            } catch (error) {
                console.error('Failed to fetch system prompt:', error);
            }
        },
        // update system prompt
        async updateSystemPrompt(systemPrompt: string) {
            if(systemPrompt === '') {
                console.error('System prompt cannot be empty.');
                return;
            } else if(systemPrompt === this.systemPrompt) {
                console.log('System prompt has not changed. No need to update.');
                return;
            }

            try {
                await UpdateSystemPrompt(systemPrompt);
                this.systemPrompt = systemPrompt;
            } catch (error) {
                console.error('Failed to set system prompt:', error);
            }
        },

        // Global Memory related
        
        // set global memory
        setGlobalMemory(globalMemory: boolean) {
            this.globalMemory = globalMemory;
        },
        // get global memory
        getGlobalMemory() {
            return this.globalMemory
        },


        // fetch global memory
        async fetchGlobalMemory() {
            try {
                const response = await FetchGlobalMemory();
                this.globalMemory = response.global_memory;
            } catch (error) {
                console.error('Failed to fetch global memory:', error);
            }
        },
        // update global memory
        async updateGlobalMemory(globalMemory: boolean) {
            if(globalMemory === this.globalMemory) {
                console.log('Global memory has not changed. No need to update.');
                return;
            }
            try {
                await UpdateGlobalMemory(globalMemory);
                this.globalMemory = globalMemory;
            } catch (error) {
                console.error('Failed to update global memory:', error);
            }
        },

        // Okuu AI status related
        async checkOkuuAIStatus() {
            try {
                const response = await CheckOkuuAIStatus();
                console.log('Okuu AI status:', response);
                return response.status === 200;
            } catch (error) {
                console.error('Failed to check Okuu AI status:', error);
                return false;
            }
        },

        // Thinking related

        // update thinking state
        async updateToggleThinking(toggleThinking: boolean) {
            try {
                this.configLoading = true;
                // Assuming there's a service to update the thinking state
                await UpdateThink(toggleThinking);
                this.toggleThinking = toggleThinking;
                return true;
            } catch (error) {
                console.error('Failed to update thinking state:', error);
                return false;
            }
        },
        // fetch thinking state
        async fetchThinkingState() {
            try {
                const response = await FetchThink();
                this.toggleThinking = response.think;
            } catch (error) {
                console.error('Failed to fetch thinking state:', error);
                this.toggleThinking = false; // Default to false if fetch fails
            }
        },

        // Okuu Model related

        // fetch all downloaded models
        async fetchAllDownloadedModels() {
            try {
                const response = await getDownloadedModels();
                this.modelList = response.models;
                return response.models;
            } catch (error) {
                console.error('Failed to fetch downloaded models:', error);
                return [];
            }
        },

        // set okuu model
        async setOkuuModel(model: string) {
            if (!model) {
                console.error('Model name cannot be empty.');
                return;
            }
            try {
                this.configLoading = true;
                const response = await setOkuuModel(model);
                this.configLoading = false;
                console.log('Okuu model set to:', response.model);
                return response.model;
            } catch (error) {
                console.error('Failed to set Okuu model:', error);
                return null;
            }
        },
        // get current okuu model
        async getOkuuModel() {
            try {
                const response = await getOkuuModel();
                this.currentModel = response.model;
                return response.model;
            } catch (error) {
                console.error('Failed to fetch Okuu model:', error);
                return null;
            }
        }
    },
   
});