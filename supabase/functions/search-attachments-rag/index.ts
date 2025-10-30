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

    // Buscar todos os arquivos anexados (SEM exigir extracted_content)
    const { data: attachments } = await supabase
      .from("attachments")
      .select("*")
      .eq("demanda_id", demanda_id)
      .is("deleted_at", null);

    if (!attachments || attachments.length === 0) {
      return new Response(
        JSON.stringify({
          found: false,
          answer: `Você ainda não anexou nenhum arquivo. 
          
Por favor, use o botão de clipe 📎 para anexar documentos relacionados à demanda (editais, termos de referência, estudos, plantas, fotos, etc.).

Após anexar os arquivos, digite 'buscar' novamente e eu consultarei o conteúdo para responder à pergunta.`,
          source_file: null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    console.log(`[RAG] Encontrados ${attachments.length} arquivos. Processando em tempo real...`);

    // Baixar e processar arquivos em tempo real
    let documentsContext = "DOCUMENTOS DISPONÍVEIS:\n\n";
    
    for (const att of attachments) {
      try {
        console.log(`[RAG] Baixando arquivo: ${att.file_name}`);
        
        // Baixar arquivo do Storage
        const fileResponse = await fetch(att.storage_url);
        if (!fileResponse.ok) {
          console.error(`[RAG] Erro ao baixar ${att.file_name}`);
          continue;
        }

        const fileBlob = await fileResponse.blob();
        const buffer = await fileBlob.arrayBuffer();
        const base64Content = btoa(String.fromCharCode(...new Uint8Array(buffer)));

        console.log(`[RAG] Extraindo conteúdo de ${att.file_name} com Gemini 2.5 Pro...`);

        // Extrair conteúdo com Gemini 2.5 Pro
        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
        const extractResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-pro",
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: `Extraia TODO o texto deste documento. Mantenha a estrutura original e seja completo.`
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:${att.file_type};base64,${base64Content}`
                    }
                  }
                ]
              }
            ],
            temperature: 0.1,
            max_tokens: 8192,
          }),
        });

        if (extractResponse.ok) {
          const extractData = await extractResponse.json();
          const extractedText = extractData.choices[0].message.content;
          
          documentsContext += `=== ARQUIVO: ${att.file_name} ===\n`;
          documentsContext += `${extractedText}\n\n`;
          documentsContext += "---\n\n";
          
          console.log(`[RAG] ✅ Conteúdo extraído de ${att.file_name}`);
        } else {
          console.error(`[RAG] Falha na extração de ${att.file_name}`);
        }

      } catch (error) {
        console.error(`[RAG] Erro ao processar ${att.file_name}:`, error);
      }
    }

    if (documentsContext === "DOCUMENTOS DISPONÍVEIS:\n\n") {
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
