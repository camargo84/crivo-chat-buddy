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

    // Buscar arquivos com conteúdo JÁ EXTRAÍDO
    const { data: attachments, error: fetchError } = await supabase
      .from("attachments")
      .select("*")
      .eq("demanda_id", demanda_id)
      .is("deleted_at", null)
      .not("extracted_content", "is", null)
      .order("created_at", { ascending: false });

    if (fetchError) {
      console.error("[RAG] Erro ao buscar attachments:", fetchError);
      throw fetchError;
    }

    if (!attachments || attachments.length === 0) {
      console.log("[RAG] Nenhum arquivo processado encontrado");
      return new Response(
        JSON.stringify({
          found: false,
          answer: `Você ainda não anexou nenhum arquivo processado, ou o processamento ainda está em andamento.
          
💡 **Aguarde alguns segundos** após o upload para que os documentos sejam analisados.

Se já anexou há mais de 1 minuto e continua vendo esta mensagem, pode haver um problema no processamento. Tente anexar novamente em formatos mais simples (PDF de texto, PNG, DOCX).`,
          source_file: null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Montar contexto com conteúdo já extraído
    let documentsContext = "=== BASE DE CONHECIMENTO ===\n\n";

    for (const att of attachments) {
      documentsContext += `📄 ARQUIVO: ${att.file_name}\n`;
      documentsContext += `CONTEÚDO:\n${att.extracted_content}\n\n`;
      documentsContext += "---\n\n";
    }

    console.log(`[RAG] Contexto montado com ${attachments.length} arquivo(s)`);

    if (documentsContext === "=== BASE DE CONHECIMENTO ===\n\n") {
      return new Response(
        JSON.stringify({
          found: false,
          answer: `Não consegui processar os arquivos anexados no momento. 

**Alguns motivos possíveis:**
- Os arquivos podem estar corrompidos
- Formato não totalmente suportado
- Erro temporário no processamento

**O que você pode fazer:**
1. Fornecer a informação diretamente na resposta
2. Verificar se os arquivos foram anexados corretamente
3. Tentar anexar novamente ou usar outro formato (PDF, PNG, JPG, DOCX)

Você poderia fornecer a resposta diretamente?`,
          source_file: null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Usar Gemini Flash para buscar a resposta (mais rápido e econômico)
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const ragPrompt = `Você é um assistente especializado em análise de documentos de contratação pública.

PERGUNTA DO USUÁRIO:
"${question}"

DOCUMENTOS DISPONÍVEIS:
${documentsContext}

INSTRUÇÕES:
1. Procure a resposta exata nos documentos
2. Se encontrar, cite o arquivo de origem e copie o texto exato
3. Se não encontrar, responda: "Não encontrei essa informação nos documentos anexados"
4. NUNCA invente ou suponha informações que não estão nos documentos

Responda de forma clara e objetiva.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: ragPrompt }],
        temperature: 0.3,
        max_tokens: 2048,
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
