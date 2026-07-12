import axios from 'axios';
import { resolveHostRedirect } from 'src/utils/okuuai_utils';
import { useAuthStore } from 'src/stores/auth.store';

export const transcribeVoiceNote = async (audio: Blob, filename: string) => {
    const apiUrl = await resolveHostRedirect();
    const authStore = useAuthStore();
    const form = new FormData();
    form.append('file', audio, filename);
    const response = await axios.post(`${apiUrl}/audio/transcriptions`, form, {
        headers: { Authorization: `Bearer ${authStore.token}`, 'ngrok-skip-browser-warning': true },
        timeout: 125000,
    });
    return String(response.data.text || '').trim();
};
