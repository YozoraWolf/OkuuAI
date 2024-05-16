import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { BufferMemory } from "langchain/memory";
import { RedisChatMessageHistory } from "@langchain/community/stores/message/ioredis";
import { Core } from "@src/core";
import { ConversationChain } from "langchain/chains";
import { redisClientMemory } from "../redis";
import { Logger } from "@src/logger";
import fs from "fs";
import { setMessagesCount } from "@src/chat";
import { model } from "@src/chat";

const SESSION_JSON = "session.json";

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
};

interface SessionSettings {
  sessionId: string;
};

export const SESSION_SETTINGS: SessionSettings = loadSettings();

export let session: BufferMemory;

const prompt = ChatPromptTemplate.fromMessages([
  ["system", Core.model_settings.system],
  new MessagesPlaceholder("history"),
  ["user", "{input}"]
]);

export let currentMemory: RedisChatMessageHistory;


const newSessionDate = () => {
  const date = new Date().toISOString();
  saveSessionIdToSettings(date);
  return date;
};

export const getSessionMemory = (sessionId: string) => {
  return new BufferMemory({
    chatHistory: new RedisChatMessageHistory({
      sessionId,
      url: `redis://localhost:${process.env.REDIS_PORT}`
    }),
    returnMessages: true,
    memoryKey: "history",
    inputKey: "input"
  });
};

export const startSession = async (sessionId: any) : Promise<ConversationChain> => {
  sessionId = sessionId !== null ? sessionId : newSessionDate();
  Logger.DEBUG(`Starting session with sessionId: ${sessionId}`);

  session = getSessionMemory(sessionId);

  return new ConversationChain({ llm: model, memory: session, prompt });
};

export const getLatestHistory = async (): Promise<string | null> => {
  Logger.DEBUG("Getting latest history");

  // Get all keys
  const keys = await redisClientMemory.keys('*');

  if (keys.length === 0) {
      return null;
  }

  // Sort keys by descending order (latest first)
  keys.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

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
  lastMessage: string;
  date: string;
}

export const getAllSessions = async (): Promise<Array<SessionData>> => {
  const sessions = await redisClientMemory.keys('*');
  const sessionsData = await Promise.all(sessions.map(async (sessionId) => {
    const lastMessage = JSON.parse((await redisClientMemory.lindex(sessionId, 0)) || "{}");
    const type = lastMessage.type;
    const msg = lastMessage.data.content.substring(0, 20); // truncate message to 20 characters
    const date = new Date(sessionId).toISOString();
    return { index: sessions.indexOf(sessionId), lastMessage: `${type}: ${msg}`, date }; // format
  }));
  return sessionsData || [{}];
};


export const switchToSession = async (sessionId: string | null) => {
  Core.chat_session = await startSession(sessionId);
  Logger.INFO(`Switched to session: ${sessionId}`);
  if(sessionId !== null) saveSessionIdToSettings(sessionId); // save to settings if not null
};

const generateSessionSettings = () => {
  fs.writeFileSync(SESSION_JSON, JSON.stringify({}, null, 2));
  Logger.INFO("Session settings generated successfully.");
};

export const saveSessionIdToSettings = (sessionId: string) => {
  let settings: any = {}; // initialize empty
  if(!fs.existsSync(SESSION_JSON)) {
    Logger.INFO("Session settings file not found, generating new settings...");
    generateSessionSettings(); // if not found, generate new settings
  } else {
    settings = JSON.parse(fs.readFileSync(SESSION_JSON, "utf-8")); // read existing settings
  }
  settings.sessionId = sessionId;
  fs.writeFileSync(SESSION_JSON, JSON.stringify(settings, null, 2)); // save
  Logger.INFO("Session ID saved to settings successfully.");
};

export const getLatestMsgs = async (msg_limit: number): Promise<ChatMessageGUI[]> => {
  const latestSession = SESSION_SETTINGS.sessionId || await getLatestHistory();
  if (latestSession === null) {
    return [];
  }
  Logger.DEBUG(`Getting latest messages from session: ${latestSession}`);
  const result = await redisClientMemory.lrange(latestSession, 0, msg_limit);
  result.reverse();

  //Logger.DEBUG(`Latest messages: ${result.join('\n')}`);

  setMessagesCount(result.length);

  const messages = result.map((msg: string, index: number) => {
    const { type, data } = JSON.parse(msg);
    const obj: ChatMessageGUI = { id: index, type, content: data["content"], done: true };
    return obj;
  });

  //Logger.DEBUG(`Latest messages: ${messages.map(msg => JSON.stringify(msg)).join('\n')}`);

  return messages;
};