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
    const { demanda_id, question } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    console.log(`[RAG] Buscando resposta para: "${question}"`);

    // Buscar todos os arquivos com conteúdo extraído
    const { data: attachments } = await supabase
      .from("attachments")
      .select("*")
      .eq("demanda_id", demanda_id)
      .not("extracted_content", "is", null)
      .is("deleted_at", null);

    if (!attachments || attachments.length === 0) {
      return new Response(
        JSON.stringify({
          found: false,
          answer: "Nenhum arquivo com conteúdo extraído disponível para consulta.",
          source_file: null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Construir contexto dos documentos
    let documentsContext = "DOCUMENTOS DISPONÍVEIS:\n\n";
    for (const att of attachments) {
      documentsContext += `=== ARQUIVO: ${att.file_name} ===\n`;
      documentsContext += `${att.extracted_content}\n\n`;
      documentsContext += "---\n\n";
    }

    // Usar Gemini 2.5 Pro para buscar a resposta
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const ragPrompt = `Você é um assistente especializado em buscar informações específicas em documentos de contratação pública.

PERGUNTA DO USUÁRIO:
"${question}"

${documentsContext}

INSTRUÇÕES:
1. Procure a resposta específica à pergunta nos documentos acima
2. Se encontrar, cite o nome do arquivo e transcreva literalmente o trecho relevante
3. Se NÃO encontrar informação suficiente, indique claramente que não foi encontrado
4. Seja preciso e objetivo

FORMATO DA RESPOSTA:
- Se encontrou: "No arquivo [NOME], encontrei: [TRECHO LITERAL]. [Explicação se necessário]"
- Se não encontrou: "Não encontrei informação específica sobre isso nos arquivos anexados."`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [{ role: "user", content: ragPrompt }],
        temperature: 0.3,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI error: ${response.status}`);
    }

    const data = await response.json();
    const answer = data.choices[0].message.content;

    // Determinar se encontrou informação relevante
    const found = !answer.toLowerCase().includes("não encontrei");
    const sourceFile = found ? attachments[0].file_name : null;

    console.log(`[RAG] ${found ? "✅ Encontrado" : "❌ Não encontrado"}`);

    return new Response(
      JSON.stringify({
        found,
        answer,
        source_file: sourceFile,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("[RAG] Erro:", error);
    return new Response(
      JSON.stringify({
        found: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
