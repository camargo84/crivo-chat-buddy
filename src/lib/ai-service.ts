import { GoogleGenerativeAI } from '@google/generative-ai';
import { getAIConfig, type ConversationPhase } from './ai-config';

const genAI = new GoogleGenerativeAI(
  import.meta.env.VITE_GEMINI_API_KEY || ''
);

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface CallAIParams {
  messages: Message[];
  phase: ConversationPhase;
  systemPrompt: string;
  retryCount?: number;
  timeout?: number;
}

export async function callAI({
  messages,
  phase,
  systemPrompt,
  retryCount = 2,
  timeout = 30000
}: CallAIParams): Promise<string> {
  const config = getAIConfig(phase);
  
  console.log(`[AI] Phase: ${phase} | Model: ${config.model.split('/').pop()}`);
  
  const model = genAI.getGenerativeModel({
    model: config.model,
    generationConfig: {
      temperature: config.temperature,
      maxOutputTokens: config.maxOutputTokens,
      topP: config.topP,
      topK: config.topK
    }
  });
  
  try {
    const prompt = buildPrompt(systemPrompt, messages);
    
    const responsePromise = model.generateContent(prompt);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('AI timeout')), timeout)
    );
    
    const result = await Promise.race([responsePromise, timeoutPromise]);
    const text = result.response.text();
    
    if (!text?.trim()) {
      throw new Error('Empty AI response');
    }
    
    return text.trim();
    
  } catch (error) {
    console.error(`[AI] Error (${3 - retryCount}/3):`, error);
    
    if (retryCount > 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return callAI({ messages, phase, systemPrompt, retryCount: retryCount - 1, timeout });
    }
    
    throw error;
  }
}

function buildPrompt(systemPrompt: string, messages: Message[]): string {
  const history = messages
    .map(m => `${m.role === 'user' ? 'Usuário' : 'Agente'}: ${m.content}`)
    .join('\n\n');
  
  return `${systemPrompt}\n\n---\n\nHISTÓRICO:\n\n${history}`;
}

export function isResponseTooShort(response: string): boolean {
  const trimmed = response.trim();
  return trimmed.length < 30 || trimmed.split(' ').length < 5;
}

export function isResponseVague(response: string): boolean {
  const vaguePhrases = ['não sei', 'talvez', 'mais ou menos', 'não tenho certeza'];
  const trimmed = response.trim().toLowerCase();
  return trimmed.split(' ').length < 8 && vaguePhrases.some(p => trimmed.includes(p));
}
