import axios from 'axios';
import { resolveHostRedirect } from 'src/utils/okuuai_utils';
import { useAuthStore } from 'src/stores/auth.store';

export type ModuleState = {
    id: string;
    name: string;
    description: string;
    enabled: boolean;
    available: boolean;
    status: 'online' | 'offline' | 'degraded' | 'unavailable' | 'enabling' | 'disabling';
    detail: string;
    endpoint?: string;
    lastChangedAt?: number;
};

const requestConfig = () => {
    const authStore = useAuthStore();
    return { headers: { Authorization: `Bearer ${authStore.token}`, 'ngrok-skip-browser-warning': true } };
};

export const fetchModules = async () => {
    const apiUrl = await resolveHostRedirect();
    const response = await axios.get(`${apiUrl}/modules`, requestConfig());
    return response.data as { modules: ModuleState[]; timestamp: number };
};

export const setModuleEnabled = async (id: string, enabled: boolean) => {
    const apiUrl = await resolveHostRedirect();
    const response = await axios.post(`${apiUrl}/modules/${id}/${enabled ? 'enable' : 'disable'}`, {}, requestConfig());
    return response.data.module as ModuleState;
};
