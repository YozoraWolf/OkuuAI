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
