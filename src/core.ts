import { ConversationChain } from 'langchain/chains';
import dotenv from 'dotenv';
import { Ollama } from 'ollama';
dotenv.config();

export enum Status {
    ACTIVE = 'active',
    INACTIVE = 'inactive',
    FAILED = 'failed',
}

export class Core {
    static status: Status = Status.INACTIVE;

    static ai_name: string = 'OkuuAI';
    static model_name: string = 'llama3';
    static ollama_instance: Ollama;
    static defaultTemplate: string = `{{ if .System }}<|start_header_id|>system<|end_header_id|>
    
    {{ .System }}<|eot_id|>{{ end }}{{ if .Prompt }}<|start_header_id|>user<|end_header_id|>
    
    {{ .Prompt }}<|eot_id|>{{ end }}<|start_header_id|>assistant<|end_header_id|>
    
    {{ if not (or (contains .Response "#!IDK") (contains .Response "#!WEBSEARCH")) }}
    {{ .Response }}
    {{ end }}<|eot_id|>`;
    
    static template: string = Core.defaultTemplate;

    static model_org_name: string = `${process.env.MODEL_URL?.match(/\/([^/]+)\.gguf/)?.[1]}.gguf`;
    static model_path: string = process.env.MODEL_PATH || '';

    // global memory: a toggle to allow okuu to search only session-specific memory or global memory
    static global_memory: boolean = false;

    static chat_settings: any = {
        prefix: '\x1b[32mOkuu:\x1b[0m'
    };

    static model_settings: any = { 
        temperature: .3,
        //numCtx: 4096,
        topK: 10,
        topP: 1,
        repeatPenalty: 1.15,
        numPredict: 250,
        system: "You are a friendly AI assistant.",
        stop: ["<|start_header_id|>", "<|end_header_id|>", "<|eot_id|>"], // Stop tokens
        template: Core.template, // Pass the template here
        think: false, // whether to use the think feature for some models
    };


    static ollama_settings: any = {
        host: 'http://localhost:11434',
        stream: true
    };

    static chat_session: ConversationChain;



// TODO: test a bit more
static modelfile: string = `FROM ${Core.model_path}${Core.model_org_name}
${Object.entries(Core.model_settings)
    .filter(([key]) => key !== 'system')
    .map(([key, value]) => `PARAMETER ${key} ${value}`)
    .join('\n')}
SYSTEM ${Core.model_settings['system']}
TEMPLATE """${Core.template}"""
PARAMETER num_keep 24
PARAMETER stop "<|start_header_id|>"
PARAMETER stop "<|end_header_id|>"
PARAMETER stop "<|eot_id|>"

`;
}