// format components for template usage
import Think from 'src/components/chat/subcomponents/Think.vue';
import Code from 'src/components/chat/subcomponents/Code.vue';
import Quote from 'src/components/chat/subcomponents/Quote.vue';
import Link from 'src/components/chat/subcomponents/Link.vue';
import Bold from 'src/components/chat/subcomponents/Bold.vue';
import Italic from 'src/components/chat/subcomponents/Italic.vue';
import Underline from 'src/components/chat/subcomponents/Underline.vue';

type ComponentPart = {
    type: string;
    content?: string;
    component?: any;
    props?: any;
};

// regex list to match different formatting styles - make sure code blocks have higher priority
const combinedRegex = new RegExp(
    [
        '```([\\s\\S]*?)```',         // code block with triple backticks
        '`([^`\\n]+)`',               // inline code with single backticks
        '<think>([\\s\\S]*?)<\\/think>', // think (mostly for DeepSeek thinking)
        '\\*\\*([\\s\\S]+?)\\*\\*',   // bold: **text**
        '__(.+?)__',                  // underline: __text__
        '_([^_]+)_',                  // italic: _text_
        '((?:https?:\\/\\/)[^\\s]+)', // URLs: http:// or https://
    ].join('|'),
    'gi'
);

// Function to generate components from message
export const generateComponents = (
    message: string, thinking: string | undefined): ComponentPart[] => {
    const parts: ComponentPart[] = [];
    const text = message;

    // First, extract all quote blocks (consecutive lines starting with ">")
    const quoteBlockRegex = /((?:^>.*\n?)+)/gm;
    let quoteMatch: RegExpExecArray | null;
    const quoteParts: Array<{ start: number; end: number; text: string }> = [];
    while ((quoteMatch = quoteBlockRegex.exec(text)) !== null) {
        quoteParts.push({
            start: quoteMatch.index,
            end: quoteMatch.index + quoteMatch[0].length,
            text: quoteMatch[0],
        });
    }

    let cursor = 0;
    for (const quote of quoteParts) {
        if (quote.start > cursor) {
            const beforeQuote = text.slice(cursor, quote.start);
            processTextSegment(beforeQuote, parts);
        }
        // Process the quote block
        // remove leading ">" and optional space from each line.
        const quoteLines = quote.text
            .split('\n')
            .map(line => line.replace(/^>\s?/, ''));
        // Pass the array of lines as data, so the Quote component can render them with preserved newlines
        parts.push({ type: 'component', component: Quote, props: { data: quoteLines } });
        cursor = quote.end;
    }

    console.log("Thinking text:", thinking);

    // if there is any thinking text coming from the AI, process it
    if(thinking && thinking.length > 0) {
        // process the thinking text as a separate component
        parts.push({ type: 'component', component: Think, props: { data: thinking } });
    }

    // Process any text after the last quote block, if there's... any
    if (cursor < text.length) {
        const afterQuote = text.slice(cursor);
        processTextSegment(afterQuote, parts);
    }

    return parts;
};

// this function is just a helper to process a segment of text
function processTextSegment(segment: string, parts: ComponentPart[]) {
    let match: RegExpExecArray | null;
    let innerLastIndex = 0;
    
    // make sure to reset the regex lastIndex
    combinedRegex.lastIndex = 0;
    
    while ((match = combinedRegex.exec(segment)) !== null) {
        if (match.index > innerLastIndex) {
            // process plain text before the match, including any newlines
            const plainText = segment.slice(innerLastIndex, match.index);
            processPlainTextWithNewlines(plainText, parts);
        }
        
        // process matched formatting
        if (match[1] !== undefined) {
            // Triple backtick code block - preserve all formatting inside
            const codeContent = match[1].trim();
            parts.push({ 
                type: 'component', 
                component: Code, 
                props: { 
                    data: codeContent,
                    multiline: true 
                } 
            });
        } else if (match[2] !== undefined) {
            // Single backtick inline code
            parts.push({ 
                type: 'component', 
                component: Code, 
                props: { 
                    data: match[2],
                    multiline: false
                } 
            });
        } else if (match[3] !== undefined) {
            // think
            // if there is not already a Think component, add it if present in msg
            if(!parts.some(part => part.type === 'component' && part.component === Think)) {
                parts.push({ type: 'component', component: Think, props: { data: match[3] } });
            }
        } else if (match[4] !== undefined) {
            // bold
            parts.push({ type: 'component', component: Bold, props: { data: match[4] } });
        } else if (match[5] !== undefined) {
            // underline
            parts.push({ type: 'component', component: Underline, props: { data: match[5] } });
        } else if (match[6] !== undefined) {
            // italic
            parts.push({ type: 'component', component: Italic, props: { data: match[6] } });
        } else if (match[7] !== undefined) {
            // link (URL)
            parts.push({ type: 'component', component: Link, props: { data: match[7] } });
        }
        
        innerLastIndex = match.index + match[0].length;
    }
    
    // any remaining plain text 
    if (segment.length > innerLastIndex) {
        const remainingText = segment.slice(innerLastIndex);
        processPlainTextWithNewlines(remainingText, parts);
    }
}

// this helper function processes plain text segments, including newlines
function processPlainTextWithNewlines(text: string, parts: ComponentPart[]) {
    if (!text) return;
    
    // split by newlines and create separate parts
    const segments = text.split(/(\n)/);
    
    for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        
        if (segment === '\n') {
            // this tells the vue component to render a newline
            parts.push({ type: 'nl' });
        } else if (segment) {
            parts.push({ type: 'html', content: segment });
        }
    }
}
