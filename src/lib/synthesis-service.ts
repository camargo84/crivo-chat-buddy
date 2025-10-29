import { callAI, type Message } from './ai-service';

export interface SynthesisData {
  identificacao: {
    orgaoNome: string;
    orgaoCNPJ: string;
    orgaoDemandante: string;
    uasg: string;
    endereco: string;
    responsavel: string;
    cargo: string;
    email: string;
    telefone: string;
    data: string;
  };
  necessidade: {
    descricao: string;
    naturezaDemanda: string;
    categoriaDemanda: string;
  };
  justificativa: {
    problemaDetalhado: string;
    situacaoAtual: string;
    impacto: string;
    beneficiarios: string;
    resultadoEsperado: string;
    alinhamentoEstrategico: string;
  };
  hipotesesSolucao: {
    principal: string;
    alternativas: string;
    experienciasAnteriores: string;
    justificativaEscolha: string;
  };
  requisitos: {
    quantitativos: string;
    especificacoesTecnicas: string;
    localizacao: string;
    infraestrutura: string;
  };
  planejamento: {
    prazo: string;
    orcamento: string;
    fonteRecurso: string;
    gestorFiscal: string;
    capacitacao: string;
  };
  riscos: {
    naoContratar: string;
    daContratacao: string;
    legislacao: string;
  };
}

const SYNTHESIS_PROMPT = `Analise a conversa e extraia informações estruturadas.

INSTRUÇÕES:
1. Sintetize clara e objetivamente
2. Se não fornecido: "Não informado" ou "A definir"
3. FIDELIDADE ABSOLUTA ao dito (não invente)
4. Linguagem formal técnica
5. Quantifique quando possível
6. RETORNE JSON PURO (sem markdown/comentários)

CONVERSA:
[HISTORY]

JSON (sem \`\`\`json):
{
  "identificacao": {
    "orgaoNome": "string",
    "orgaoCNPJ": "string",
    "orgaoDemandante": "string",
    "uasg": "string ou vazio",
    "endereco": "string",
    "responsavel": "string",
    "cargo": "string",
    "email": "string",
    "telefone": "string",
    "data": "DD/MM/YYYY"
  },
  "necessidade": {
    "descricao": "Descrição sucinta (max 200 chars)",
    "naturezaDemanda": "Bem permanente|Material consumo|Serviço continuado|Serviço não continuado|Obra",
    "categoriaDemanda": "TIC|Obras|Serviços comuns|Engenharia|Saúde|Educação|Outro"
  },
  "justificativa": {
    "problemaDetalhado": "string",
    "situacaoAtual": "string",
    "impacto": "string",
    "beneficiarios": "string",
    "resultadoEsperado": "string",
    "alinhamentoEstrategico": "string ou Não informado"
  },
  "hipotesesSolucao": {
    "principal": "Hipótese mais viável ou Em aberto",
    "alternativas": "Outras hipóteses ou Nenhuma",
    "experienciasAnteriores": "string ou Não houve",
    "justificativaEscolha": "string ou A definir"
  },
  "requisitos": {
    "quantitativos": "string",
    "especificacoesTecnicas": "string",
    "localizacao": "string",
    "infraestrutura": "string"
  },
  "planejamento": {
    "prazo": "string",
    "orcamento": "string",
    "fonteRecurso": "string",
    "gestorFiscal": "string",
    "capacitacao": "string"
  },
  "riscos": {
    "naoContratar": "string",
    "daContratacao": "string",
    "legislacao": "string"
  }
}`;

export async function generateSynthesis(
  messages: Message[],
  userProfile: any
): Promise<SynthesisData> {
  try {
    const history = messages
      .map(m => `${m.role === 'user' ? 'U' : 'A'}: ${m.content}`)
      .join('\n\n');
    
    const prompt = SYNTHESIS_PROMPT.replace('[HISTORY]', history);
    
    const response = await callAI({
      messages: [{ role: 'user', content: prompt }],
      phase: 'synthesis',
      systemPrompt: 'Retorne JSON puro.',
      timeout: 90000
    });
    
    let jsonText = response.trim();
    if (jsonText.startsWith('```')) {
      const match = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
      jsonText = match ? match[1] : jsonText;
    }
    
    const synthesis: SynthesisData = JSON.parse(jsonText);
    
    // Preencher dados do perfil se faltarem
    if (!synthesis.identificacao.responsavel && userProfile) {
      synthesis.identificacao.responsavel = userProfile.full_name || 'Não informado';
      synthesis.identificacao.cargo = userProfile.role_in_organization || 'Não informado';
      synthesis.identificacao.email = userProfile.email || 'Não informado';
      synthesis.identificacao.telefone = userProfile.telefone_contato || 'Não informado';
    }
    
    console.log('[Synthesis] Gerada com sucesso');
    return synthesis;
    
  } catch (error) {
    console.error('[Synthesis] Erro:', error);
    throw new Error('Falha ao gerar síntese. Tente novamente.');
  }
}
