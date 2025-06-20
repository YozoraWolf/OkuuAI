import axios from 'axios';
import { useAuthStore } from 'src/stores/auth.store';
import { resolveHostRedirect } from 'src/utils/okuuai_utils';

const getApiUrl = async () => {
    const apiUrl = await resolveHostRedirect();
    return `${apiUrl}`;
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

// Okuu PFP related

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

// Okuu Prompt related

export const getSystemPrompt = async () => {
    const apiUrl = await getApiUrl();
    const response = await axios.get(`${apiUrl}/config/okuu/system-prompt`, { headers: getAuthHeaders() });
    return response.data;
};

export const UpdateSystemPrompt = async (systemPrompt: string) => {
    const apiUrl = await getApiUrl();
    const response = await axios.post(`${apiUrl}/config/okuu/system-prompt`, { system_prompt: systemPrompt }, { headers: getAuthHeaders() });
    return response.data;
};

// Okuu Global Memory related

export const FetchGlobalMemory = async () => {
    const apiUrl = await getApiUrl();
    const response = await axios.get(`${apiUrl}/config/okuu/global-memory`, { headers: getAuthHeaders() });
    return response.data;
}

export const UpdateGlobalMemory = async (globalMemory: boolean) => {
    const apiUrl = await getApiUrl();
    const response = await axios.post(`${apiUrl}/config/okuu/global-memory`, { global_memory: globalMemory }, { headers: getAuthHeaders() });
    return response.data;
}

// Okuu Think related

export const FetchThink = async () => {
    const apiUrl = await getApiUrl();
    const response = await axios.get(`${apiUrl}/config/okuu/think`, { headers: getAuthHeaders() });
    return response.data;
}

export const UpdateThink = async (think: boolean) => {
    const apiUrl = await getApiUrl();
    const response = await axios.post(`${apiUrl}/config/okuu/think`, { think }, { headers: getAuthHeaders() });
    return response.data;
}

// Okuu Model related

export const getOkuuModel = async () => {
    const apiUrl = await getApiUrl();
    const response = await axios.get(`${apiUrl}/config/okuu/model`, { headers: getAuthHeaders() });
    return response.data;
};

export const setOkuuModel = async (model: string) => {
    const apiUrl = await getApiUrl();
    const response = await axios.post(`${apiUrl}/config/okuu/model`, { model }, { headers: getAuthHeaders() });
    return response.data;
};

export const getDownloadedModels = async () => {
    const apiUrl = await getApiUrl();
    const response = await axios.get(`${apiUrl}/config/okuu/models`, { headers: getAuthHeaders() });
    return response.data;
};

// Misc 

export const CheckOkuuAIStatus = async () => {
    const apiUrl = await getApiUrl();
    const response = await axios.get(`${apiUrl}/status`, { headers: getAuthHeaders() });
    return response;
}