import axios from 'axios';

export const resolveHostRedirect = async () => {
    const response = await axios.get(`https://${process.env.VITE_API_URL as string}`, { maxRedirects: 5 });
    const resolvedUrl = response.request.responseURL.replace(/^http(s)?:\/\//, '').replace(/\/$/, '');
    return resolvedUrl;
};