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
    extractedText?: string;
};

export type ScreenFrame = {
    capturedAt: number;
    mimeType: 'image/jpeg' | 'image/webp';
    base64: string;
    width: number;
    height: number;
    application?: string;
};

export type ConversationEvent = {
    observation: ConversationObservation;
    userId?: string;
};

export type ConversationEvents = {
    ScreenObservation: ConversationEvent;
};
