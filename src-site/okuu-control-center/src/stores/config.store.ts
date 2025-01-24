import { defineStore } from 'pinia';
import { getOkuuPfp, uploadOkuuPfp, deleteOkuuPfp } from 'src/services/config.service';

export const useConfigStore = defineStore('config', {
    state: () => ({
        okuuPfp: '',
        zoomLevel: 100
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
                await this.fetchOkuuPfp();
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
        }
    }
});