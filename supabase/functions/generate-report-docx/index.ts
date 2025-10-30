import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { projectId } = await req.json();
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log(`[GenerateReport] Gerando relatório DOCX para projeto ${projectId}`);

    // 1. Buscar dados do projeto e mensagens
    const { data: project } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    const { data: messages } = await supabase
      .from('demanda_messages')
      .select('*')
      .eq('demanda_id', projectId)
      .order('created_at', { ascending: true });

    // 2. Buscar anexos analisados
    const { data: attachments } = await supabase
      .from('attachments')
      .select('*')
      .eq('demanda_id', projectId);

    // 3. Extrair Q&A
    const conversations = [];
    if (messages && messages.length > 0) {
      for (let i = 0; i < messages.length - 1; i++) {
        if (messages[i].role === 'assistant' && messages[i + 1]?.role === 'user') {
          conversations.push({
            question: messages[i].content,
            answer: messages[i + 1].content,
          });
        }
      }
    }

    // 4. Preparar contexto para síntese
    const conversationText = conversations
      .map((c, i) => `**P${i + 1}:** ${c.question}\n\n**R${i + 1}:** ${c.answer}`)
      .join('\n\n---\n\n');

    const attachmentsText = attachments?.map(a => {
      let text = `📎 **${a.file_name}**\n`;
      if (a.analysis_summary) {
        try {
          const analysis = typeof a.analysis_summary === 'string' 
            ? JSON.parse(a.analysis_summary) 
            : a.analysis_summary;
          if (analysis.resumo_executivo) {
            text += `\n${analysis.resumo_executivo}\n`;
          }
        } catch (e) {
          console.error('Erro ao parsear analysis:', e);
        }
      }
      return text;
    }).join('\n\n') || 'Nenhum documento anexado';

    // 5. Chamar IA para sintetizar
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    const synthesisPrompt = `Você é um especialista em elaboração de documentos técnicos para administração pública brasileira.

Gere um **RELATÓRIO DE CENÁRIO DE CONTRATAÇÃO** completo e profissional com base nas informações coletadas.

**DEMANDA:** ${project.name}

**CONVERSAS (Perguntas e Respostas):**

${conversationText}

**DOCUMENTOS ANALISADOS:**

${attachmentsText}

---

**ESTRUTURA DO RELATÓRIO (use Markdown):**

# RELATÓRIO DE CENÁRIO DE CONTRATAÇÃO

## 1. IDENTIFICAÇÃO

- **Órgão/Entidade:**
- **CNPJ:**
- **Endereço:**
- **Responsável pela demanda:**
- **Data:**

## 2. CONTEXTO E SITUAÇÃO-PROBLEMA

Descreva detalhadamente a situação problemática que motivou esta demanda.

### 2.1 Local de Ocorrência

### 2.2 População Afetada

### 2.3 Impactos Negativos

## 3. SOLUÇÃO PROPOSTA

### 3.1 Descrição do Objeto

### 3.2 Especificações Técnicas Preliminares

### 3.3 Quantitativos Estimados

### 3.4 Local de Execução

## 4. JUSTIFICATIVA TÉCNICA

### 4.1 Fundamentação da Necessidade

### 4.2 Alternativas Consideradas

### 4.3 Critérios de Escolha

## 5. ASPECTOS LEGAIS E NORMATIVOS

### 5.1 Legislação Aplicável

### 5.2 Competência Legal

### 5.3 Exigências Específicas

## 6. VIABILIDADE ORÇAMENTÁRIA E FINANCEIRA

### 6.1 Orçamento Estimado

### 6.2 Fonte de Recursos

### 6.3 Disponibilidade Orçamentária

## 7. ANÁLISE DE VIABILIDADE

### 7.1 Viabilidade Técnica

### 7.2 Viabilidade Econômica

### 7.3 Capacidade de Gestão

### 7.4 Riscos Identificados

## 8. PLANEJAMENTO E PRAZOS

### 8.1 Prazo Estimado de Execução

### 8.2 Cronograma Preliminar

### 8.3 Nível de Urgência

## 9. CONCLUSÃO

### 9.1 Síntese

### 9.2 Recomendações para Próximas Etapas

---

**IMPORTANTE:**
- Use linguagem FORMAL e TÉCNICA de administração pública
- Seja OBJETIVO e COMPLETO
- Cite DADOS CONCRETOS das respostas
- Inclua TRECHOS LITERAIS quando relevante
- Se alguma informação não foi fornecida, indique claramente
- Mencione a Lei 14.133/2021 quando pertinente`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: synthesisPrompt }],
        temperature: 0.3,
        max_tokens: 8000
      })
    });

    if (!response.ok) {
      throw new Error(`IA error: ${response.status}`);
    }

    const data = await response.json();
    const reportMarkdown = data.choices[0].message.content;

    // 6. Salvar relatório no projeto
    await supabase
      .from('projects')
      .update({ 
        structured_data: {
          ...project.structured_data,
          last_report_markdown: reportMarkdown,
          last_report_generated_at: new Date().toISOString()
        }
      })
      .eq('id', projectId);

    console.log(`[GenerateReport] ✅ Relatório gerado`);

    return new Response(
      JSON.stringify({ 
        success: true,
        report: reportMarkdown
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('[GenerateReport] ❌ Erro:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});