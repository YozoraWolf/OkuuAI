import axios from 'axios';
import { resolveHostRedirect } from 'src/utils/okuuai_utils';
import { useAuthStore } from 'src/stores/auth.store';

export interface ToolConfig {
    enabled: boolean;
    auto_detect: boolean;
    web_search: boolean;
    calculations: boolean;
    memory_search: boolean;
    time_info: boolean;
    mcp_servers: string[];
}

export interface Tool {
    name: string;
    description: string;
    category: string;
    enabled: boolean;
}

const getApiUrl = async () => {
    const apiUrl = await resolveHostRedirect();
    return `${apiUrl}`;
};

    const getAuthHeaders = () => {
        const authStore = useAuthStore();
        const token = (authStore as any).token || localStorage.getItem('token');
        return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': true } : { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': true };
    };

export const getToolsConfig = async () => {
    const apiUrl = await getApiUrl();
    const response = await axios.get(`${apiUrl}/tools/config`, {
        headers: getAuthHeaders(),
    });
    return response;
};

export const updateToolsConfig = async (config: Partial<ToolConfig>) => {
    const apiUrl = await getApiUrl();
    const response = await axios.put(`${apiUrl}/tools/config`, config, {
        headers: getAuthHeaders(),
    });
    return response;
};

export const getAvailableTools = async () => {
    const apiUrl = await getApiUrl();
    const response = await axios.get(`${apiUrl}/tools/available`, {
        headers: getAuthHeaders(),
    });
    return response;
};