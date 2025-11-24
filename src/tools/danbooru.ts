
import axios from 'axios';
import { Tool } from './enhancedToolSystem';
import { Logger } from '../logger';

/**
 * Lightweight Danbooru tag lookup to check if a tag exists and get post count
 * @param tag - Tag to look up (use underscores for multi-word tags)
 * @returns Object with exists flag, post count, and formatted tag string
 */
export async function lookupDanbooruTag(tag: string): Promise<{ exists: boolean; count: number; tagString: string }> {
    try {
        // Normalize tag (convert spaces to underscores, lowercase)
        const normalizedTag = tag.trim().toLowerCase().replace(/\s+/g, '_');

        // Use Danbooru's autocomplete API to check if tag exists
        const autocompleteUrl = `https://danbooru.donmai.us/autocomplete.json?search[query]=${encodeURIComponent(normalizedTag)}&search[type]=tag_query&limit=1`;

        Logger.INFO(`Looking up Danbooru tag: ${normalizedTag}`);
        const response = await axios.get(autocompleteUrl);

        if (response.data && response.data.length > 0) {
            const tagInfo = response.data[0];
            return {
                exists: true,
                count: tagInfo.post_count || 0,
                tagString: tagInfo.value || normalizedTag
            };
        }

        return { exists: false, count: 0, tagString: normalizedTag };
    } catch (error: any) {
        Logger.ERROR(`Danbooru tag lookup failed: ${error.message}`);
        return { exists: false, count: 0, tagString: tag };
    }
}

/**
 * Intelligently validate and combine multiple tag words from user input
 * Example: "reimu hakurei smiling" → "hakurei_reimu smiling"
 * - Validates each word via autocomplete
 * - Deduplicates overlapping tags (skip if word is in already-validated tag)
 * - Returns up to 2 validated tags
 */
export async function validateAndCombineTags(input: string, maxTags: number = 2): Promise<{ tags: string; validatedTags: string[] }> {
    const words = input.trim().toLowerCase().split(/\s+/);
    const validatedTags: string[] = [];

    Logger.INFO(`Validating tags from input: "${input}"`);

    for (const word of words) {
        if (validatedTags.length >= maxTags) {
            Logger.INFO(`Reached max tags limit (${maxTags}), stopping validation`);
            break;
        }

        // Check if this word is already contained in any validated tag
        const isContained = validatedTags.some(tag => tag.includes(word));
        if (isContained) {
            Logger.INFO(`Skipping "${word}" - already contained in validated tag`);
            continue;
        }

        // Look up this word
        const result = await lookupDanbooruTag(word);
        if (result.exists) {
            validatedTags.push(result.tagString);
            Logger.INFO(`Validated "${word}" → "${result.tagString}"`);
        } else {
            Logger.WARN(`Tag "${word}" not found on Danbooru, skipping`);
        }
    }

    const combinedTags = validatedTags.join(' ');
    Logger.INFO(`Final validated tags: "${combinedTags}"`);

    return {
        tags: combinedTags,
        validatedTags
    };
}

export const danbooruTool: Tool = {
    name: "danbooru_search",
    description: "Search for anime-style images on Danbooru. IMPORTANT: Maximum 2 tags allowed (free API limit). Prioritize the most specific tags (e.g., character name + '1girl' OR series name + character).",
    category: 'web',
    enabled: true,
    parameters: {
        type: "object",
        properties: {
            tags: {
                type: "string",
                description: "Space-separated tags (MAX 2 TAGS). Examples: 'hatsune_miku 1girl' or 'touhou hakurei_reimu'. Use underscores for multi-word tags."
            },
            limit: {
                type: "number",
                description: "Number of images to return (default 1, max 5)",
                default: 1
            },
            random: {
                type: "boolean",
                description: "If true, get random images instead of most recent (default false)",
                default: false
            }
        },
        required: ["tags"]
    },
    execute: async (params: { tags: string; limit?: number; random?: boolean }) => {
        try {
            // Validate tag count (Danbooru free API allows max 2 tags)
            const tagArray = params.tags.trim().split(/\s+/);
            if (tagArray.length > 2) {
                return `Error: Danbooru's free API allows maximum 2 tags. You provided ${tagArray.length} tags: "${params.tags}". Please use only the 2 most important tags (e.g., character name and "1girl").`;
            }


            const limit = Math.min(params.limit || 1, 20); // Cap at 20 images max
            const useRandom = params.random || false;

            // Build base URL
            let url = `https://danbooru.donmai.us/posts.json?tags=${encodeURIComponent(params.tags)}&limit=${limit}`;

            if (useRandom) {
                // Get post count to calculate proper random page
                try {
                    const countUrl = `https://danbooru.donmai.us/counts/posts.json?tags=${encodeURIComponent(params.tags)}`;
                    Logger.INFO(`Getting post count from: ${countUrl}`);
                    const countResponse = await axios.get(countUrl);
                    const totalPosts = countResponse.data?.counts?.posts || 0;

                    if (totalPosts > 0) {
                        const maxPage = Math.ceil(totalPosts / limit);
                        const randomPage = Math.floor(Math.random() * Math.min(maxPage, 200)) + 1; // Cap at 200 pages for API limit
                        url += `&page=${randomPage}`;
                        Logger.INFO(`Total posts: ${totalPosts}, max pages: ${maxPage}, using random page: ${randomPage}`);
                    } else {
                        Logger.WARN(`No posts found for count, continuing without random page`);
                    }
                } catch (countError: any) {
                    Logger.WARN(`Failed to get post count, using fallback random page: ${countError.message}`);
                    const randomPage = Math.floor(Math.random() * 100) + 1;
                    url += `&page=${randomPage}`;
                }
            }

            Logger.INFO(`Searching Danbooru: ${url}`);
            const response = await axios.get(url);
            const posts = response.data;

            if (!posts || posts.length === 0) {
                return "No images found for the given tags.";
            }

            // If random is requested and we got multiple results, shuffle them
            if (useRandom && posts.length > 1) {
                posts.sort(() => Math.random() - 0.5);
            }

            const results = posts.map((post: any) => {
                return {
                    id: post.id,
                    url: post.file_url || post.large_file_url || post.source,
                    preview_url: post.preview_file_url || post.large_file_url || post.file_url, // Add preview_url
                    rating: post.rating,
                    tags: post.tag_string_character,
                    artist: post.tag_string_artist,
                    source: `https://danbooru.donmai.us/posts/${post.id}`
                };
            });

            // Format as a nice string for the AI
            let output = `Found ${results.length} ${useRandom ? 'random ' : ''}image${results.length > 1 ? 's' : ''} on Danbooru:\n`;
            results.forEach((res: any, index: number) => {
                output += `\n**Image ${index + 1}**\n`;
                output += `🖼️ ${res.url}\n`;
                output += `**Artist**: ${res.artist || 'Unknown'}\n`;
                output += `**Rating**: ${res.rating === 's' ? 'Safe' : res.rating === 'q' ? 'Questionable' : 'Explicit'}\n`;
                output += `**Characters**: ${res.tags || 'None'}\n`;
            });

            output += `\n*Source: Danbooru (${useRandom ? 'Random selection' : 'Recent posts'})*`;
            output += `\n\n[SYSTEM NOTE: The image has been displayed to the user. Do NOT ask if they want to see it. Just describe it briefly or ask if they want another one.]`;

            // Return both output and metadata for frontend display
            return {
                output,
                metadata: {
                    danbooru_images: results
                }
            };
        } catch (error: any) {
            Logger.ERROR(`Danbooru search failed: ${error.message}`);
            return `Error searching Danbooru: ${error.message}`;
        }
    }
};
