import { callAI, type Message } from '../ai-service';
import { type CompletenessStatus } from '../completeness-monitor';

const ADAPTIVE_GEN_PROMPT = `Analise as 10 respostas padrão + status de completude.

RESPOSTAS:
[ANSWERS]

STATUS:
[STATUS]

GERE ATÉ 10 PERGUNTAS ADAPTATIVAS focadas em:
1. ESCLARECER vagas/incompletas
2. QUANTIFICAR genéricas
3. DETALHAR hipótese de solução (se mencionada) ou explorar alternativas
4. PREENCHER LACUNAS críticas

REGRAS:
- Máximo 10 (pode ser menos se não houver lacunas)
- Específicas e conectadas às respostas
- Priorizar essenciais faltantes
- Tom conversacional
- Numerar: "Pergunta 11 de 20", "Pergunta 12 de 20"...
- Se sem lacunas: 3-5 perguntas de confirmação

FORMATO:
**Pergunta X de 20**

[Contexto: referência ao dito]

**[Pergunta principal]**

[Orientações: 2-3 bullets]

---

RETORNE TEXTO PURO (não JSON), perguntas separadas por linha dupla.`;

export async function generateAdaptiveQuestions(
  standardAnswers: Message[],
  completenessStatus: CompletenessStatus
): Promise<string[]> {
  try {
    const answersText = standardAnswers
      .filter(m => m.role === 'user')
      .map((m, i) => `P${i + 1}: ${m.content}`)
      .join('\n\n');
    
    const statusText = JSON.stringify(completenessStatus, null, 2);
    
    const prompt = ADAPTIVE_GEN_PROMPT
      .replace('[ANSWERS]', answersText)
      .replace('[STATUS]', statusText);
    
    const response = await callAI({
      messages: [{ role: 'user', content: prompt }],
      phase: 'adaptive_questions',
      systemPrompt: 'Gere perguntas adaptativas.',
      timeout: 60000
    });
    
    const questions = response
      .split('\n\n')
      .filter(q => q.trim().startsWith('**Pergunta'))
      .map(q => q.trim())
      .slice(0, 10);
    
    console.log(`[Adaptive] Geradas ${questions.length} perguntas`);
    
    return questions;
    
  } catch (error) {
    console.error('[Adaptive] Erro:', error);
    return [];
  }
}
