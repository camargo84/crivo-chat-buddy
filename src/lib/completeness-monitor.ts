import { callAI, type Message } from './ai-service';

export interface CompletenessStatus {
  isComplete: boolean;
  score: number;
  essentialInfo: {
    identificacao: boolean;
    problema: boolean;
    impacto: boolean;
    beneficiarios: boolean;
    solucaoCandidata: boolean;
    quantitativos: boolean;
    prazos: boolean;
    orcamento: boolean;
  };
  missingCritical: string[];
  message: string;
}

const MONITOR_PROMPT = `Analise a conversa e determine se há INFORMAÇÕES ESSENCIAIS SUFICIENTES.

INFORMAÇÕES ESSENCIAIS (mínimo):
1. IDENTIFICAÇÃO: Órgão e localização confirmados
2. PROBLEMA: Descrição clara da necessidade
3. IMPACTO: Impacto prático (quantificado ou estimado)
4. BENEFICIÁRIOS: Quem será beneficiado (quantidade aproximada)
5. SOLUÇÃO CANDIDATA: Pelo menos UMA hipótese de solução mencionada
6. QUANTITATIVOS: Estimativa de quantidade (mesmo aproximada)
7. PRAZOS: Ideia de urgência/prazo (mesmo vago)
8. ORÇAMENTO: Indicação de recurso disponível ou não

CRITÉRIOS:
- Cada item: até 12.5 pontos (8 itens = 100)
- COMPLETO (>=70): Suficiente para planejamento
- INCOMPLETO (<70): Faltam informações críticas

CONVERSA:
[HISTORY]

RETORNE JSON PURO (sem markdown):
{
  "isComplete": boolean,
  "score": number,
  "essentialInfo": {
    "identificacao": boolean,
    "problema": boolean,
    "impacto": boolean,
    "beneficiarios": boolean,
    "solucaoCandidata": boolean,
    "quantitativos": boolean,
    "prazos": boolean,
    "orcamento": boolean
  },
  "missingCritical": ["itens faltantes"],
  "message": "frase curta sobre status"
}`;

export async function monitorCompleteness(messages: Message[]): Promise<CompletenessStatus> {
  try {
    const history = messages.map(m => `${m.role === 'user' ? 'U' : 'A'}: ${m.content}`).join('\n');
    const prompt = MONITOR_PROMPT.replace('[HISTORY]', history);
    
    const response = await callAI({
      messages: [{ role: 'user', content: prompt }],
      phase: 'monitor_completeness',
      systemPrompt: 'Retorne JSON puro.',
      timeout: 45000
    });
    
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return getDefaultStatus();
    }
    
    const status: CompletenessStatus = JSON.parse(jsonMatch[0]);
    console.log(`[Monitor] ${status.score}% | Completo: ${status.isComplete}`);
    
    return status;
    
  } catch (error) {
    console.error('[Monitor] Erro:', error);
    return getDefaultStatus();
  }
}

function getDefaultStatus(): CompletenessStatus {
  return {
    isComplete: false,
    score: 0,
    essentialInfo: {
      identificacao: false,
      problema: false,
      impacto: false,
      beneficiarios: false,
      solucaoCandidata: false,
      quantitativos: false,
      prazos: false,
      orcamento: false
    },
    missingCritical: ['Todas as informações'],
    message: 'Ainda não há informações suficientes'
  };
}
