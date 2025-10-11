import { Logger } from '@src/logger';
import { Core } from '@src/core';

export interface Tool {
    name: string;
    description: string;
    parameters: {
        type: string;
        properties: Record<string, any>;
        required?: string[];
    };
    execute: (parameters: any) => Promise<any>;
}

export interface ToolCall {
    name: string;
    parameters: any;
}

export class ToolSystem {
    private tools: Map<string, Tool> = new Map();

    constructor() {
        this.registerDefaultTools();
    }

    registerTool(tool: Tool) {
        this.tools.set(tool.name, tool);
        Logger.INFO(`Tool registered: ${tool.name}`);
    }

    private registerDefaultTools() {
        // Web search tool
        this.registerTool({
            name: "web_search",
            description: "Search the web for current information when you don't know something",
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

        // Calculator tool
        this.registerTool({
            name: "calculator",
            description: "Perform mathematical calculations",
            parameters: {
                type: "object",
                properties: {
                    expression: { type: "string", description: "Mathematical expression to evaluate" }
                },
                required: ["expression"]
            },
            execute: async (params) => this.calculate(params)
        });

        // File system tool
        this.registerTool({
            name: "read_file",
            description: "Read contents of a file from storage",
            parameters: {
                type: "object",
                properties: {
                    filename: { type: "string", description: "Name of the file to read" }
                },
                required: ["filename"]
            },
            execute: async (params) => this.readFile(params)
        });

        // Memory search tool
        this.registerTool({
            name: "search_memory",
            description: "Search through long-term memory for specific information",
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

    async webSearch(params: { query: string; max_results?: number }): Promise<string> {
        try {
            // Using DuckDuckGo Instant Answer API (free, no API key needed)
            const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(params.query)}&format=json&no_html=1`);
            const data = await response.json();
            
            let results = [];
            
            if (data.Abstract) {
                results.push(`Summary: ${data.Abstract}`);
            }
            
            if (data.RelatedTopics && data.RelatedTopics.length > 0) {
                const topics = data.RelatedTopics.slice(0, params.max_results || 3);
                topics.forEach((topic: any) => {
                    if (topic.Text) {
                        results.push(`Related: ${topic.Text}`);
                    }
                });
            }
            
            return results.length > 0 ? results.join('\n\n') : 'No specific results found for this query.';
        } catch (error) {
            Logger.ERROR(`Web search error: ${error}`);
            return 'Unable to search the web at the moment.';
        }
    }

    async calculate(params: { expression: string }): Promise<string> {
        try {
            // Simple safe math evaluation (you might want to use a proper math library)
            const sanitized = params.expression.replace(/[^0-9+\-*/.() ]/g, '');
            const result = Function('"use strict"; return (' + sanitized + ')')();
            return `${params.expression} = ${result}`;
        } catch (error) {
            return `Cannot calculate "${params.expression}": Invalid expression`;
        }
    }

    async readFile(params: { filename: string }): Promise<string> {
        try {
            const { loadFileContentFromStorage } = await import('@src/langchain/memory/storage');
            const content = await loadFileContentFromStorage(params.filename);
            return content || 'File not found or could not be read.';
        } catch (error) {
            return `Error reading file: ${error}`;
        }
    }

    async searchMemory(params: { query: string; session_specific?: boolean }): Promise<string> {
        try {
            const { searchMemoryWithEmbedding } = await import('@src/langchain/redis');
            const sessionId = params.session_specific ? parseInt(Core.chat_session.memory.sessionId) : -1;
            const memories = await searchMemoryWithEmbedding(params.query, sessionId, 5);
            
            if (memories.length === 0) {
                return 'No relevant memories found.';
            }
            
            return memories.map((mem: any) => `${mem.user}: ${mem.message}`).join('\n');
        } catch (error) {
            return `Error searching memory: ${error}`;
        }
    }

    getToolsForPrompt(): string {
        const toolDescriptions = Array.from(this.tools.values()).map(tool => 
            `${tool.name}: ${tool.description}`
        ).join('\n');
        
        return `Available tools:\n${toolDescriptions}\n\nTo use a tool, respond with: TOOL_CALL: tool_name(parameters_as_json)`;
    }

    parsePotentialToolCall(text: string): ToolCall | null {
        const toolCallRegex = /TOOL_CALL:\s*(\w+)\s*\((.+)\)/;
        const match = text.match(toolCallRegex);
        
        if (match) {
            try {
                const name = match[1];
                const parameters = JSON.parse(match[2]);
                return { name, parameters };
            } catch (error) {
                Logger.WARN(`Failed to parse tool call: ${error}`);
            }
        }
        
        return null;
    }

    async executeTool(toolCall: ToolCall): Promise<string> {
        const tool = this.tools.get(toolCall.name);
        if (!tool) {
            return `Unknown tool: ${toolCall.name}`;
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

    listTools(): string[] {
        return Array.from(this.tools.keys());
    }
}

export const toolSystem = new ToolSystem();