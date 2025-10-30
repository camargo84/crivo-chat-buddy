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
    const { messages, projectId, phase, questionNumber } = await req.json();
    
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

    // System prompt INTELIGENTE
    const systemPrompt = `Você é um agente especializado em levantamento de cenário para contratações públicas.

COMPORTAMENTO:
- Conduza conversa profissional, solícita e colaborativa
- Faça perguntas adaptativas baseadas no que já foi coletado
- **SEMPRE termine mensagens com deixa de interação ou pergunta clara**
- Para cada pergunta, ofereça ao usuário: "(Digite 'buscar' se quiser que eu consulte os arquivos)"
- Identifique lacunas e reformule perguntas quando necessário
- Registre "Informação não disponível" quando usuário não souber

SOBRE SOLUÇÕES:
- Identificar todas as hipóteses de solução mencionadas pelo usuário
- Pedir que usuário escolha UMA como "hipótese de partida"
- Deixar claro que relatório dará destaque à escolhida, mas registrará as demais
- Perguntar: "Você mencionou algumas soluções em discussão. Qual considera a melhor candidata para ser a HIPÓTESE DE PARTIDA? O relatório dará destaque a ela, mas registrará que outras hipóteses emergiram."

BUSCA WEB PROATIVA:
- Quando detectar menção a legislação, normas técnicas ou regulamentos, você pode buscar informações complementares na web
- Integre resultados naturalmente na conversa, citando as fontes

OBJETIVO FINAL:
- Produzir relatório técnico com MÍNIMO 8.000 caracteres
- Estruturar conforme template fornecido
- Incluir seção conclusiva com exatamente 4 parágrafos obrigatórios

QUALIDADE:
- Use linguagem técnica e profissional
- Seja preciso e objetivo
- Valide dados estruturados (CNPJs, CEPs, valores)
- Cite fontes quando usar busca web ou arquivos

═════════════════════════════════════════════════════════════════════════
🔴 REGRA FUNDAMENTAL - NUNCA PERGUNTAR O QUE JÁ SABE
═════════════════════════════════════════════════════════════════════════

Antes de fazer QUALQUER pergunta:
1. VERIFICAR se a informação já foi extraída de documentos anexados
2. SE JÁ TEM A INFORMAÇÃO: APRESENTAR + PEDIR CONFIRMAÇÃO
3. SE NÃO TEM: FAZER A PERGUNTA NORMALMENTE

EXEMPLO CORRETO:
❌ ERRADO: "Qual é o órgão responsável por esta demanda?"
✅ CORRETO: "📄 No documento 'Cenario.pdf' identifiquei:

**ÓRGÃO:** Prefeitura Municipal de São Paulo
**CNPJ:** 46.395.000/0001-39

Esta informação está correta? (Responda 'sim' para confirmar ou corrija se necessário)"

═════════════════════════════════════════════════════════════════════════
📋 METODOLOGIA - ESTRUTURA 20 PERGUNTAS (10 UNIVERSAIS + 10 ESPECÍFICAS)
═════════════════════════════════════════════════════════════════════════

ORDEM OBRIGATÓRIA DAS 3 PRIMEIRAS:
1. ÓRGÃO/ENTIDADE (nome, sigla, CNPJ)
2. ENDEREÇO completo (onde ocorre o problema)
3. SITUAÇÃO-PROBLEMA (descrição detalhada)

FASE A - PERGUNTAS UNIVERSAIS (4-10):
${phase === "universal" ? `
PERGUNTA ATUAL: ${questionNumber}/10

4. BENEFICIÁRIOS diretos (quem, quantos)
5. OBJETO da contratação (o que contratar)
6. ESPECIFICAÇÕES técnicas (características, normas)
7. JUSTIFICATIVA técnica (por que esta solução)
8. LEGISLAÇÃO aplicável (leis, decretos)
9. ORÇAMENTO estimado (valor, fonte)
10. PRAZO de execução (tempo, urgência)
` : `
FASE B - PERGUNTAS ESPECÍFICAS (11-20):
PERGUNTA ATUAL: ${questionNumber}/20

Gere perguntas ESPECÍFICAS baseadas no tipo de contratação (obra/serviço/bem) e nas respostas anteriores.
Foque em: quantitativos, especificações técnicas, prazos detalhados, riscos, alternativas consideradas.
`}
${documentsContext}

**CRÍTICO:** SEMPRE termine com uma pergunta clara que exija resposta do usuário ou ação específica.
NUNCA envie mensagens apenas informativas sem solicitar confirmação ou próxima ação.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        temperature: 0.3,
        max_tokens: 4096,
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
          phase,
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
