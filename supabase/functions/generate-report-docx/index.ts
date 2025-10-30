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

Gere um **RELATÓRIO DE LEVANTAMENTO DE CENÁRIO** completo e profissional com MÍNIMO 8.000 CARACTERES.

**DEMANDA:** ${project.name}

**CONVERSAS (Perguntas e Respostas):**

${conversationText}

**DOCUMENTOS ANALISADOS:**

${attachmentsText}

---

**ESTRUTURA OBRIGATÓRIA DO RELATÓRIO (use Markdown):**

# RELATÓRIO DE LEVANTAMENTO DE CENÁRIO

## 1. IDENTIFICAÇÃO
- Órgão responsável
- CNPJ
- Endereço/localização completo
- Contatos (telefone, email)

## 2. CONTEXTO DO PROBLEMA
- Situação atual problemática (descrição detalhada)
- Local exato de ocorrência
- População afetada (quantificada com números)
- Impactos negativos atuais
- Magnitude do problema

## 3. SOLUÇÃO PROPOSTA (HIPÓTESE DE PARTIDA)
- Descrição detalhada da solução escolhida pelo usuário
- Especificações técnicas completas
- Quantitativos estimados
- Prazo de execução
- Local de execução
- Justificativa da escolha desta solução

## 4. OUTRAS HIPÓTESES IDENTIFICADAS
- Listar soluções alternativas mencionadas pelo usuário
- Registrar que devem ser investigadas posteriormente em estudos comparativos
- Comparação preliminar se houver informação disponível

## 5. ASPECTOS TÉCNICOS E LEGAIS
- Normas aplicáveis (Leis, Decretos, Portarias, NBRs)
- Requisitos técnicos obrigatórios
- Competência legal do órgão para esta contratação
- Exigências específicas

## 6. VIABILIDADE
### 6.1 Orçamentária
- Orçamento estimado (valor em R$)
- Fonte de recursos
- Rubrica orçamentária
- Disponibilidade atual

### 6.2 Técnica e Operacional
- Capacidade de gestão do órgão
- Recursos humanos disponíveis
- Infraestrutura necessária

### 6.3 Riscos Identificados
- Principais riscos técnicos
- Riscos financeiros
- Riscos de prazo
- Mitigações propostas

## 7. INFORMAÇÕES COMPLEMENTARES
- Dados para Documento de Formalização da Demanda
- Referências e precedentes
- Soluções similares já implementadas
- Estudos técnicos consultados

## 8. SÍNTESE CONCLUSIVA

**OBRIGATÓRIO: EXATAMENTE 4 PARÁGRAFOS ESTRUTURADOS:**

**O Problema Identificado:**
[Descrever objetivamente qual é o problema, como se manifesta, onde ocorre e por que é um problema que requer solução. Mínimo 200 palavras]

**Os Beneficiários:**
[Identificar claramente quem serão os beneficiados diretos e indiretos, com quantificação precisa. Descrever o perfil da população afetada. Mínimo 150 palavras]

**O Interesse Público:**
[Explicar detalhadamente por que atender essa demanda é de interesse público. Relacionar com princípios constitucionais, políticas públicas vigentes e impactos sociais esperados. Mínimo 200 palavras]

**Consequências da Inação:**
[Descrever objetivamente o que acontecerá se nada for feito. Quais impactos negativos continuarão ou se agravarão. Quantificar perdas e prejuízos quando possível. Mínimo 150 palavras]

---

**REQUISITOS CRÍTICOS:**
1. O relatório DEVE TER NO MÍNIMO 8.000 CARACTERES
2. Use linguagem FORMAL e TÉCNICA de administração pública
3. Seja COMPLETO e DETALHADO - não resuma excessivamente
4. Cite DADOS CONCRETOS e NÚMEROS das respostas do usuário
5. Inclua TRECHOS LITERAIS dos documentos quando relevante
6. Se alguma informação não foi fornecida, indique claramente "Informação não disponível"
7. Mencione a Lei 14.133/2021 quando pertinente
8. Os 4 parágrafos da síntese conclusiva são OBRIGATÓRIOS e devem seguir exatamente a estrutura indicada
9. Cada seção deve ser desenvolvida completamente, não use placeholders
10. Se houver múltiplas hipóteses de solução, destaque a escolhida mas registre as demais`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [{ role: 'user', content: synthesisPrompt }],
        temperature: 0.2,
        max_tokens: 16000
      })
    });

    if (!response.ok) {
      throw new Error(`IA error: ${response.status}`);
    }

    const data = await response.json();
    const reportMarkdown = data.choices[0].message.content;

    // Validar extensão mínima
    if (reportMarkdown.length < 8000) {
      console.warn(`[GenerateReport] ⚠️ Relatório com ${reportMarkdown.length} caracteres (mínimo: 8000)`);
    }

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