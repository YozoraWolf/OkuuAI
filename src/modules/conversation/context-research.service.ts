import { createHash } from 'crypto';
import { redisClientMemory } from '../../langchain/redis';
import { Logger } from '../../logger';
import { enhancedToolSystem, type ToolResult } from '../../tools/enhancedToolSystem';
import type { ConversationResearchContext } from './conversation.events';

export type ResearchSignal = {
    topic?: string;
    confidence?: number;
    depth?: 'simple' | 'concrete';
    focus?: 'overview' | 'gameplay' | 'mechanics' | 'characters' | 'items' | 'builds' | 'quests' | 'troubleshooting';
    observation: string;
};

export interface ConversationResearchProvider {
    get(userId: string, sessionId: string): ConversationResearchContext | undefined;
    observe(userId: string, sessionId: string, signal: ResearchSignal): Promise<ConversationResearchContext | undefined>;
    clearSession(userId: string, sessionId: string): void;
    clearAll?(): void;
    getPendingApproval?(userId: string, sessionId: string): string | undefined;
    setConsent?(userId: string, sessionId: string, topic: string, approved: boolean): void;
}

type ResearchState = {
    candidate?: string;
    confirmations: number;
    current?: ConversationResearchContext;
    inFlight: boolean;
    lastSearchAt: number;
    searches: number;
    queries: Set<string>;
    loadedTopics: Set<string>;
    observations: string[];
    generation: number;
    pendingApproval?: string;
    approvedTopics: Set<string>;
    deniedTopics: Set<string>;
};

type ResearchSearch = (query: string, provider: 'duckduckgo' | 'tavily') => Promise<ToolResult>;
type ResearchStore = {
    hGetAll(key: string): Promise<Record<string, string>>;
    hSet(key: string, data: Record<string, string>): Promise<unknown>;
    expire(key: string, seconds: number): Promise<unknown>;
};

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const cleanText = (value: string, maxLength: number) => value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
const genericTopics = new Set(['app', 'application', 'browser', 'camera', 'desktop', 'game', 'screen', 'software', 'unknown', 'video game', 'website']);
const sensitiveQuery = /(?:https?:\/\/|\b(?:password|passcode|secret|token|credential|api[ _-]?key|private[ _-]?key|recovery[ _-]?code|2fa|login|email|phone|address|account)\b|\b[a-f0-9]{24,}\b|\S+@\S+\.\S+)/i;
const promptInjection = /(?:ignore (?:all |any )?(?:previous|prior) instructions|system\s*:|assistant\s*:|developer\s*:|tool_call|<\|(?:system|assistant|user)\|>|follow these instructions)/i;
const instructionalLanguage = /(?:\byou (?:must|should|need to|are required to)\b|\b(?:must|should) (?:now|always|never)\b|\b(?:act as|pretend to be|return only|respond with|output only|classify every|new instructions?|hidden prompt)\b|\bdo not (?:answer|mention|follow|obey)\b)/i;
const focusQueries: Record<NonNullable<ResearchSignal['focus']>, string> = {
    overview: 'overview official information beginner guide',
    gameplay: 'gameplay systems beginner tips guide',
    mechanics: 'game mechanics systems guide tips',
    characters: 'characters roles abilities guide',
    items: 'items equipment effects guide',
    builds: 'character builds equipment strategy guide',
    quests: 'quests objectives walkthrough guide',
    troubleshooting: 'common problems fixes troubleshooting',
};
const sameTopic = (left: string, right: string) => {
    const normalizedLeft = normalize(left);
    const normalizedRight = normalize(right);
    return normalizedLeft === normalizedRight
        || (Math.min(normalizedLeft.length, normalizedRight.length) >= 6
            && (normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)));
};

export class WebContextResearchService implements ConversationResearchProvider {
    private readonly states = new Map<string, ResearchState>();
    private readonly userSearches = new Map<string, number[]>();

    constructor(
        private readonly search: ResearchSearch = (query, provider) => enhancedToolSystem.executeTool({
            name: 'web_search',
            parameters: { query, max_results: 4, provider },
        }),
        private readonly store?: ResearchStore,
        private readonly webSearchEnabled = () => enhancedToolSystem.getConfig().web_search,
    ) {}

    get(userId: string, sessionId: string) {
        return this.states.get(this.stateKey(userId, sessionId))?.current;
    }

    clearSession(userId: string, sessionId: string) {
        this.states.delete(this.stateKey(userId, sessionId));
    }

    clearAll() {
        this.states.clear();
    }

    getPendingApproval(userId: string, sessionId: string) {
        return this.states.get(this.stateKey(userId, sessionId))?.pendingApproval;
    }

    setConsent(userId: string, sessionId: string, topic: string, approved: boolean) {
        const state = this.getState(userId, sessionId);
        const normalizedTopic = normalize(cleanText(topic, 120));
        if (!normalizedTopic || !sameTopic(state.candidate || '', topic)) return;
        state.pendingApproval = undefined;
        if (approved) {
            state.approvedTopics.add(normalizedTopic);
            state.deniedTopics.delete(normalizedTopic);
        } else {
            state.deniedTopics.add(normalizedTopic);
            state.approvedTopics.delete(normalizedTopic);
        }
    }

    async observe(userId: string, sessionId: string, signal: ResearchSignal) {
        if ((process.env.CONVERSATION_RESEARCH_ENABLED || 'true').toLowerCase() !== 'true') return undefined;
        if (!this.webSearchEnabled()) return undefined;

        const topic = cleanText(signal.topic || '', 120);
        const normalizedTopic = normalize(topic);
        const confidence = Math.max(0, Math.min(1, Number(signal.confidence) || 0));
        if (
            !normalizedTopic
            || genericTopics.has(normalizedTopic)
            || sensitiveQuery.test(topic)
            || promptInjection.test(topic)
            || normalizedTopic.split(' ').length > 10
            || confidence < Number(process.env.CONVERSATION_RESEARCH_MIN_CONFIDENCE || 0.65)
        ) {
            return this.get(userId, sessionId);
        }

        const state = this.getState(userId, sessionId);
        if (sameTopic(state.candidate || '', topic)) state.confirmations += 1;
        else {
            state.candidate = topic;
            state.confirmations = 1;
            state.generation += 1;
            state.observations = [];
            state.loadedTopics.clear();
            state.pendingApproval = undefined;
            if (state.current && !sameTopic(state.current.topic, topic)) {
                state.current = undefined;
                state.lastSearchAt = 0;
                state.queries.clear();
            }
        }
        if (!state.observations.includes(signal.observation)) state.observations.push(cleanText(signal.observation, 400));
        if (state.observations.length > 8) state.observations.shift();

        const requiredConfirmations = Number(process.env.CONVERSATION_RESEARCH_CONFIRMATIONS || 2);
        if (state.confirmations < requiredConfirmations) return state.current;
        const stableTopic = state.candidate || topic;
        const normalizedStableTopic = normalize(stableTopic);

        if (!state.loadedTopics.has(normalizedStableTopic)) {
            state.loadedTopics.add(normalizedStableTopic);
            const generationBeforeLoad = state.generation;
            const persisted = await this.load(userId, sessionId, stableTopic);
            if (this.states.get(this.stateKey(userId, sessionId)) !== state || state.generation !== generationBeforeLoad) {
                return this.get(userId, sessionId);
            }
            if (persisted) {
                state.current = persisted.context;
                state.approvedTopics.add(normalizedStableTopic);
                persisted.queries.forEach(query => state.queries.add(query));
                state.lastSearchAt = persisted.context.updatedAt;
            }
        }

        if (state.deniedTopics.has(normalizedStableTopic)) return state.current;
        if (!state.approvedTopics.has(normalizedStableTopic)) {
            state.pendingApproval = stableTopic;
            return state.current;
        }
        state.pendingApproval = undefined;

        const focus = signal.focus && focusQueries[signal.focus] ? signal.focus : 'overview';
        const query = `${stableTopic} ${focusQueries[focus]}`;
        const normalizedQuery = normalize(query);
        const refreshMs = Number(process.env.CONVERSATION_RESEARCH_REFRESH_MS || 180000);
        const maxSearches = Number(process.env.CONVERSATION_RESEARCH_MAX_SEARCHES || 4);
        if (
            state.inFlight
            || state.searches >= maxSearches
            || state.queries.has(normalizedQuery)
            || (state.current && Date.now() - state.lastSearchAt < refreshMs)
            || !this.reserveUserSearch(userId)
        ) return state.current;

        state.inFlight = true;
        state.queries.add(normalizedQuery);
        state.searches += 1;
        state.lastSearchAt = Date.now();
        const generation = state.generation;
        const stateKey = this.stateKey(userId, sessionId);
        const concreteAllowed = signal.depth === 'concrete'
            && Boolean(state.current)
            && state.confirmations >= 3
            && ['items', 'builds', 'quests', 'troubleshooting'].includes(focus)
            && (process.env.CONVERSATION_RESEARCH_TAVILY_ENABLED || 'true').toLowerCase() === 'true';
        try {
            Logger.INFO(`[ConversationResearch] Researching "${stableTopic}" with query "${query}"`);
            const result = await this.searchWithTimeout(query, concreteAllowed ? 'tavily' : 'duckduckgo');
            if (this.states.get(stateKey) !== state || state.generation !== generation || !sameTopic(state.candidate || '', stableTopic)) {
                return this.get(userId, sessionId);
            }
            if (!result.output || /(?:^(?:error executing|unknown tool|tool system is disabled)|couldn't find any specific results|encountered an issue while searching|search service might be temporarily unavailable)/i.test(result.output)) {
                Logger.WARN(`[ConversationResearch] Search produced no usable context for "${stableTopic}".`);
                return state.current;
            }

            const safeOutput = this.sanitizeResearch(result.output);
            if (!safeOutput) return state.current;
            const entry = `Research query: ${query}\n${safeOutput}`;
            const combined = state.current && sameTopic(state.current.topic, stableTopic)
                ? `${state.current.summary}\n\n${entry}`
                : entry;
            const summary = combined.length <= 6500
                ? combined
                : `${combined.slice(0, 2800)}\n\n[Latest research]\n${entry.slice(-3500)}`;
            const sources = this.mergeSources(state.current?.sources || [], result.metadata.web_search?.sources || []);
            state.current = { topic: stableTopic, summary, sources, updatedAt: Date.now() };
            state.lastSearchAt = state.current.updatedAt;
            await this.persist(userId, sessionId, state.current, [...state.queries]);
            return state.current;
        } catch (error) {
            Logger.WARN(`[ConversationResearch] Research failed for "${stableTopic}": ${error}`);
            return state.current;
        } finally {
            state.inFlight = false;
        }
    }

    private getState(userId: string, sessionId: string) {
        const key = this.stateKey(userId, sessionId);
        let state = this.states.get(key);
        if (!state) {
            state = {
                confirmations: 0,
                inFlight: false,
                lastSearchAt: 0,
                searches: 0,
                queries: new Set(),
                loadedTopics: new Set(),
                observations: [],
                generation: 0,
                approvedTopics: new Set(),
                deniedTopics: new Set(),
            };
            this.states.set(key, state);
        }
        return state;
    }

    private mergeSources(existing: { title: string; url: string }[], incoming: { title: string; url: string }[]) {
        const sources = new Map(existing.map(source => [source.url, source]));
        incoming.forEach(source => {
            if (this.isPublicUrl(source.url)) {
                const title = this.sanitizeResearch(source.title) || new URL(source.url).hostname;
                sources.set(source.url, { title: title.slice(0, 200), url: source.url });
            }
        });
        return [...sources.values()].slice(0, 10);
    }

    private async load(userId: string, sessionId: string, topic: string) {
        try {
            const data = await this.getStore().hGetAll(this.redisKey(userId, sessionId, topic));
            if (!data?.topic || !data.summary) return undefined;
            const persistedTopic = cleanText(data.topic, 120);
            const summary = this.sanitizeResearch(data.summary);
            if (!sameTopic(topic, persistedTopic) || !summary) return undefined;
            return {
                context: {
                    topic: persistedTopic,
                    summary,
                    sources: this.mergeSources([], JSON.parse(data.sources || '[]')),
                    updatedAt: Number(data.updatedAt) || 0,
                } satisfies ConversationResearchContext,
                queries: JSON.parse(data.queries || '[]') as string[],
            };
        } catch (error) {
            Logger.WARN(`[ConversationResearch] Could not load persisted context: ${error}`);
            return undefined;
        }
    }

    private async persist(userId: string, sessionId: string, context: ConversationResearchContext, queries: string[]) {
        try {
            const key = this.redisKey(userId, sessionId, context.topic);
            const store = this.getStore();
            await store.hSet(key, {
                topic: context.topic,
                summary: context.summary,
                sources: JSON.stringify(context.sources),
                queries: JSON.stringify(queries),
                updatedAt: String(context.updatedAt),
            });
            const configuredTtl = Number(process.env.CONVERSATION_RESEARCH_TTL_SECONDS || 2592000);
            const ttl = Number.isFinite(configuredTtl) ? Math.max(3600, Math.min(7776000, configuredTtl)) : 2592000;
            await store.expire(key, ttl);
        } catch (error) {
            Logger.WARN(`[ConversationResearch] Could not persist context: ${error}`);
        }
    }

    private stateKey(userId: string, sessionId: string) {
        return `${userId}:${sessionId}`;
    }

    private redisKey(userId: string, sessionId: string, topic: string) {
        const topicHash = createHash('sha256').update(normalize(topic)).digest('hex').slice(0, 16);
        const sessionHash = createHash('sha256').update(sessionId).digest('hex').slice(0, 16);
        return `conversationResearch:${userId}:${sessionHash}:${topicHash}`;
    }

    private getStore() {
        return this.store || redisClientMemory as unknown as ResearchStore;
    }

    private reserveUserSearch(userId: string) {
        const now = Date.now();
        const windowStart = now - 3600000;
        const searches = (this.userSearches.get(userId) || []).filter(timestamp => timestamp >= windowStart);
        const configuredMax = Number(process.env.CONVERSATION_RESEARCH_MAX_PER_HOUR || 8);
        const maxPerHour = Number.isFinite(configuredMax) ? Math.max(1, Math.min(60, configuredMax)) : 8;
        if (searches.length >= maxPerHour) {
            this.userSearches.set(userId, searches);
            return false;
        }
        searches.push(now);
        this.userSearches.set(userId, searches);
        return true;
    }

    private searchWithTimeout(query: string, provider: 'duckduckgo' | 'tavily') {
        return new Promise<ToolResult>((resolve, reject) => {
            const timer = setTimeout(
                () => reject(new Error('Search timed out')),
                Number(process.env.CONVERSATION_RESEARCH_TIMEOUT_MS || 15000),
            );
            void this.search(query, provider).then(result => {
                clearTimeout(timer);
                resolve(result);
            }, error => {
                clearTimeout(timer);
                reject(error);
            });
        });
    }

    private sanitizeResearch(value: string) {
        return value
            .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
            .split('\n')
            .filter(line => !promptInjection.test(line) && !instructionalLanguage.test(line))
            .join('\n')
            .trim()
            .slice(0, 3200);
    }

    private isPublicUrl(value: string) {
        try {
            const url = new URL(value);
            if (!['http:', 'https:'].includes(url.protocol)) return false;
            const host = url.hostname.toLowerCase();
            if (host === 'localhost' || host === '::1' || host.endsWith('.local')) return false;
            if (/^(?:127\.|10\.|169\.254\.|192\.168\.)/.test(host)) return false;
            const private172 = host.match(/^172\.(\d+)\./);
            if (private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31) return false;
            return true;
        } catch {
            return false;
        }
    }
}
