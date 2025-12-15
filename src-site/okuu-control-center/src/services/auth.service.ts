import axios, { AxiosResponse } from 'axios';
import { resolveHostRedirect } from 'src/utils/okuuai_utils';

export const checkApiKey = async (apiKey: string): Promise<AxiosResponse<any> | null> => {
    try {
        const resolvedUrl = await resolveHostRedirect();
        console.log('Resolved URL:', resolvedUrl);
        const response = await axios.post(`${resolvedUrl}/apiKey`, null, {
            headers: {
                'X-Api-Key': apiKey,
            },
        });
        return response;
    } catch (error) {
        return null;
    }
};

export const loginWithCredentials = async (username: string, password: string) => {
    try {
        const resolvedUrl = await resolveHostRedirect();
        const response = await axios.post(`${resolvedUrl}/users/login`, { username, password });
        return response;
    } catch (err) {
        return null;
    }
};

export const setAuthToken = (token: string | null) => {
    if (token) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        localStorage.setItem('token', token);
    } else {
        delete axios.defaults.headers.common['Authorization'];
        localStorage.removeItem('token');
    }
};
