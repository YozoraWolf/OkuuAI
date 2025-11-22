import { Logger } from '@src/logger';
import { danbooruTool } from './danbooru';
import { loadAssistantConfig } from '@src/o_utils';
import { searchMemoryWithEmbedding } from '@src/langchain/redis';
import { Core } from '@src/core';

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
                description: "Search through long-term memory for specific information",
                category: 'memory',
                enabled: true,
                parameters: {
                    type: "object",
                    properties: {
                        query: { type: "string", description: "What to search for in memory" },
                        session_specific: { type: "boolean", description: "Search only current session", default: false }
                    },
                    required: ["query"]
                },
                execute: async (params) => this.searchMemory(params)
            });
        }

        // Initialize MCP servers
        this.initializeMCPServers();

        // Register Danbooru tool
        this.registerTool(danbooruTool);
    }

    registerTool(tool: Tool) {
        this.tools.set(tool.name, tool);
        Logger.INFO(`Tool registered: ${tool.name} (${tool.category})`);
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

    async shouldUseTool(userMessage: string): Promise<boolean> {
        if (!this.config.enabled || !this.config.auto_detect) {
            return false;
        }

        // Smart detection patterns
        const patterns = [
            /what.*weather|temperature|climate/i,           // Web search
            /calculate|compute|math|\+|\-|\*|\/|%/i,         // Calculator
            /read.*file|open.*document|show.*content/i,      // File access
            /remember|recall|what did.*say|previous/i        // Memory search
        ];

        return patterns.some(pattern => pattern.test(userMessage));
    }

    getEnabledToolsForPrompt(): string {
        if (!this.config.enabled) {
            return '';
        }

        const enabledTools = Array.from(this.tools.values())
            .filter(tool => tool.enabled)
            .map(tool => `${tool.name}: ${tool.description}`)
            .join('\n');

        if (enabledTools.length === 0) {
            return '';
        }

        return `\n\nAvailable tools:\n${enabledTools}\n\nIMPORTANT: When you need current information (like weather) or need to perform calculations, use the available tools by responding with:\nTOOL_CALL: tool_name({"param": "value"})\n\nFor example:\n- For weather: TOOL_CALL: web_search({"query": "current weather [location]"})\n- For math: TOOL_CALL: calculator({"expression": "15 * 100 / 3"})\n`;
    }

    // Tool implementations
    private async webSearch(params: { query: string; max_results?: number }): Promise<string> {
        try {
            // For weather queries, use Open-Meteo API for real weather data
            if (params.query.toLowerCase().includes('weather') || params.query.toLowerCase().includes('temperature')) {
                // TODO: In the future, we could parse location from the query and use geocoding
                // For now, using default location (Tokyo)
                return await this.getWeatherInfo();
            }


            // For general queries, use DuckDuckGo
            const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(params.query)}&format=json&no_html=1`);
            const data = await response.json();

            let results = [];

            if (data.Answer) {
                results.push(`**Direct Answer**: ${data.Answer}`);
            }

            if (data.Abstract) {
                results.push(`**Summary**: ${data.Abstract}`);
            }

            if (data.Definition) {
                results.push(`**Definition**: ${data.Definition}`);
            }

            if (data.RelatedTopics && data.RelatedTopics.length > 0) {
                const topics = data.RelatedTopics.slice(0, Math.min(params.max_results || 2, 2));
                const topicTexts = topics
                    .filter((topic: any) => topic.Text)
                    .map((topic: any) => `• ${topic.Text}`);
                if (topicTexts.length > 0) {
                    results.push(`**Additional Information**:\n${topicTexts.join('\n')}`);
                }
            }

            // If no results from DuckDuckGo, provide a helpful response
            if (results.length === 0) {
                return `I searched for "${params.query}" but couldn't find specific information from web sources at the moment. You might want to try:

• Being more specific with your search terms
• Checking a specialized website for this topic
• Asking me to search for related terms

*The web search service may be temporarily limited.*`;
            }

            return results.join('\n\n');

        } catch (error) {
            Logger.ERROR(`Web search error: ${error}`);
            return `I encountered an issue while searching for "${params.query}". The search service might be temporarily unavailable. Please try again later or rephrase your query.`;
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

    private async getWeatherInfo(latitude: number = 35.6762, longitude: number = 139.6503): Promise<string> {
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

            return `**Current Weather** (${currentTime}):

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
            let sessionId = "-1"; // Default to global search (all sessions)

            if (params.session_specific) {
                // If session-specific search is requested, try to get current session ID
                if (Core.chat_session && (Core.chat_session as any).sessionId) {
                    sessionId = (Core.chat_session as any).sessionId;
                } else {
                    Logger.WARN('Session-specific search requested but no active session, using global search');
                }
            }

            const memories = await searchMemoryWithEmbedding(params.query, sessionId, 5);

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

        return null;
    }

    async detectProactiveToolUsage(userMessage: string): Promise<{ name: string; parameters: any } | null> {
        if (!this.config.enabled || !this.config.auto_detect) {
            return null;
        }

        // Use the LLM to analyze if the user's request needs tools
        const toolAnalysisPrompt = `You are a tool analysis AI. Your ONLY job is to determine if the user message needs a tool.

Available tools:
${this.getAvailableToolsForAnalysis()}

User message: "${userMessage}"

Rules:
- ONLY respond with the exact format shown below
- Do NOT explain or add extra text
- If the message asks for weather, time, calculations, or memory search, use appropriate tool
- Otherwise respond NO_TOOL_NEEDED

Response format:
TOOL_NEEDED: tool_name
PARAMETERS: {"key": "value"}

OR just:
NO_TOOL_NEEDED

Examples:
- "What time is it?" → TOOL_NEEDED: get_time_info PARAMETERS: {}
- "What's the weather?" → TOOL_NEEDED: web_search PARAMETERS: {"query": "current weather"}
- "Calculate 15% of 200" → TOOL_NEEDED: calculator PARAMETERS: {"expression": "200 * 0.15"}
- "How are you?" → NO_TOOL_NEEDED

Analyze:`;

        try {
            const response = await Core.ollama_instance.generate({
                prompt: toolAnalysisPrompt,
                model: Core.model_name,
                stream: false,
            });

            const analysisResult = response.response.trim();
            Logger.DEBUG(`Tool analysis result: ${analysisResult}`);

            if (analysisResult.includes('NO_TOOL_NEEDED')) {
                return null;
            }

            // Parse the tool call from analysis
            const toolMatch = analysisResult.match(/TOOL_NEEDED:\s*(\w+)/);
            const paramsMatch = analysisResult.match(/PARAMETERS:\s*({.*}|\{\})/);

            if (toolMatch) {
                try {
                    const toolName = toolMatch[1];
                    let parameters = {};

                    // Try to parse parameters if they exist
                    if (paramsMatch) {
                        try {
                            parameters = JSON.parse(paramsMatch[1]);
                        } catch (parseError) {
                            Logger.WARN(`Failed to parse parameters, using empty object: ${parseError}`);
                            parameters = {};
                        }
                    }

                    // Validate the tool exists
                    if (this.tools.has(toolName)) {
                        Logger.INFO(`LLM detected tool usage: ${toolName} with params: ${JSON.stringify(parameters)}`);
                        return { name: toolName, parameters };
                    } else {
                        Logger.WARN(`LLM suggested unknown tool: ${toolName}`);
                    }
                } catch (parseError) {
                    Logger.WARN(`Failed to parse LLM tool analysis: ${parseError}`);
                }
            } else {
                Logger.DEBUG(`No tool needed according to LLM analysis`);
            }

        } catch (error) {
            Logger.ERROR(`Error in LLM tool analysis: ${error}`);
        }

        return null;
    }

    private getAvailableToolsForAnalysis(): string {
        return Array.from(this.tools.values())
            .filter(tool => tool.enabled)
            .map(tool => `- ${tool.name}: ${tool.description}`)
            .join('\n');
    }

    async executeTool(toolCall: { name: string; parameters: any }): Promise<string> {
        const tool = this.tools.get(toolCall.name);
        if (!tool || !tool.enabled) {
            return `Tool ${toolCall.name} is not available.`;
        }

        try {
            Logger.INFO(`Executing tool: ${toolCall.name} with params: ${JSON.stringify(toolCall.parameters)}`);
            const result = await tool.execute(toolCall.parameters);
            return typeof result === 'string' ? result : JSON.stringify(result);
        } catch (error) {
            Logger.ERROR(`Tool execution error: ${error}`);
            return `Tool execution failed: ${error}`;
        }
    }

    // Configuration management
    updateConfig(newConfig: Partial<ToolConfig>) {
        this.config = { ...this.config, ...newConfig };
        Logger.INFO(`Tool configuration updated: ${JSON.stringify(newConfig)}`);

        // Reload tools with new configuration
        this.tools.clear();
        this.registerCoreTools();
    }

    getConfig(): ToolConfig {
        return { ...this.config };
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