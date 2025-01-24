import axios from 'axios';
import { useAuthStore } from 'src/stores/auth.store';
import { resolveHostRedirect } from 'src/utils/okuuai_utils';

const getApiUrl = async () => {
    const apiUrl = await resolveHostRedirect();
    return `https://${apiUrl}`;
};

const getAuthHeaders = () => {
    const authStore = useAuthStore();
    return {
        'x-api-key': authStore.getApiKey,
        'ngrok-skip-browser-warning': true,
    };
};

export const uploadOkuuPfp = async (file: File) => {
    const apiUrl = await getApiUrl();
    const formData = new FormData();
    formData.append('file', file);

    const response = await axios.post(`${apiUrl}/config/okuu/pfp`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
            ...getAuthHeaders(),
        },
    });
    return response.data;
};

export const getOkuuPfp = async () => {
    const apiUrl = await getApiUrl();
    const response = await axios.get(`${apiUrl}/config/okuu/pfp`, { responseType: 'blob', headers: getAuthHeaders() });
    return response.data;
};

export const deleteOkuuPfp = async () => {
    const apiUrl = await getApiUrl();
    const response = await axios.delete(`${apiUrl}/config/okuu/pfp`, { headers: getAuthHeaders() });
    return response.data;
};
