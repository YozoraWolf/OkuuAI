import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { BufferMemory } from "langchain/memory";
import { RedisChatMessageHistory } from "@langchain/community/stores/message/ioredis";
import { ChatOllama } from "@langchain/community/chat_models/ollama";
import { Core } from "@src/core";
import { ConversationChain } from "langchain/chains";
import { Logger } from "@src/logger";
import fs from "fs";
import { ChatMessage, setMessagesCount } from "@src/chat";
import { redisClientMemory, saveMemoryWithEmbedding } from "../redis";

const SESSION_JSON = "session.json";
export let SESSION_ID: string;

const generateSessionSettings = () => {
  const initialSettings = { sessionId: "0" };
  fs.writeFileSync(SESSION_JSON, JSON.stringify(initialSettings, null, 2));
  Logger.INFO("Session settings generated successfully.");
};

export const loadSettings = (): any => {
  if (fs.existsSync(SESSION_JSON)) {
    return JSON.parse(fs.readFileSync(SESSION_JSON, "utf-8"));
  } else {
    Logger.INFO("Session settings file not found.");
    generateSessionSettings();
    return loadSettings();
  }
};

interface ChatMessageGUI {
  id: number;
  type: string;
  content: string;
  done: boolean;
  sessionId?: string;
};

interface SessionSettings {
  sessionId: string;
};

export const SESSION_SETTINGS: SessionSettings = loadSettings();

let session: BufferMemory;

const prompt = ChatPromptTemplate.fromMessages([
  ["system", Core.model_settings.system],
  new MessagesPlaceholder("history"),
  ["user", "{input}"]
]);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { system, ...settings } = Core.model_settings;
const model = new ChatOllama({
  model: Core.model_name,
  ...settings
});

const getSessionsCount = async (): Promise<number> => {
  let sessionKeys = await redisClientMemory.keys('okuuMemory:*');
  // map out keys with "file" in them
  sessionKeys = sessionKeys.filter(key => !key.includes("file"));
  const uniqueSessionIds = new Set(sessionKeys.map(key => key.split(':')[1]));
  // get the highest index
  const numericIds = Array.from(uniqueSessionIds)
    .map(id => parseInt(id))
    .filter(id => !isNaN(id));

  const newSessionId = numericIds.length > 0 ? Math.max(...numericIds) : 0;
  Logger.INFO(`New Session ID: ${newSessionId}`);
  return newSessionId;
};

const newSession = async () => {
  const latestSessionIndex = await getSessionsCount();
  const newIndex = String(latestSessionIndex + 1);
  saveSessionIdToSettings(newIndex);
  Logger.INFO(`!New session started: ${newIndex}`);
  return newIndex;
};

export const startSession = async (sessionId: any): Promise<ConversationChain> => {
  sessionId = sessionId ? sessionId : await newSession();
  SESSION_ID = sessionId; // save to global variable
  Logger.DEBUG(`Starting session with sessionId: ${sessionId}`);
  session = new BufferMemory({
    chatHistory: new RedisChatMessageHistory({
      sessionId, // Or some other unique identifier for the conversation
      url: `redis://default:${process.env.REDIS_PWD}@localhost:${process.env.REDIS_PORT}/0`, // Default value, override with your own instance's URL
    }),
    returnMessages: true,
    memoryKey: "history",
    inputKey: "input"
  });

  setMessagesCount((await session.chatHistory.getMessages()).length + 1); // update msg count to save indexes?


  return new ConversationChain({ llm: model, memory: session, prompt });
};

export const getLatestHistory = async (): Promise<string | null> => {
  Logger.DEBUG("Getting latest history");

  // Get all keys
  const keys = await redisClientMemory.keys('okuuMemory:*');

  if (keys.length === 0) {
    return null;
  }

  // Sort keys by descending order (latest first)
  keys.sort((a: any, b: any) => new Date(b.split(':')[2]).getTime() - new Date(a.split(':')[2]).getTime());

  // Return the latest key
  return keys[0];
};

export const getAllSessionsTable = async (): Promise<string> => {
  const sessionsData = await getAllSessions();

  // generate the table with fixed column widths
  const sessionsTable = sessionsData.map((session: any) => {
    return [
      session.index.toString().padStart(1),
      session.lastMessage.padEnd(20),
      session.date
    ].join('\t');
  });

  // construct the table header and join with the session rows
  return `INDEX   LAST_MESSAGE                    DATE\n${sessionsTable.join('\n')}`;
};

export interface SessionData {
  index: number;
  lastMessage: ChatMessage | null;
  sessionId: string;
}

export const getAllSessions = async (): Promise<Array<SessionData>> => {
  Logger.DEBUG("Getting all sessions...");

  // Get all session keys in the pattern "okuuMemory:*"
  let sessionKeys = await redisClientMemory.keys('okuuMemory:*');
  // filter out kets that contain "file"
  sessionKeys = sessionKeys.filter(key => !key.includes("file"));

  if (sessionKeys.length === 0) {
    Logger.DEBUG("No session keys found.");
    return [];
  }

  const sessionData: SessionData[] = [];

  // get all unique sessionIds
  const uniqueSessionIds = new Set(sessionKeys.map(key => key.split(':')[1]));

  for (const [index, sessionId] of Array.from(uniqueSessionIds).entries()) {
    try {
      let msg = await getLastMsgFromSession(sessionId);
      sessionData.push({ index, lastMessage: msg, sessionId }); // Display who said the message
    } catch (error) {
      Logger.ERROR(`Error processing session ${sessionId}: ${error}`);
      sessionData.push({ index, lastMessage: null, sessionId });
    }
  }

  // order by timestamp in descending order
  sessionData.sort((a, b) => {
    const aTimestamp = a.lastMessage?.timestamp || 0;
    const bTimestamp = b.lastMessage?.timestamp || 0;
    return bTimestamp - aTimestamp;
  });

  return sessionData;
};

export const switchToSession = async (sessionId: string | null) => {
  Core.chat_session = await startSession(sessionId);
  //Logger.INFO(`Switched to session: ${Core.chat_session.}`);
  if (sessionId !== null) saveSessionIdToSettings(sessionId); // save to settings if not null
};

export const saveSessionIdToSettings = (sessionId: string) => {
  let settings: any = {}; // initialize empty
  if (!fs.existsSync(SESSION_JSON)) {
    Logger.INFO("Session settings file not found, generating new settings...");
    generateSessionSettings(); // if not found, generate new settings
  } else {
    settings = JSON.parse(fs.readFileSync(SESSION_JSON, "utf-8")); // read existing settings
  }
  settings.sessionId = sessionId;
  fs.writeFileSync(SESSION_JSON, JSON.stringify(settings, null, 2)); // save
  Logger.INFO("Session ID saved to settings successfully.");
};

export const getLatestMsgs = async (msg_limit: number = 20): Promise<ChatMessageGUI[]> => {
  const latestSession = SESSION_SETTINGS.sessionId || await getLatestHistory();
  if (latestSession === null) {
    return [];
  }
  Logger.DEBUG(`Getting latest messages from session: ${latestSession}`);
  const result = await redisClientMemory.hGetAll(latestSession);
  const messages = Object.values(result).reverse().slice(0, msg_limit).map((msg: string, index: number) => {
    const { type, data } = JSON.parse(msg);
    return { id: index, type, content: data["content"], done: true, sessionId: latestSession };
  });

  setMessagesCount(messages.length);

  return messages;
};

export const doesSessionExist = async (sessionId: string): Promise<boolean> => {
  try {
    // Get all the keys that match the pattern "okuuMemory:*"
    const sessionKeys = await redisClientMemory.keys('okuuMemory:*');

    // Check if any key contains the sessionId in its format "okuuMemory:sessionId:date"
    const exists = sessionKeys.some(key => key.includes(`okuuMemory:${sessionId}:`));

    return exists;
  } catch (error) {
    Logger.ERROR(`Error checking existence of session ${sessionId}: ${error}`);
    return false; // In case of error, return false
  }
};

export const doesKeyExist = async (key: string): Promise<boolean> => {
  try {
    // check if the key exists
    const exists = await redisClientMemory.exists(key);
    return exists === 1;
  } catch (error) {
    Logger.ERROR(`Error checking existence of key ${key}: ${error}`);
    return false; // In case of error, return false
  }
};


export const createSession = async (): Promise<any> => {
  const sessionId = String((await getSessionsCount()) + 1);
  if (await doesSessionExist(sessionId)) {
    return null;
  }
  const memoryKey = await saveMemoryWithEmbedding(sessionId, "Session started", "system", "statement");
  const session: any = await getLatestMsgsFromSession(sessionId, 100);
  const newSession: any = {
    sessionId,
    messages: session.messages,
  };
  return newSession;
};

export const getLatestMsgsFromSession = async (sessionId: string, msg_limit: number = 20): Promise<any> => {
  Logger.DEBUG(`Getting latest messages from session: ${sessionId}`);

  try {
    // Fetch all keys for the session, matching pattern 'okuuMemory:sessionId:*'
    const sessionKeys = await redisClientMemory.keys(`okuuMemory:${sessionId}:*`);

    const response: any = {
      sessionId,
      messages: []
    };

    // Fetch hash data for each session key
    const allMessagesWithTimestamps: ChatMessage[] = [];

    for (const key of sessionKeys) {
      const sessionData = await redisClientMemory.hGetAll(key);
      const sessData: ChatMessage = {
        sessionId: sessionData['sessionId'],
        user: sessionData['user'],
        message: sessionData['message'],
        timestamp: parseInt(sessionData['timestamp']),
        attachment: sessionData['attachment'],
        file: sessionData['file']
      };
      // Directly add sessionData to the array
      allMessagesWithTimestamps.push(sessData);
    }

    // Sort messages by timestamp in ascending order
    const sortedMessages = allMessagesWithTimestamps.sort((a, b) => a.timestamp - b.timestamp);

    // Limit to the most recent 'msg_limit' messages
    const latestMessages = sortedMessages.slice(-msg_limit);

    setMessagesCount(latestMessages.length);

    // Return the latest messages
    response.messages = latestMessages;

    return response;
  } catch (error) {
    Logger.ERROR(`Error getting latest messages for session ${sessionId}: ${error}`);
    return [];  // Return an empty array in case of error
  }
};

const getLastMsgFromSession = async (sessionId: string): Promise<ChatMessage | null> => {
  const sessionKeys = await redisClientMemory.keys(`okuuMemory:${sessionId}:*`);

  if (sessionKeys.length === 0) {
    return null;
  }

  // Sort keys by timestamp in descending order
  sessionKeys.sort((a: any, b: any) => {
    const aTimestamp = parseInt(a.split(':')[2]);
    const bTimestamp = parseInt(b.split(':')[2]);
    return bTimestamp - aTimestamp;
  });

  const latestKey = sessionKeys[0];
  Logger.DEBUG(`Latest key for session ${sessionId}: ${latestKey}`);
  const latestMsg = await redisClientMemory.hGetAll(latestKey);

  const msg: ChatMessage = {
    sessionId: latestMsg['sessionId'],
    user: latestMsg['user'],
    message: latestMsg['message'],
    timestamp: parseInt(latestMsg['timestamp']),
  };

  return msg;
};
