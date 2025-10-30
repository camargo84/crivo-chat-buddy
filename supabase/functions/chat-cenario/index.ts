import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, projectId, questionNumber } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    // Buscar documentos anexados e suas análises
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: attachments } = await supabase
      .from("attachments")
      .select("*")
      .eq("demanda_id", projectId)
      .is("deleted_at", null);

    // Construir contexto de documentos
    let documentsContext = "";
    if (attachments && attachments.length > 0) {
      documentsContext = "\n\n═════════════════════════════════════════════════════════════════════════\n";
      documentsContext += "📎 DOCUMENTOS ANEXADOS PELO USUÁRIO - INFORMAÇÕES EXTRAÍDAS:\n";
      documentsContext += "═════════════════════════════════════════════════════════════════════════\n\n";
      
      for (const att of attachments) {
        documentsContext += `\n📄 **ARQUIVO: ${att.file_name}**\n\n`;
        
        if (att.analysis_summary) {
          try {
            const analysis = typeof att.analysis_summary === 'string' 
              ? JSON.parse(att.analysis_summary) 
              : att.analysis_summary;
            
            documentsContext += "**INFORMAÇÕES ESTRUTURADAS IDENTIFICADAS:**\n\n";
            
            if (analysis.identificacao) {
              documentsContext += "🏛️ **ÓRGÃO/ENTIDADE:**\n";
              if (analysis.identificacao.orgao_nome) documentsContext += `- Nome: ${analysis.identificacao.orgao_nome}\n`;
              if (analysis.identificacao.orgao_cnpj) documentsContext += `- CNPJ: ${analysis.identificacao.orgao_cnpj}\n`;
              if (analysis.identificacao.orgao_sigla) documentsContext += `- Sigla: ${analysis.identificacao.orgao_sigla}\n`;
              if (analysis.identificacao.unidade_demandante) documentsContext += `- Unidade: ${analysis.identificacao.unidade_demandante}\n`;
            }
            
            if (analysis.identificacao?.endereco_completo || analysis.identificacao?.logradouro) {
              documentsContext += "\n📍 **ENDEREÇO:**\n";
              if (analysis.identificacao.endereco_completo) documentsContext += `- Completo: ${analysis.identificacao.endereco_completo}\n`;
              if (analysis.identificacao.logradouro) documentsContext += `- Logradouro: ${analysis.identificacao.logradouro}\n`;
              if (analysis.identificacao.numero) documentsContext += `- Número: ${analysis.identificacao.numero}\n`;
              if (analysis.identificacao.bairro) documentsContext += `- Bairro: ${analysis.identificacao.bairro}\n`;
              if (analysis.identificacao.municipio) documentsContext += `- Município: ${analysis.identificacao.municipio}\n`;
              if (analysis.identificacao.uf) documentsContext += `- UF: ${analysis.identificacao.uf}\n`;
              if (analysis.identificacao.cep) documentsContext += `- CEP: ${analysis.identificacao.cep}\n`;
            }
            
            if (analysis.contexto_problema) {
              documentsContext += "\n🎯 **PROBLEMA/NECESSIDADE:**\n";
              if (analysis.contexto_problema.situacao_atual) {
                documentsContext += `${analysis.contexto_problema.situacao_atual}\n`;
              }
            }
            
            if (analysis.solucao_proposta) {
              documentsContext += "\n💡 **SOLUÇÃO PROPOSTA:**\n";
              if (analysis.solucao_proposta.descricao_objeto) {
                documentsContext += `- Objeto: ${analysis.solucao_proposta.descricao_objeto}\n`;
              }
              if (analysis.solucao_proposta.categoria) {
                documentsContext += `- Categoria: ${analysis.solucao_proposta.categoria}\n`;
              }
            }
            
            if (analysis.orcamentario_financeiro?.orcamento_estimado) {
              documentsContext += `\n💰 **ORÇAMENTO:** ${analysis.orcamentario_financeiro.orcamento_estimado}\n`;
            }
            
            if (analysis.aspectos_legais?.normas_aplicaveis?.length > 0) {
              documentsContext += `\n📜 **NORMAS/LEIS:** ${analysis.aspectos_legais.normas_aplicaveis.join(", ")}\n`;
            }
            
            if (analysis.resumo_executivo) {
              documentsContext += `\n📋 **RESUMO:** ${analysis.resumo_executivo}\n`;
            }
            
          } catch (e) {
            console.error("Erro ao parsear analysis_summary:", e);
          }
        }
        
        documentsContext += "\n" + "─".repeat(70) + "\n";
      }
      
      documentsContext += "\n═════════════════════════════════════════════════════════════════════════\n";
    }

    // System prompt ADAPTATIVO
const systemPrompt = `Você é um agente especializado em levantamento de cenário para contratações públicas.

═════════════════════════════════════════════════════════════════════════
🎯 OBJETIVO: COLETAR INFORMAÇÕES PARA RELATÓRIO DE CENÁRIO
═════════════════════════════════════════════════════════════════════════

═════════════════════════════════════════════════════════════════════════
🔴 REGRA CRÍTICA - NUNCA INVENTE DADOS
═════════════════════════════════════════════════════════════════════════

PROIBIDO:
- Inventar CNPJs, nomes de órgãos, endereços ou qualquer dado
- Gerar valores fictícios de orçamento
- Supor informações técnicas
- Criar nomes de responsáveis ou contatos

OBRIGATÓRIO:
- Se não encontrou nos arquivos e o usuário não forneceu, SEMPRE PERGUNTE
- Use EXATAMENTE os dados fornecidos pelo usuário ou extraídos dos documentos
- Se tiver dúvida, PERGUNTE ao invés de SUPOR
- Quando usar "buscar", aguarde o retorno da base de conhecimento antes de responder

═════════════════════════════════════════════════════════════════════════

IMPORTANTE: Para cada pergunta que você fizer, SEMPRE termine com esta instrução entre parênteses:
"(Digite 'buscar' se quiser que eu consulte os arquivos anexados)"

COMPORTAMENTO:
- Conduza conversa profissional, solícita e colaborativa
- Faça perguntas ADAPTATIVAS baseadas no que já foi coletado e no que falta para o relatório
- **SEMPRE termine mensagens com uma pergunta clara ou solicitação de confirmação**
- Identifique lacunas nas informações coletadas
- Registre "Informação não disponível" quando usuário não souber

═════════════════════════════════════════════════════════════════════════
📋 PERGUNTAS INICIAIS OBRIGATÓRIAS (nesta ordem):
═════════════════════════════════════════════════════════════════════════

1. **ÓRGÃO RESPONSÁVEL:** Nome completo, sigla e CNPJ da entidade
2. **ENDEREÇO FÍSICO:** Endereço completo onde ocorre a demanda/problema (logradouro, número, bairro, município, UF, CEP)
3. **PROBLEMA/NECESSIDADE:** Descrição detalhada da situação atual problemática

Após coletar esses 3 elementos essenciais, conduza a conversa de forma ADAPTATIVA para obter:

═════════════════════════════════════════════════════════════════════════
📊 INFORMAÇÕES NECESSÁRIAS PARA O RELATÓRIO FINAL:
═════════════════════════════════════════════════════════════════════════

**CONTEXTO DO PROBLEMA:**
- População afetada (quantificada)
- Impactos negativos atuais
- Magnitude do problema

**SOLUÇÃO PROPOSTA (HIPÓTESE DE PARTIDA):**
- Descrição detalhada da solução escolhida
- Especificações técnicas
- Quantitativos estimados
- Prazo de execução
- Justificativa da escolha

**OUTRAS HIPÓTESES:**
- Soluções alternativas mencionadas
- Se houver múltiplas hipóteses, pergunte: "Você mencionou algumas soluções. Qual considera a melhor candidata para ser a HIPÓTESE DE PARTIDA? O relatório dará destaque a ela, mas registrará que outras hipóteses emergiram."

**ASPECTOS TÉCNICOS E LEGAIS:**
- Normas aplicáveis
- Requisitos técnicos
- Competência legal do órgão

**VIABILIDADE:**
- Orçamento estimado
- Fonte de recursos
- Capacidade de gestão do órgão
- Riscos identificados

**INFORMAÇÕES COMPLEMENTARES:**
- Referências e precedentes
- Soluções anteriores implementadas

═════════════════════════════════════════════════════════════════════════
🔴 REGRA FUNDAMENTAL - NUNCA PERGUNTAR O QUE JÁ SABE
═════════════════════════════════════════════════════════════════════════

Antes de fazer QUALQUER pergunta:
1. VERIFICAR se a informação já foi extraída de documentos anexados
2. SE JÁ TEM A INFORMAÇÃO: APRESENTAR + PEDIR CONFIRMAÇÃO
3. SE NÃO TEM: FAZER A PERGUNTA NORMALMENTE

EXEMPLO CORRETO:
❌ ERRADO: "Qual é o órgão responsável?"
✅ CORRETO: "📄 No documento 'Cenario.pdf' identifiquei:

**ÓRGÃO:** Prefeitura Municipal de São Paulo
**CNPJ:** 46.395.000/0001-39

Esta informação está correta? (Responda 'sim' para confirmar ou corrija se necessário)

(Digite 'buscar' se quiser que eu consulte os arquivos anexados)"

${documentsContext}

PERGUNTA ATUAL: ${questionNumber}

**CRÍTICO:** SEMPRE termine com uma pergunta clara que exija resposta do usuário ou confirmação.
NUNCA envie mensagens apenas informativas sem solicitar interação.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: questionNumber <= 5 ? "google/gemini-2.5-flash" : "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        temperature: 0.3,
        max_tokens: 3096,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace Lovable." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("Erro ao comunicar com IA");
    }

    const data = await response.json();
    const aiMessage = data.choices[0].message.content;

    // Salvar mensagem da IA no banco
    const { data: savedMessage, error: saveError } = await supabase
      .from("demanda_messages")
      .insert({
        demanda_id: projectId,
        role: "assistant",
        content: aiMessage,
        metadata: {
          question_number: questionNumber,
          model: "google/gemini-2.5-pro",
        },
      })
      .select()
      .single();

    if (saveError) {
      console.error("Erro ao salvar mensagem:", saveError);
    }

    return new Response(
      JSON.stringify({ 
        message: aiMessage,
        savedMessage,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Chat cenário error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
