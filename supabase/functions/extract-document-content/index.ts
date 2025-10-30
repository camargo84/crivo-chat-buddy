import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { attachmentId, fileUrl, fileType, fileName, projectId } = await req.json();

    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    console.log(`[ExtractDocument] Processando: ${fileName}`);

    // Baixar arquivo
    const fileResponse = await fetch(fileUrl);
    if (!fileResponse.ok) throw new Error("Erro ao baixar arquivo");

    const fileBuffer = await fileResponse.arrayBuffer();
    const base64Content = btoa(String.fromCharCode(...new Uint8Array(fileBuffer)));

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    let extractedText = "";

    // PASSO 1: Detectar tipo de arquivo e escolher método apropriado
    const isImage = fileType.startsWith("image/");
    const isPDF = fileType === "application/pdf";
    const isDOCX = fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    const extractPrompt = `Extraia TODO o texto deste documento em português, mantendo estrutura, formatação, numeração.
Inclua: títulos, subtítulos, parágrafos, listas, tabelas, rodapés, artigos, incisos.
Destaque: órgãos, CNPJs, endereços, telefones, valores, datas.`;

    if (isImage) {
      // Para IMAGENS: usar Gemini Flash Image Preview
      console.log("[ExtractDocument] Processando imagem com Gemini Flash Image Preview");

      const extractResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: extractPrompt },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${fileType};base64,${base64Content}`,
                  },
                },
              ],
            },
          ],
          max_tokens: 8192,
        }),
      });

      if (!extractResponse.ok) {
        const errorText = await extractResponse.text();
        console.error("[ExtractDocument] Erro na extração:", errorText);
        throw new Error(`Erro na API: ${extractResponse.status} - ${errorText}`);
      }

      const extractData = await extractResponse.json();
      extractedText = extractData.choices?.[0]?.message?.content || "";
    } else if (isPDF || isDOCX) {
      // Para PDFs e DOCX: criar placeholder até implementar processamento completo
      console.log(`[ExtractDocument] Arquivo ${isPDF ? "PDF" : "DOCX"} recebido - aguardando entrada manual`);

      extractedText = `[Documento ${isPDF ? "PDF" : "DOCX"}: ${fileName}]

📄 Arquivo anexado com sucesso!

O agente irá coletar as informações necessárias através das perguntas.
Por favor, responda às perguntas do agente com base no conteúdo deste documento.

Informações do arquivo:
- Nome: ${fileName}
- Tipo: ${isPDF ? "PDF" : "Word (.docx)"}
- Tamanho: ${(fileBuffer.byteLength / 1024).toFixed(2)} KB

Você pode baixar o arquivo a qualquer momento através da barra lateral.`;
    } else {
      // Tipo de arquivo não suportado
      throw new Error(`Tipo de arquivo não suportado: ${fileType}`);
    }

    if (!extractedText || extractedText.length < 20) {
      throw new Error("Não foi possível processar o arquivo");
    }

    // PASSO 2: Análise estruturada usando GPT-5 Mini (apenas se há conteúdo real extraído)
    let analysisJson;

    if (isPDF || isDOCX || extractedText.startsWith("[Documento")) {
      // Para arquivos que não foram totalmente processados, criar estrutura básica
      analysisJson = {
        identificacao: {
          orgao_nome: "Não extraído - informar manualmente",
          observacao: `Arquivo ${fileName} anexado. Informações serão coletadas via perguntas.`,
        },
        resumo_executivo: `Documento ${fileName} foi anexado. O agente solicitará as informações através das perguntas.`,
      };

      console.log("[ExtractDocument] Análise simplificada para arquivo não processado");
    } else {
      // Para imagens com conteúdo extraído, fazer análise completa
      const analysisPrompt = `Analise este documento de contratação pública e estruture em JSON:

{
  "identificacao": {
    "orgao_nome": "Nome completo do órgão/entidade",
    "orgao_cnpj": "CNPJ formato 00.000.000/0000-00",
    "orgao_sigla": "Sigla",
    "unidade_demandante": "Setor/Departamento demandante",
    "endereco_completo": "Endereço completo onde ocorre o problema",
    "logradouro": "Rua/Av",
    "numero": "Nº",
    "bairro": "Bairro",
    "municipio": "Município",
    "uf": "UF",
    "cep": "CEP",
    "contatos": ["Telefones e emails"]
  },
  "contexto_problema": {
    "situacao_atual": "Descrição da situação problemática",
    "local_ocorrencia": "Onde exatamente ocorre o problema",
    "populacao_afetada": "Quem é diretamente afetado",
    "quantidade_beneficiarios": "Estimativa numérica",
    "impactos_negativos": ["Lista de impactos se não resolver"],
    "urgencia": "Nível de urgência (alta/média/baixa)"
  },
  "solucao_proposta": {
    "descricao_objeto": "O que precisa ser contratado/adquirido",
    "categoria": "Obra/Serviço/Bem",
    "especificacoes_tecnicas": ["Características técnicas necessárias"],
    "quantitativos": ["Quantidades estimadas"],
    "prazo_execucao": "Prazo esperado",
    "local_execucao": "Onde será executado"
  },
  "justificativa_tecnica": {
    "fundamentacao": "Por que esta solução é adequada",
    "alternativas_consideradas": ["Outras opções avaliadas"],
    "criterios_escolha": "Critérios para escolher esta solução"
  },
  "aspectos_legais": {
    "normas_aplicaveis": ["Leis, decretos, normas técnicas"],
    "competencia_legal": "Fundamentação de competência do órgão",
    "exigencias_especificas": ["Requisitos legais obrigatórios"]
  },
  "orcamentario_financeiro": {
    "orcamento_estimado": "Valor total estimado R$",
    "fonte_recursos": "De onde virão os recursos",
    "rubrica_orcamentaria": "Classificação orçamentária",
    "disponibilidade": "Recursos já disponíveis?"
  },
  "viabilidade": {
    "analise_tecnica": "Viabilidade técnica",
    "analise_economica": "Viabilidade econômica",
    "capacidade_gestao": "Órgão tem capacidade de gerir?",
    "riscos_identificados": ["Principais riscos"]
  },
  "referencias_documentais": {
    "leis_normas": ["Referências legais mencionadas"],
    "estudos_tecnicos": ["Estudos ou pareceres citados"],
    "precedentes": ["Contratações similares anteriores"]
  },
  "trechos_literais": {
    "objeto_descrito": "Trecho sobre o objeto",
    "justificativa": "Trecho da justificativa",
    "orgao_competente": "Trecho sobre competência"
  },
  "resumo_executivo": "Resumo objetivo em 200-300 palavras"
}

IMPORTANTE: Retorne APENAS JSON puro, sem markdown.

Documento:
${extractedText.substring(0, 30000)}`;

      const analysisResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openai/gpt-5-mini",
          messages: [{ role: "user", content: analysisPrompt }],
          max_completion_tokens: 4096,
        }),
      });

      const analysisData = await analysisResponse.json();
      let analysisText = analysisData.choices?.[0]?.message?.content || "{}";

      analysisText = analysisText
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();

      try {
        analysisJson = JSON.parse(analysisText);
      } catch (e) {
        console.error("[ExtractDocument] JSON inválido:", e);
        analysisJson = { resumo_executivo: "Falha ao estruturar análise" };
      }
    }

    // Atualizar attachment
    await supabase
      .from("attachments")
      .update({
        extracted_content: extractedText.substring(0, 50000),
        analysis_summary: JSON.stringify(analysisJson, null, 2),
      })
      .eq("id", attachmentId);

    // Incrementar contador
    await supabase.rpc("increment_files_analyzed", { project_id_param: projectId });

    console.log(`[ExtractDocument] ✅ Concluído: ${fileName}`);

    return new Response(
      JSON.stringify({ success: true, extractedLength: extractedText.length, analysis: analysisJson }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    console.error("[ExtractDocument] ❌ Erro:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
