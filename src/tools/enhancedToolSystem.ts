import { Logger } from '../logger';
import { loadAssistantConfig } from '@src/o_utils';
import { searchMemoryWithEmbedding } from '@src/langchain/redis';
import { Core } from '../core';
import { RedisClientType } from 'redis';
import { tavily } from '@tavily/core';
import * as fs from 'fs';
import * as path from 'path';
import { danbooruTool } from './danbooru';

export interface Source {
    title: string;
    url: string;
}

export interface WebSearchMetadata {
    sources: Source[];
}

export interface WeatherMetadata {
    temperature?: number;
    conditions?: string;
    location?: string;
    [key: string]: any;
}

export interface ToolResult {
    output: string;
    metadata: {
        web_search?: WebSearchMetadata;
        weather?: WeatherMetadata;
        [key: string]: any;
    };
}

export interface ToolConfig {
    enabled: boolean;
    auto_detect: boolean;
    web_search: boolean;
    calculations: boolean;
    memory_search: boolean;
    time_info: boolean;
    mcp_servers: string[];
}

export interface Tool {
    name: string;
    description: string;
    category: 'web' | 'math' | 'memory' | 'time' | 'mcp';
    enabled: boolean;
    parameters: {
        type: string;
        properties: Record<string, any>;
        required?: string[];
    };
    execute: (parameters: any) => Promise<any>;
}

export class EnhancedToolSystem {
    private tools: Map<string, Tool> = new Map();
    private config: ToolConfig = {
        enabled: false,
        auto_detect: false,
        web_search: false,
        calculations: false,
        memory_search: false,
        time_info: false,
        mcp_servers: []
    };

    constructor() {
        this.loadConfig();
        this.registerCoreTools();
    }

    private loadConfig() {
        const assistantConfig = loadAssistantConfig();
        this.config = {
            enabled: true,
            auto_detect: true,
            web_search: true,
            calculations: true,
            memory_search: true,
            time_info: true,
            mcp_servers: [],
            ...assistantConfig.tools
        };
        Logger.INFO(`Tool system loaded with config: ${JSON.stringify(this.config)}`);
    }

    public registerTool(tool: Tool) {
        this.tools.set(tool.name, tool);
        Logger.INFO(`Tool registered: ${tool.name}`);
    }

    private registerCoreTools() {
        if (!this.config.enabled) {
            Logger.INFO('Tools disabled in configuration');
            return;
        }

        // Web search tool
        if (this.config.web_search) {
            this.registerTool({
                name: "web_search",
                description: "Search the web for current information when you don't know something",
                category: 'web',
                enabled: true,
                parameters: {
                    type: "object",
                    properties: {
                        query: { type: "string", description: "Search query" },
                        max_results: { type: "number", description: "Maximum number of results", default: 3 }
                    },
                    required: ["query"]
                },
                execute: async (params) => this.webSearch(params)
            });
        }

        // Calculator tool
        if (this.config.calculations) {
            this.registerTool({
                name: "calculator",
                description: "Perform mathematical calculations",
                category: 'math',
                enabled: true,
                parameters: {
                    type: "object",
                    properties: {
                        expression: { type: "string", description: "Mathematical expression to evaluate" }
                    },
                    required: ["expression"]
                },
                execute: async (params) => this.calculate(params)
            });
        }

        // Time/Date information tool
        if (this.config.time_info) {
            this.registerTool({
                name: "get_time_info",
                description: "Get current time, date, and timezone information",
                category: 'time',
                enabled: true,
                parameters: {
                    type: "object",
                    properties: {
                        format: { type: "string", description: "Time format preference", default: "standard" }
                    },
                    required: []
                },
                execute: async (params) => this.getTimeInfo(params)
            });
        }

        // Memory search tool
        if (this.config.memory_search) {
            this.registerTool({
                name: "search_memory",
                description: "Search through past conversations and memories",
                category: "memory",
                enabled: true,
                parameters: {
                    type: "object",
                    properties: {
                        query: { type: "string", description: "What to search for" },
                        session_specific: { type: "boolean", description: "Whether to search only current session" }
                    },
                    required: ["query"]
                },
                execute: async (params) => this.searchMemory(params)
            });
        }


        // Initialize MCP servers
        this.initializeMCPServers();


        // Danbooru tools - RE-ENABLED
        // Register Danbooru tag lookup
        this.registerTool({
            name: "danbooru_tag_lookup",
            description: "Check if a tag exists on Danbooru and get the number of images available. Use this BEFORE offering image search options to the user.",
            category: 'web',
            enabled: true,
            parameters: {
                type: "object",
                properties: {
                    tag: {
                        type: "string",
                        description: "Tag to look up (e.g., 'hatsune_miku', 'touhou', 'hakurei_reimu')"
                    }
                },
                required: ["tag"]
            },
            execute: async (params: { tag: string }) => {
                const { lookupDanbooruTag } = await import('./danbooru');
                const result = await lookupDanbooruTag(params.tag);

                if (result.exists) {
                    // Return neutral factual data
                    return `Danbooru tag found: "${result.tagString}" (${result.count.toLocaleString()} images available)`;
                } else {
                    // Tag not found - just state the fact
                    return `Danbooru tag "${params.tag}" not found`;
                }
            }
        });

        // Register Danbooru tag validation tool (smart multi-tag processing)
        this.registerTool({
            name: "danbooru_validate_tags",
            description: "Intelligently validate tags and search Danbooru for images. Deduplicates overlapping tags. Returns images directly. Infer 'limit' from user input (e.g., '5 images' → limit: 5).",
            category: 'web',
            enabled: true,
            parameters: {
                type: "object",
                properties: {
                    input: {
                        type: "string",
                        description: "Space-separated tag words to validate (e.g., 'reimu hakurei smiling')"
                    },
                    limit: {
                        type: "number",
                        description: "Number of images to return (default 5, max 20)",
                        default: 5
                    },
                    random: {
                        type: "boolean",
                        description: "If true, get random images (default true)",
                        default: true
                    }
                },
                required: ["input"]
            },
            execute: async (params: { input: string; limit?: number; random?: boolean }) => {
                const { validateAndCombineTags } = await import('./danbooru');
                const result = await validateAndCombineTags(params.input, 2);

                if (result.validatedTags.length === 0) {
                    return `No valid Danbooru tags found in "${params.input}". Consider using web_search instead.`;
                }

                // Automatically search with validated tags
                const danbooruSearch = this.tools.get('danbooru_search');
                if (danbooruSearch) {
                    const searchResult = await danbooruSearch.execute({
                        tags: result.tags,
                        limit: params.limit || 5,
                        random: params.random !== false
                    });

                    return searchResult;
                }

                return `Validated tags: "${result.tags}" but danbooru_search is not available`;
            }
        });

        // Register Danbooru search tool
        this.registerTool(danbooruTool);

    }

    public setConfig(config: ToolConfig) {
        this.config = config;
    }

    public getConfig(): ToolConfig {
        return this.config;
    }

    public getEnabledToolsForPrompt(): string {
        const tools = [
            {
                name: 'web_search',
                description: 'Search the internet for current information (news, weather, facts). Params: {"query": "search term", "location": "optional location for weather"}',
                enabled: this.config.web_search
            },
            {
                name: 'calculator',
                description: 'Perform mathematical calculations. Params: {"expression": "math expression"}',
                enabled: this.config.calculations
            },
            {
                name: 'get_time_info',
                description: 'Get current time and date information. No params.',
                enabled: this.config.time_info
            },
            {
                name: 'search_memory',
                description: 'Search long-term memory for past conversations. Params: {"query": "search term"}',
                enabled: this.config.memory_search
            },
            {
                name: 'danbooru_validate_tags',
                description: 'Validate and combine multiple tag words for Danbooru. Deduplicates overlapping tags. Params: {"input": "reimu hakurei smiling", "maxTags": 2}',
                enabled: true
            },
            {
                name: 'danbooru_search',
                description: 'Search for anime-style images on Danbooru. MAX 2 TAGS ONLY. Params: {"tags": "tag1 tag2", "limit": number, "random": true/false}',
                enabled: true
            },
            {
                name: 'danbooru_tag_lookup',
                description: 'Check if a Danbooru tag exists and image count. Use BEFORE danbooru_search. Params: {"tag": "tag_name"}',
                enabled: true
            }
        ];

        const enabledTools = tools
            .filter(tool => tool.enabled)
            .map(tool => `${tool.name}: ${tool.description}`)
            .join('\n');

        if (enabledTools.length === 0) {
            return '';
        }

        return `\n\nAvailable tools:\n${enabledTools}\n\nIMPORTANT: When you need current information (like weather) or need to perform calculations, use the available tools by responding with:\nTOOL_CALL: tool_name({"param": "value"})\n\nFor example:\n- For weather: TOOL_CALL: web_search({"query": "current weather [location]"})\n- For math: TOOL_CALL: calculator({"expression": "15 * 100 / 3"})\n`;
    }

    private async initializeMCPServers() {
        if (this.config.mcp_servers.length === 0) {
            Logger.INFO('No MCP servers configured');
            return;
        }

        for (const serverUrl of this.config.mcp_servers) {
            try {
                await this.connectMCPServer(serverUrl);
            } catch (error) {
                Logger.ERROR(`Failed to connect to MCP server ${serverUrl}: ${error}`);
            }
        }
    }

    private async connectMCPServer(serverUrl: string) {
        Logger.INFO(`Connecting to MCP server: ${serverUrl}`);
        // TODO: Implement MCP client connection
        // This would connect to MCP servers and register their tools dynamically
        // For now, this is a placeholder for future MCP integration
    }

    // Tool implementations

    async executeTool(toolCall: { name: string; parameters: any }): Promise<ToolResult> {
        if (!this.config.enabled) {
            return { output: "Tool system is disabled.", metadata: {} };
        }

        try {
            // Check if tool exists in registry
            const tool = this.tools.get(toolCall.name);
            if (tool) {
                try {
                    const result = await tool.execute(toolCall.parameters);

                    // Handle both direct string returns and ToolResult objects
                    if (typeof result === 'object' && result !== null && 'output' in result) {
                        return result as ToolResult;
                    }

                    return { output: String(result), metadata: {} };
                } catch (error) {
                    Logger.ERROR(`Error executing tool ${toolCall.name}: ${error}`);
                    return { output: `Error executing tool: ${error}`, metadata: {} };
                }
            }

            // Unknown tool fallback
            return { output: `Unknown tool: ${toolCall.name}`, metadata: {} };
        } catch (error) {
            Logger.ERROR(`Error executing tool ${toolCall.name}: ${error}`);
            return { output: `Error executing tool: ${error}`, metadata: {} };
        }
    }

    private async webSearch(params: { query: string; location?: string; max_results?: number }): Promise<ToolResult> {
        const maxResults = params.max_results || 5;
        const isImageSearch = params.query.toLowerCase().includes('images') || params.query.toLowerCase().includes('picture') || params.query.toLowerCase().includes('photo');

        // Try Tavily first if API key is available
        const tavilyApiKey = process.env.TAVILY_API_KEY;
        if (tavilyApiKey) {
            try {
                Logger.INFO(`Using Tavily for search: "${params.query}"`);
                const tvly = tavily({ apiKey: tavilyApiKey });

                const searchOptions: any = {
                    maxResults,
                    searchDepth: 'basic',
                    includeAnswer: true,
                    includeRawContent: false
                };

                // For image searches, try to get image results
                if (isImageSearch) {
                    Logger.INFO(`[ImageSearch] Detected image search, setting includeImages=true for query: "${params.query}"`);
                    searchOptions.includeImages = true;
                } else {
                    Logger.DEBUG(`[ImageSearch] Not an image search query: "${params.query}"`);
                }

                const response = await tvly.search(params.query, searchOptions);

                const sources: Source[] = [];
                const imageUrls: string[] = [];
                let output = '';

                // Extract images if available
                if (response.images && response.images.length > 0) {
                    Logger.INFO(`[ImageSearch] Tavily returned ${response.images.length} images`);
                    // Extract URLs from TavilyImage objects
                    const extractedUrls = response.images.map((img: any) => typeof img === 'string' ? img : img.url).filter(Boolean);
                    Logger.INFO(`[ImageSearch] Successfully extracted ${extractedUrls.length} image URLs`);
                    imageUrls.push(...extractedUrls.slice(0, 10)); // Take up to 10 images
                    output += `**Found ${extractedUrls.length} images:**\n\n`;
                    extractedUrls.slice(0, 3).forEach((url: string, i: number) => {
                        output += `${i + 1}. ${url}\n`;
                    });
                    if (extractedUrls.length > 3) {
                        output += `\n...and ${extractedUrls.length - 3} more images.\n\n`;
                    }
                } else {
                    Logger.WARN(`[ImageSearch] Tavily did not return any images (response.images: ${response.images ? 'empty array' : 'undefined'})`);
                }

                // Add the AI-generated answer if available
                if (response.answer && !isImageSearch) {
                    output += `${response.answer}\n\n`;
                }

                // Add search results
                if (response.results && response.results.length > 0) {
                    if (!isImageSearch || imageUrls.length === 0) {
                        output += `**Sources:**\n\n`;
                    }
                    response.results.forEach((result: any, index: number) => {
                        sources.push({
                            title: result.title || `Result ${index + 1}`,
                            url: result.url
                        });
                        if (!isImageSearch || imageUrls.length === 0) {
                            output += `${index + 1}. **${result.title}**\n   ${result.content}\n   Source: ${result.url}\n\n`;
                        }
                    });
                } else if (!response.answer && imageUrls.length === 0) {
                    output = `I searched for "${params.query}" using Tavily but couldn't find any specific results.`;
                }

                // For image searches, provide guidance
                if (isImageSearch && imageUrls.length === 0) {
                    output += `\n[SYSTEM NOTE: Images were requested but direct image URLs were not available from the search. The user can visit the source URLs above to view images.]`;
                } else if (isImageSearch && imageUrls.length > 0) {
                    output += `\n[SYSTEM NOTE: Image search results have been provided. You MUST acknowledge these results and inform the user that images are available. Presenting search results is NOT a policy violation.]`;
                }

                return {
                    output,
                    metadata: {
                        web_search: { sources },
                        image_urls: imageUrls.length > 0 ? imageUrls : undefined
                    }
                };
            } catch (tavilyError) {
                Logger.WARN(`Tavily search failed, falling back to DuckDuckGo: ${tavilyError}`);
            }
        } else {
            Logger.INFO('TAVILY_API_KEY not found, using DuckDuckGo');
        }

        // Fallback to DuckDuckGo HTML scraping
        try {
            const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(params.query)}`;

            const response = await fetch(searchUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });

            if (!response.ok) {
                throw new Error(`Search failed with status ${response.status}`);
            }

            const html = await response.text();
            const sources: Source[] = [];
            let output = '';

            // Parse search results from HTML
            const resultRegex = /<div class="result[^"]*"[^>]*>[\s\S]*?<a class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;

            let match;
            let count = 0;

            while ((match = resultRegex.exec(html)) !== null && count < maxResults) {
                const url = match[1];
                const titleHtml = match[2];
                const snippetHtml = match[3];

                // Clean HTML tags and entities
                const title = titleHtml
                    .replace(/<[^>]+>/g, '')
                    .replace(/&amp;/g, '&')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&quot;/g, '"')
                    .replace(/&#39;/g, "'")
                    .trim();

                const snippet = snippetHtml
                    .replace(/<[^>]+>/g, '')
                    .replace(/&amp;/g, '&')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&quot;/g, '"')
                    .replace(/&#39;/g, "'")
                    .trim();

                if (title && url) {
                    sources.push({ title, url });
                    output += `${count + 1}. **${title}**\n   ${snippet}\n   Source: ${url}\n\n`;
                    count++;
                }
            }

            if (sources.length === 0) {
                output = `I searched for "${params.query}" but couldn't find any specific results. This might be due to:\n- The query being too specific or niche\n- A temporary issue with the search service\n- The content not being indexed\n\nTry rephrasing your query or being more general.`;
            }

            return {
                output,
                metadata: {
                    web_search: { sources }
                }
            };
        } catch (error) {
            Logger.ERROR(`Web search error: ${error}`);
            return {
                output: `I encountered an issue while searching for "${params.query}". The search service might be temporarily unavailable. Please try again later or rephrase your query.`,
                metadata: { web_search: { sources: [] } }
            };
        }
    }

    private async calculate(params: { expression: string }): Promise<string> {
        try {
            // Simple safe math evaluation - consider using a proper math library like math.js
            const sanitized = params.expression.replace(/[^0-9+\-*/.() ]/g, '');
            const result = Function('"use strict"; return (' + sanitized + ')')();
            return `${params.expression} = ${result}`;
        } catch (error) {
            return `Cannot calculate "${params.expression}": Invalid expression`;
        }
    }

    private async geocodeLocation(location: string): Promise<{ latitude: number; longitude: number } | null> {
        try {
            const response = await fetch(
                `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`
            );
            const data = await response.json();

            if (data.results && data.results.length > 0) {
                const result = data.results[0];
                Logger.INFO(`Geocoded "${location}" to ${result.name}, ${result.country} (${result.latitude}, ${result.longitude})`);
                return {
                    latitude: result.latitude,
                    longitude: result.longitude
                };
            }

            Logger.WARN(`Could not geocode location: "${location}"`);
            return null;
        } catch (error) {
            Logger.ERROR(`Geocoding error: ${error}`);
            return null;
        }
    }

    private async getWeatherInfo(latitude: number = 35.6762, longitude: number = 139.6503, locationName?: string): Promise<string> {
        try {
            // Default to Tokyo coordinates if not specified
            // Using Open-Meteo API - free, no API key required
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,snowfall,weather_code,cloud_cover,pressure_msl,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m&timezone=auto`;

            const response = await fetch(url);
            const data = await response.json();

            if (!data.current) {
                return 'Unable to fetch weather information at the moment. Please try again later.';
            }

            const current = data.current;
            const timezone = data.timezone || 'Unknown';

            // Map weather codes to descriptions
            const weatherDescriptions: { [key: number]: string } = {
                0: '☀️ Clear sky',
                1: '🌤️ Mainly clear',
                2: '⛅ Partly cloudy',
                3: '☁️ Overcast',
                45: '🌫️ Foggy',
                48: '🌫️ Depositing rime fog',
                51: '🌦️ Light drizzle',
                53: '🌦️ Moderate drizzle',
                55: '🌧️ Dense drizzle',
                61: '🌦️ Slight rain',
                63: '🌧️ Moderate rain',
                65: '🌧️ Heavy rain',
                71: '🌨️ Slight snow',
                73: '🌨️ Moderate snow',
                75: '❄️ Heavy snow',
                80: '🌦️ Slight rain showers',
                81: '🌧️ Moderate rain showers',
                82: '⛈️ Violent rain showers',
                95: '⛈️ Thunderstorm',
                96: '⛈️ Thunderstorm with slight hail',
                99: '⛈️ Thunderstorm with heavy hail'
            };

            const weatherDescription = weatherDescriptions[current.weather_code] || '🌤️ Variable conditions';
            const temperature = Math.round(current.temperature_2m);
            const feelsLike = Math.round(current.apparent_temperature);
            const humidity = current.relative_humidity_2m;
            const windSpeed = Math.round(current.wind_speed_10m);
            const windDirection = current.wind_direction_10m;
            const pressure = Math.round(current.pressure_msl);
            const cloudCover = current.cloud_cover;

            // Convert wind direction to compass
            const getWindDirection = (degrees: number) => {
                const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
                return directions[Math.round(degrees / 22.5) % 16];
            };

            const currentTime = new Date().toLocaleString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                timeZone: timezone
            });

            const locationDisplay = locationName || `${latitude.toFixed(2)}°N, ${longitude.toFixed(2)}°E`;

            return `**Current Weather in ${locationDisplay}** (${currentTime}):

${weatherDescription} **${temperature}°C** (feels like ${feelsLike}°C)

💧 **Humidity**: ${humidity}%
💨 **Wind**: ${windSpeed} km/h ${getWindDirection(windDirection)}
🌀 **Pressure**: ${pressure} hPa
☁️ **Cloud Cover**: ${cloudCover}%

📍 **Location**: ${latitude.toFixed(2)}°N, ${longitude.toFixed(2)}°E
⏰ **Timezone**: ${timezone}

*Real-time data from Open-Meteo.com - Open-source weather API*`;

        } catch (error) {
            Logger.ERROR(`Weather API error: ${error}`);
            return 'Unable to fetch current weather information. The weather service might be temporarily unavailable.';
        }
    }

    private async getTimeInfo(params: { format?: string }): Promise<string> {
        try {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            const dateStr = now.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

            return `⏰ **Current Time**: ${timeStr}
📅 **Current Date**: ${dateStr}
🌍 **Timezone**: ${timezone}

*Accurate as of the moment you asked*`;
        } catch (error) {
            return `Error getting time information: ${error}`;
        }
    }

    private async searchMemory(params: { query: string; session_specific?: boolean }): Promise<string> {
        try {
            // Handle session-specific vs global search safely
            let sessionId = -1; // Default to global search (all sessions)

            if (params.session_specific) {
                // If session-specific search is requested, try to get current session ID
                if (Core.chat_session && (Core.chat_session as any).sessionId) {
                    sessionId = (Core.chat_session as any).sessionId;
                } else {
                    Logger.WARN('Session-specific search requested but no active session, using global search');
                }
            }

            const memories = await searchMemoryWithEmbedding(params.query, String(sessionId), 5);

            if (memories.length === 0) {
                return 'No relevant memories found.';
            }

            return memories.map((mem: any) => `${mem.user}: ${mem.message}`).join('\n');
        } catch (error) {
            return `Error searching memory: ${error}`;
        }
    }

    // Tool execution
    parsePotentialToolCall(text: string): { name: string; parameters: any } | null {
        // First try exact format: TOOL_CALL: tool_name({"param": "value"})
        const exactRegex = /TOOL_CALL:\s*(\w+)\s*\((.+)\)/s;
        const exactMatch = text.match(exactRegex);

        if (exactMatch) {
            try {
                const name = exactMatch[1];
                const parameters = JSON.parse(exactMatch[2]);
                return { name, parameters };
            } catch (error) {
                Logger.WARN(`Failed to parse exact tool call: ${error}`);
            }
        }

        // If no exact match found, the AI didn't use the proper format
        Logger.DEBUG('No exact tool call format found in AI response');
        return null;
    }

    async detectProactiveToolUsage(userMessage: string, history: any[] = []): Promise<{ name: string; parameters: any } | null> {
        if (!this.config.enabled || !this.config.auto_detect) {
            return null;
        }

        // Get context from history (last 5 messages)
        let context = "";
        if (history.length > 0) {
            context = "Conversation History (most recent last):\n";
            // Take the last 5 messages to provide sufficient context
            const recentMsgs = history.slice(-5);

            // Find the index of the last assistant message
            let lastAssistantIdx = -1;
            for (let i = recentMsgs.length - 1; i >= 0; i--) {
                const user = recentMsgs[i].user.toLowerCase();
                if (user === 'okuu' || user === 'assistant') {
                    lastAssistantIdx = i;
                    break;
                }
            }

            for (let i = 0; i < recentMsgs.length; i++) {
                const msg = recentMsgs[i];
                // Fix: Check if user is 'Okuu' or 'okuu' (case-insensitive) or 'assistant'
                const userLower = msg.user.toLowerCase();
                const role = (userLower === 'okuu' || userLower === 'assistant') ? 'Assistant' : 'User';

                Logger.DEBUG(`[ToolCheck] msg.user="${msg.user}" -> role="${role}"`);

                // For the last ASSISTANT message, use a higher character limit AND mark it as most recent
                const isLastAssistant = (i === lastAssistantIdx);
                const charLimit = isLastAssistant ? 500 : 200;
                const content = msg.message.length > charLimit ? msg.message.substring(0, charLimit) + "..." : msg.message;
                const label = isLastAssistant ? "[MOST RECENT ASSISTANT MESSAGE]" : "";
                context += `${role}${label}: "${content}"\n`;
            }
            context += "\n";
        }

        // Context Injection Strategy:
        // If the user message is short (likely a confirmation), append the last assistant message directly
        // to the user message in the prompt. This forces the LLM to pay attention to it.
        let promptUserMessage = userMessage;
        let lastAssistantMsgContent = "";

        if (history.length > 0) {
            // Find the last assistant message
            for (let i = history.length - 1; i >= 0; i--) {
                const user = history[i].user.toLowerCase();
                if (user === 'okuu' || user === 'assistant') {
                    lastAssistantMsgContent = history[i].message;
                    break;
                }
            }
        }

        // If message is short (< 50 chars) and we have a previous assistant message, inject it
        if (userMessage.length < 50 && lastAssistantMsgContent) {
            // Truncate assistant message to 200 chars for the injection
            const truncatedContext = lastAssistantMsgContent.length > 200 ? lastAssistantMsgContent.substring(0, 200) + "..." : lastAssistantMsgContent;
            promptUserMessage = `${userMessage} (in response to Assistant: "${truncatedContext}")`;
            Logger.DEBUG(`[ToolCheck] Injected context into prompt: "${promptUserMessage}"`);
        }

        // Load tool analysis prompt from file
        const promptPath = path.join(__dirname, '../prompts/tool_agent.txt');
        let toolAnalysisPrompt = '';

        try {
            toolAnalysisPrompt = fs.readFileSync(promptPath, 'utf-8');

            // Replace template variables
            toolAnalysisPrompt = toolAnalysisPrompt
                .replace('{{TOOLS_LIST}}', this.getEnabledToolsForPrompt())
                .replace('{{CONTEXT}}', context)
                .replace('{{USER_MESSAGE}}', promptUserMessage);

        } catch (error) {
            Logger.ERROR(`Failed to load tool agent prompt from ${promptPath}: ${error}`);
            // Fallback to basic prompt if file loading fails
            toolAnalysisPrompt = `You are a tool selection agent. Analyze the user message and respond with JSON indicating which tool to use, if any.
            
Available tools: ${this.getEnabledToolsForPrompt()}
${context}
User message: "${promptUserMessage}"

Response:`;
        }

        Logger.DEBUG(`[ToolCheck] Prompt:\n${toolAnalysisPrompt}`);

        try {
            Logger.INFO(`[ToolCheck] Analyzing message with ${Core.tool_model_name}: "${promptUserMessage.substring(0, 50)}..."`);
            const response = await Core.ollama_instance.generate({
                prompt: toolAnalysisPrompt,
                model: Core.tool_model_name, // Use the configured tool model
                stream: false,
                format: "json" // Enforce JSON output
            });

            const analysisResult = response.response.trim();
            Logger.DEBUG(`[ToolCheck] Raw Qwen2.5 response: ${analysisResult}`);

            try {
                const result = JSON.parse(analysisResult);

                // Validate that we have a proper query parameter for web_search
                if (result.tool === 'web_search' && result.parameters) {
                    const query = result.parameters.query;

                    // Check if query is invalid (undefined, malformed, or just brackets/symbols)
                    if (!query || typeof query !== 'string' || query.trim().length === 0 || /^[\[\]:\s]+$/.test(query)) {
                        Logger.WARN(`[ToolCheck] Invalid query detected: "${query}". LM failed to extract proper topic.`);
                        // Don't use tool if we can't get a valid query - let normal flow handle it
                        return null;
                    }
                }

                if (result.tool && this.tools.has(result.tool)) {
                    Logger.INFO(`[ToolCheck] SUCCESS: Qwen2.5 selected tool '${result.tool}' with params: ${JSON.stringify(result.parameters)}`);
                    Logger.DEBUG(`[ToolCheck] Reasoning: ${result.reasoning}`);
                    return { name: result.tool, parameters: result.parameters || {} };
                } else {
                    Logger.INFO(`[ToolCheck] NO TOOL: Qwen2.5 decided no tool is needed. Reasoning: ${result.reasoning}`);
                }
            } catch (parseError) {
                Logger.WARN(`[ToolCheck] PARSE ERROR: Could not parse Qwen2.5 JSON. Falling back to standard flow. Error: ${parseError}`);
            }

        } catch (error) {
            Logger.ERROR(`[ToolCheck] ERROR: Qwen2.5 generation failed. Falling back to standard flow. Error: ${error}`);
        }

        return null;
    }


    // Kept as fallback
    async shouldUseTool(userMessage: string): Promise<boolean> {
        if (!this.config.enabled || !this.config.auto_detect) {
            return false;
        }

        // Smart detection patterns (Multi-language support: EN, ES, FR, JP)
        const patterns = [
            // Web search: weather, temperature, climate
            /what.*weather|temperature|climate/i,                                            // EN
            /qué.*tiempo|clima|temperatura/i,                                                // ES
            /quel.*temps|météo|climat|température/i,                                         // FR
            /天気|気温|気候/i,                                                               // JP

            // Calculator: math operations
            /calculate|compute|math|\+|\-|\*|\/|%/i,                                         // EN
            /calcular|cuenta|matemáticas/i,                                                  // ES
            /calculer|math/i,                                                                // FR
            /計算|足す|引く|掛ける|割る|たす|ひく|かける|わる/i,                                  // JP

            // File access: read/open files
            /read.*file|open.*document|show.*content/i,                                      // EN
            /leer.*archivo|abrir.*documento|mostrar.*contenido/i,                            // ES
            /lire.*fichier|ouvrir.*document|montrer.*contenu/i,                              // FR
            /ファイル.*(読む|開く|見せ)/i,                                                    // JP

            // Memory search: remember, recall
            /remember|recall|what did.*say|previous/i,                                       // EN
            /recuerda|memoria|qué dije|anterior/i,                                           // ES
            /rappelle|mémoire|qu'est-ce que j'ai dit|précédent/i,                            // FR
            /覚え|思い出し|前に(言った|言ってた)/i                                              // JP
        ];

        return patterns.some(pattern => pattern.test(userMessage));
    }



    // Configuration management
    updateConfig(newConfig: Partial<ToolConfig>) {
        this.config = { ...this.config, ...newConfig };
        Logger.INFO(`Tool configuration updated: ${JSON.stringify(newConfig)}`);

        // Reload tools with new configuration
        this.tools.clear();
        this.registerCoreTools();
    }


    listAvailableTools(): Array<{ name: string, description: string, category: string, enabled: boolean }> {
        return Array.from(this.tools.values()).map(tool => ({
            name: tool.name,
            description: tool.description,
            category: tool.category,
            enabled: tool.enabled
        }));
    }
}

export const enhancedToolSystem = new EnhancedToolSystem();