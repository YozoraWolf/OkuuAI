import path from 'path';
import system from '../system.json';

export enum Status {
    ACTIVE = 'active',
    INACTIVE = 'inactive',
    FAILED = 'failed',
}

export class Core {
    static status: Status = Status.INACTIVE;
    static server: string = 'http://localhost:11434';

    static model_org_name = 'dolphin-2.9-llama3-8b.Q6_K.gguf';
    static model_path: string = '/usr/share/ollama/.ollama/models/okuu/';
    static model_name: string = 'okuu';

    static model_settings: any = {
        temperature: 1,
        num_ctx: 4096,
        top_k: 10,
        top_p: 1,
        system: system.system
    }


    static modelfile: string = `FROM ${Core.model_path}${Core.model_org_name}
        ${Object.entries(Core.model_settings)
            .filter(([key]) => key !== 'system')
            .map(([key, value]) => `PARAMETER ${key} ${value}`)
            .join('\n')}
        SYSTEM ${Core.model_settings['system']}
        TEMPLATE """{{ if .System }}<|im_start|>system
        {{ .System }}<|im_end|>
        {{ end }}{{ if .Prompt }}<|im_start|>user
        {{ .Prompt }}<|im_end|>
        {{ end }}<|im_start|>assistant"""
        PARAMETER num_keep 24
        PARAMETER stop "<|start_header_id|>"
        PARAMETER stop "<|end_header_id|>"
        PARAMETER stop "<|eot_id|>"
        `;
}