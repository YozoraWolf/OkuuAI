export type ObservationCategory = 'info' | 'suggestion' | 'warning' | 'error' | 'success';

export type ConversationObservation = {
    id: string;
    timestamp: number;
    category: ObservationCategory;
    message: string;
    source: 'conversation' | 'screen' | 'speech' | 'perception';
    application?: string;
    importance?: number;
    latencyMs?: number;
};

export type ConversationEvent = {
    observation: ConversationObservation;
    userId?: string;
};

export type ConversationEvents = {
    ScreenObservation: ConversationEvent;
};
