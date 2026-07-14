export type ObservationCategory = 'info' | 'suggestion' | 'warning' | 'error' | 'success';

export type VisualStream = 'screen' | 'camera';

export type ConversationObservation = {
    id: string;
    timestamp: number;
    category: ObservationCategory;
    message: string;
    source: 'conversation' | 'screen' | 'speech' | 'perception';
    stream?: VisualStream;
    application?: string;
    importance?: number;
    latencyMs?: number;
    extractedText?: string;
    comment?: string;
};

export type ScreenFrame = {
    capturedAt: number;
    mimeType: 'image/jpeg' | 'image/webp';
    base64: string;
    width: number;
    height: number;
    stream?: VisualStream;
    application?: string;
};

export type ConversationEvent = {
    observation: ConversationObservation;
    userId?: string;
};

export type ConversationEvents = {
    ScreenObservation: ConversationEvent;
};
