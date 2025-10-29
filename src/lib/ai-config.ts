export const AI_MODELS = {
  FLASH: 'models/gemini-1.5-flash-latest',
  PRO: 'models/gemini-1.5-pro-latest'
} as const;

export interface AIConfig {
  model: string;
  temperature: number;
  maxOutputTokens: number;
  topP: number;
  topK?: number;
}

export type ConversationPhase = 
  | 'intro'
  | 'standard_questions'
  | 'validate_response'
  | 'adaptive_questions'
  | 'monitor_completeness'
  | 'synthesis'
  | 'docx_generation';

export function getAIConfig(phase: ConversationPhase): AIConfig {
  switch (phase) {
    case 'intro':
    case 'standard_questions':
      return {
        model: AI_MODELS.FLASH,
        temperature: 0.75,
        maxOutputTokens: 1024,
        topP: 0.92,
        topK: 38
      };
    
    case 'validate_response':
      return {
        model: AI_MODELS.FLASH,
        temperature: 0.65,
        maxOutputTokens: 768,
        topP: 0.88,
        topK: 32
      };
    
    case 'adaptive_questions':
    case 'monitor_completeness':
      return {
        model: AI_MODELS.PRO,
        temperature: 0.5,
        maxOutputTokens: 2048,
        topP: 0.85
      };
    
    case 'synthesis':
    case 'docx_generation':
      return {
        model: AI_MODELS.PRO,
        temperature: 0.2,
        maxOutputTokens: 8192,
        topP: 0.75
      };
    
    default:
      return {
        model: AI_MODELS.FLASH,
        temperature: 0.7,
        maxOutputTokens: 1024,
        topP: 0.90,
        topK: 35
      };
  }
}
