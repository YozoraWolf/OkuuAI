import { ConversationChain } from 'langchain/chains';
import system from '../system.json';
import dotenv from 'dotenv';

dotenv.config();

export enum Status {
    ACTIVE = 'active',
    INACTIVE = 'inactive',
    FAILED = 'failed',
}

export class Core {
    static status: Status = Status.INACTIVE;

    static model_org_name: string = `${process.env.MODEL_URL?.match(/\/([^/]+)\.gguf/)?.[1]}.gguf`;
    static model_path: string = process.env.MODEL_PATH || '';
    static model_name: string = 'llama3';

    static chat_settings: any = {
        prefix: '\x1b[32mOkuu:\x1b[0m'
    };

    static template: any = `{{ if .System }}<|start_header_id|>system<|end_header_id|>

{{ .System }}<|eot_id|>{{ end }}{{ if .Prompt }}<|start_header_id|>user<|end_header_id|>

{{ .Prompt }}<|eot_id|>{{ end }}<|start_header_id|>assistant<|end_header_id|>

{{ if not (or (contains .Response "#!IDK") (contains .Response "#!WEBSEARCH")) }}
{{ .Response }}
{{ end }}<|eot_id|>`;

    static model_settings: any = { 
        temperature: .3,
        //numCtx: 4096,
        topK: 10,
        topP: 1,
        repeatPenalty: 1.15,
        numPredict: 250,
        system: system.system,
        stop: ["<|start_header_id|>", "<|end_header_id|>", "<|eot_id|>"], // Stop tokens
        template: Core.template // Pass the template here
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