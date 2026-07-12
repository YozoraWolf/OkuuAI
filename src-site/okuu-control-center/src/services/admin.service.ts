import axios from 'axios';
import { resolveHostRedirect } from 'src/utils/okuuai_utils';
import { useAuthStore } from 'src/stores/auth.store';

export const fetchAdminOverview = async () => {
    const apiUrl = await resolveHostRedirect();
    const authStore = useAuthStore();
    const response = await axios.get(`${apiUrl}/admin/overview`, {
        headers: { Authorization: `Bearer ${authStore.token}`, 'ngrok-skip-browser-warning': true },
    });
    return response.data;
};
