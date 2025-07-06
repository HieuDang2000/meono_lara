// WebSocket Event Types
export type WebSocketEvent<T = any> = T;

// Public Channel Events
export type TestWSPublicEvent = {
    message: string;
};

// Private Channel Events
export type TestWSPrivateEvent = {
    message: string;
};

// Presence Channel Events
export type TestWSPresenceEvent = {
    roomId: string;
    message: string;
    user: {
        id: number;
        name: string;
    };
};

// Presence Channel Member
export type PresenceMember = {
    id: number;
    name: string;
};

// Whisper Types
export type ClientTypingWhisper = {
    user: string;
    isTyping: boolean;
};

export type UserTypingWhisper = {
    isTyping: boolean;
}; 