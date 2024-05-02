import system from '../system.json';
import { checkDir } from './o_utils';
import dotenv from 'dotenv';

dotenv.config();

export enum Status {
    ACTIVE = 'active',
    INACTIVE = 'inactive',
    FAILED = 'failed',
}

export class Core {
    static status: Status = Status.INACTIVE;

    static model_org_name: string = `${process.env.MODEL_URL?.match(/\/([^\/]+)\.gguf/)?.[1]}.gguf` || '';
    static model_path: string = checkDir(process.env.MODEL_PATH || '');
    static model_name: string = 'okuu';

    static chat_settings: any = {
        prefix: '\x1b[32mOkuu:\x1b[0m'
    };

    static model_settings: any = { 
        temperature: 1,
        num_ctx: 4096,
        top_k: 10,
        top_p: 1,
        system: system.system
    };


    static ollama_settings: any = {
        host: 'http://localhost:11434',
        stream: true
    };



// TODO: test a bit more
static modelfile: string = `FROM ${Core.model_path}${Core.model_org_name}
${Object.entries(Core.model_settings)
    .filter(([key]) => key !== 'system')
    .map(([key, value]) => `PARAMETER ${key} ${value}`)
    .join('\n')}
SYSTEM ${Core.model_settings['system']}
TEMPLATE """{{ if .System }}<|start_header_id|>system<|end_header_id|>

{{ .System }}<|eot_id|>{{ end }}{{ if .Prompt }}<|start_header_id|>user<|end_header_id|>

{{ .Prompt }}<|eot_id|>{{ end }}<|start_header_id|>assistant<|end_header_id|>

{{ .Response }}<|eot_id|>"""
PARAMETER num_keep 24
PARAMETER stop "<|start_header_id|>"
PARAMETER stop "<|end_header_id|>"
PARAMETER stop "<|eot_id|>"

`;
}