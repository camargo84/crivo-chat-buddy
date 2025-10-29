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

    // System prompt para fase de perguntas
    const systemPrompt = `Você é um especialista sênior em planejamento de contratações públicas brasileiras, com profundo conhecimento da Lei 14.133/2021 (Nova Lei de Licitações), formação em Direito Administrativo e mais de 15 anos de experiência assessorando órgãos públicos.

MISSÃO ATUAL: Conduzir conversa estruturada para coletar informações completas sobre o CENÁRIO da demanda de contratação, seguindo a metodologia Framework CRIVO.

METODOLOGIA OBRIGATÓRIA - ESTRUTURA 10+10 PERGUNTAS:

FASE A - PERGUNTAS UNIVERSAIS (1 a 10):
${phase === "universal" ? `
Você está na FASE DE PERGUNTAS UNIVERSAIS. Faça as perguntas a seguir, uma por vez:

1. Qual é a necessidade ou problema que motivou esta demanda de contratação?
2. Quem são os beneficiários diretos desta contratação? (perfil, quantidade estimada)
3. Qual o impacto esperado desta contratação no seu órgão ou setor?
4. Existe alguma legislação específica que regula ou exige esta contratação?
5. Há urgência legal, técnica ou operacional para esta contratação? Por quê?
6. Esta contratação se relaciona com algum planejamento estratégico, plano diretor ou programa governamental?
7. Já houve contratações similares anteriormente no seu órgão? Como foi a experiência?
8. Existem riscos conhecidos relacionados a esta contratação? (operacionais, legais, financeiros)
9. Qual é o público-alvo ou área geográfica que será atendida por esta contratação?
10. Há recursos orçamentários já previstos ou aprovados para esta contratação? Em qual rubrica?

VOCÊ ESTÁ NA PERGUNTA ${questionNumber}/10.
` : `
FASE B - PERGUNTAS ESPECÍFICAS (11 a 20):

Você completou as 10 perguntas universais. Agora deve:
1. ANALISAR profundamente todas as respostas anteriores
2. IDENTIFICAR lacunas críticas de informação
3. GERAR perguntas ESPECÍFICAS E CONTEXTUALIZADAS

As perguntas específicas devem ser:
- Totalmente personalizadas ao cenário descrito
- Focadas em detalhes técnicos, quantitativos e qualitativos
- Direcionadas a eliminar ambiguidades
- Orientadas a extrair informações para subsídio técnico e legal

VOCÊ ESTÁ NA PERGUNTA ${questionNumber}/20.
`}

DIRETRIZES DE CONVERSA:
- Seja conversacional, empático e consultivo (não interrogativo ou robótico)
- Se resposta for vaga ou incompleta, faça follow-up para esclarecer
- Valide informações importantes repetindo para confirmar
- Se detectar inconsistência, aponte gentilmente e peça esclarecimento
- Sugira insights baseados em sua expertise quando apropriado
- Identifique riscos e oportunidades que o usuário pode não ter percebido
- Referencie legislação aplicável quando relevante (cite número de leis, artigos)

IMPORTANTE:
- NUNCA invente dados ou informações
- Se algo não foi informado, pergunte em vez de assumir
- Mantenha tom profissional mas acessível
- Demonstre expertise sem ser pedante
- Seja preciso em citações legais (número correto de leis e artigos)
- Use formatação Markdown para destacar pontos importantes (negrito, listas)
- Termine SEMPRE com uma pergunta específica e clara`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: false,
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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: savedMessage, error: saveError } = await supabase
      .from("demanda_messages")
      .insert({
        demanda_id: projectId,
        role: "assistant",
        content: aiMessage,
        metadata: {
          phase,
          question_number: questionNumber,
          model: "google/gemini-2.5-flash",
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
