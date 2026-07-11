import axios from 'axios';
import { resolveHostRedirect } from 'src/utils/okuuai_utils';

export type SetupPayload = {
  admin: {
    username: string;
    password: string;
  };
  assistant: {
    name: string;
    system_prompt: string;
    model: string;
    inference_provider?: string;
    tool_llm?: string;
    template?: string;
    global_memory?: boolean;
    think?: boolean;
  };
  runtime: {
    port: number;
    redis_port: number;
    redis_pwd: string;
    api_key: string;
    ollama_port: number;
    ollama_default_model?: string;
    llm_provider?: string;
    llm_base_url?: string;
    llm_api_key?: string;
    llm_model?: string;
    web_url?: string;
    proxy_email?: string;
    proxy_pwd?: string;
    proxy_fwd?: string;
  };
  logging: {
    enabled: boolean;
    debug: boolean;
    maxFileSizeMb: number;
  };
};

export const getSetupStatus = async () => {
  const apiUrl = await resolveHostRedirect();
  const response = await axios.get(`${apiUrl}/setup/status`, {
    headers: { 'ngrok-skip-browser-warning': true }
  });
  return response.data;
};

export const completeSetup = async (payload: SetupPayload) => {
  const apiUrl = await resolveHostRedirect();
  const response = await axios.post(`${apiUrl}/setup/complete`, payload, {
    headers: { 'ngrok-skip-browser-warning': true }
  });
  return response.data;
};

export const testCustomEndpoint = async (baseUrl: string, apiKey: string, model?: string) => {
  const apiUrl = await resolveHostRedirect();
  const response = await axios.post(`${apiUrl}/setup/test-endpoint`, { baseUrl, apiKey, model }, {
    headers: { 'ngrok-skip-browser-warning': true }
  });
  return response.data;
};
