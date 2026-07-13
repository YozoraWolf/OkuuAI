import axios from 'axios';

export const resolveHostRedirect = async () => {
    // HTTPS deployments proxy API and WebSocket traffic through the same origin.
    // Falling back to a configured HTTP API would be blocked as mixed content.
    if (window.location.protocol === 'https:') {
        return window.location.origin;
    }

    // if LOCAL flag is set, return the local API URL
    if (process.env.LOCAL) {
        return process.env.VITE_LOCAL_API_URL as string;
    }

    // Containerized deployments proxy the API through the frontend origin.
    if (!process.env.VITE_API_URL) {
        return window.location.origin;
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
