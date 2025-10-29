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
    const { fileUrl, fileName, fileType } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    // Usar Gemini Pro para análise de documentos com visão
    const systemPrompt = `Você é um especialista em análise de documentos para contratações públicas.

MISSÃO: Extrair TODO o conteúdo relevante do documento anexado, incluindo:
- Todo texto visível (mesmo em tabelas, gráficos, diagramas)
- Metadados importantes (datas, valores monetários, nomes, números de processos)
- Estrutura do documento (seções, títulos, listas, tabelas)
- Informações-chave para planejamento de contratação:
  * Valores monetários e quantidades
  * Prazos, datas e cronogramas
  * Legislação citada (leis, decretos, portarias com numeração completa)
  * Nomes de pessoas, órgãos, empresas, fornecedores
  * Especificações técnicas e requisitos
  * Obrigações e responsabilidades

FORMATO DE SAÍDA:
Retorne um JSON estruturado com:
{
  "texto_completo": "todo o texto extraído em formato corrido",
  "metadados": {
    "valores": ["lista de valores monetários encontrados"],
    "datas": ["lista de datas encontradas"],
    "legislacao": ["lista de leis, decretos citados"],
    "pessoas_orgaos": ["lista de nomes de pessoas e órgãos"],
    "especificacoes_tecnicas": ["lista de specs técnicas"]
  },
  "estrutura": {
    "secoes": ["lista de seções/títulos do documento"],
    "tabelas": ["descrição de tabelas encontradas"]
  },
  "resumo_executivo": "parágrafo de 3-5 linhas resumindo o documento"
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro", // Pro para análise mais profunda
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analise este documento: ${fileName} (${fileType})`,
              },
              {
                type: "image_url",
                image_url: {
                  url: fileUrl,
                },
              },
            ],
          },
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
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("Erro ao analisar documento");
    }

    const data = await response.json();
    const analysisText = data.choices[0].message.content;

    // Tentar parsear JSON se a IA retornou JSON
    let analysisData;
    try {
      // Extrair JSON do texto (pode vir envolvido em markdown)
      const jsonMatch = analysisText.match(/```json\n([\s\S]*?)\n```/) || analysisText.match(/{[\s\S]*}/);
      if (jsonMatch) {
        analysisData = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      } else {
        analysisData = {
          texto_completo: analysisText,
          resumo_executivo: analysisText.substring(0, 500),
        };
      }
    } catch (e) {
      analysisData = {
        texto_completo: analysisText,
        resumo_executivo: analysisText.substring(0, 500),
      };
    }

    return new Response(
      JSON.stringify({ analysis: analysisData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Análise de documento error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
