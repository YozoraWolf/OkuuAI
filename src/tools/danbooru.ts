
import axios from 'axios';
import { Tool } from './enhancedToolSystem';
import { Logger } from '../logger';

export const danbooruTool: Tool = {
    name: "danbooru_search",
    description: "Search for anime-style images on Danbooru. Use this when the user asks for an image of a specific character or tag.",
    category: 'web',
    enabled: true,
    parameters: {
        type: "object",
        properties: {
            tags: {
                type: "string",
                description: "Space-separated tags to search for (e.g., 'hakurei_reimu 1girl'). Use underscores for multi-word tags."
            },
            limit: {
                type: "number",
                description: "Number of images to return (default 1, max 5)",
                default: 1
            }
        },
        required: ["tags"]
    },
    execute: async (params: { tags: string; limit?: number }) => {
        try {
            const limit = Math.min(params.limit || 1, 5);
            const url = `https://danbooru.donmai.us/posts.json?tags=${encodeURIComponent(params.tags)}&limit=${limit}`;

            Logger.INFO(`Searching Danbooru: ${url}`);
            const response = await axios.get(url);
            const posts = response.data;

            if (!posts || posts.length === 0) {
                return "No images found for the given tags.";
            }

            const results = posts.map((post: any) => {
                return {
                    id: post.id,
                    url: post.file_url || post.large_file_url || post.source,
                    rating: post.rating,
                    tags: post.tag_string_character,
                    artist: post.tag_string_artist
                };
            });

            // Format as a nice string for the AI
            let output = `Found ${results.length} images on Danbooru:\n`;
            results.forEach((res: any) => {
                output += `- Image URL: ${res.url}\n  Artist: ${res.artist}\n  Rating: ${res.rating}\n  Characters: ${res.tags}\n`;
            });

            return output;
        } catch (error: any) {
            Logger.ERROR(`Danbooru search failed: ${error.message}`);
            return `Error searching Danbooru: ${error.message}`;
        }
    }
};
