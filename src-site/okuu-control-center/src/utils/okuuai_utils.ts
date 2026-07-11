import axios from 'axios';

export const resolveHostRedirect = async () => {
    // if LOCAL flag is set, return the local API URL
    if (process.env.LOCAL) {
        const localApiUrl = process.env.VITE_LOCAL_API_URL as string;
        if (typeof window !== 'undefined') {
            const url = new URL(localApiUrl);
            if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
                url.hostname = window.location.hostname;
            }
            return url.toString().replace(/\/$/, '');
        }
        return localApiUrl;
    }

    // otherwise, resolve the API URL from the environment variable
    try {
        const response = await axios.get(`${process.env.VITE_API_URL as string}`, { maxRedirects: 5 });
        const resolvedUrl = response.request.responseURL;
        return resolvedUrl.replace(/\/$/, '');

    } catch (error) {
        console.error('Error resolving host redirect:', error);
    }
};

export const truncate = (str: string, len: number) => {
    return str.length > len ? str.substring(0, len) + "..." : str;
}
