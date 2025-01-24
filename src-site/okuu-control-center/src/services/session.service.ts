import axios from 'axios';
import { resolveHostRedirect } from 'src/utils/okuuai_utils';
import { useAuthStore } from 'src/stores/auth.store';

const getApiUrl = async () => {
    const apiUrl = await resolveHostRedirect();
    return `https://${apiUrl}`;
};

const getAuthHeaders = () => {
    const authStore = useAuthStore();
    return {
        'x-api-key': authStore.getApiKey,
        'Content-Type': 'application/json',
        "ngrok-skip-browser-warning": true,
    };
};

export const getAllSessions = async () => {
    const apiUrl = await getApiUrl();
    const response = await axios.get(`${apiUrl}/memory/sessions`, {
        headers: getAuthHeaders(),
    });
    console.log("HEarders:", getAuthHeaders());
    console.log("URL:", `${apiUrl}/memory/sessions`);
    console.log('Fetched sessions:', response.data);
    return response;
};

export const getSessionMessages = async (sessionId: string) => {
    const apiUrl = await getApiUrl();
    const response = await axios.get(`${apiUrl}/memory/sessions/${sessionId}`,{
        headers: getAuthHeaders(),
    });
    return response;
};

export const createSession = async () => {
    const apiUrl = await getApiUrl();
    const response = await axios.post(`${apiUrl}/memory/sessions`, {}, {
        headers: getAuthHeaders(),
    });
    return response;
};

export const deleteSession = async (sessionId: string) => {
    const apiUrl = await getApiUrl();
    const response = await axios.delete(`${apiUrl}/memory/sessions/${sessionId}`, {
        headers: getAuthHeaders(),
    });
    return response;
}

export const sendAttachment = async (formData: FormData) => {
    const apiUrl = await getApiUrl();
    const response = await axios.post(`${apiUrl}/memory/record`, formData, {
        headers: 
        {
            ...getAuthHeaders(),
            'Content-Type': 'multipart/form-data',
        },
    });
    return response;
}
