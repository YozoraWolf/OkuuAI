import { defineStore } from 'pinia';
import { getOkuuPfp, uploadOkuuPfp, deleteOkuuPfp, getSystemPrompt, UpdateSystemPrompt, UpdateGlobalMemory, FetchGlobalMemory, CheckOkuuAIStatus, UpdateThink } from 'src/services/config.service';

export const useConfigStore = defineStore('config', {
    state: () => ({
        okuuPfp: '',
        zoomLevel: 100,
        stream: false,
        systemPrompt: '',
        globalMemory: false,
        toggleThinking: false,
        showThinkingInChat: true,
    }),
    actions: {
        setZoomLevel(zoomLevel: number) {
            this.zoomLevel = zoomLevel;
        },
        getZoomLevel() {
            return this.zoomLevel;
        },
        async fetchOkuuPfp() {
            try {
                const response = await getOkuuPfp();
                const imageUrl = URL.createObjectURL(response);
                this.okuuPfp = imageUrl;
            } catch (error) {
                console.error('Failed to fetch Okuu profile picture:', error);
            }
        },
        async uploadOkuuPfp(file: File) {
            try {
                await uploadOkuuPfp(file);
            } catch (error) {
                console.error('Failed to upload Okuu profile picture:', error);
            }
        },
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
        async fetchSystemPrompt() {
            try {
                const response = await getSystemPrompt();
                this.systemPrompt = response.system_prompt;
            } catch (error) {
                console.error('Failed to fetch system prompt:', error);
            }
        },
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
        setGlobalMemory(globalMemory: boolean) {
            this.globalMemory = globalMemory;
        },
        getGlobalMemory() {
            return this.globalMemory
        },
        async fetchGlobalMemory() {
            try {
                const response = await FetchGlobalMemory();
                this.globalMemory = response.global_memory;
            } catch (error) {
                console.error('Failed to fetch global memory:', error);
            }
        },
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
        async updateToggleThinking(toggleThinking: boolean) {
            try {
                // Assuming there's a service to update the thinking state
                await UpdateThink(toggleThinking);
                return true;
            } catch (error) {
                console.error('Failed to update thinking state:', error);
                return false;
            }
        }
    },
   
});