import axios from 'axios';

export const resolveHostRedirect = async () => {
    const response = await axios.get(`${process.env.VITE_API_URL as string}`, { maxRedirects: 5 });
    const resolvedUrl = response.request.responseURL;
    // If LOCAL env variable is true then return the local server URL
    if (process.env.LOCAL) {
        return process.env.VITE_LOCAL_API_URL as string;
    }
    return resolvedUrl.replace(/\/$/, '');
};

export const truncate = (str: string, len: number) => {
    return str.length > len ? str.substring(0, len) + "..." : str;
}