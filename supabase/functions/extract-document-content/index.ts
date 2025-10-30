import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import JSZip from "https://esm.sh/jszip@3.10.1";

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

    console.log(`[ExtractDocument] 📄 Iniciando processamento: ${fileName}`);
    console.log(`[ExtractDocument] 📋 Tipo: ${fileType}`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Baixar arquivo
    console.log(`[ExtractDocument] 📥 Baixando arquivo...`);
    const fileResponse = await fetch(fileUrl);
    if (!fileResponse.ok) {
      throw new Error(`Erro ao baixar arquivo: ${fileResponse.status}`);
    }

    const fileBuffer = await fileResponse.arrayBuffer();
    console.log(`[ExtractDocument] ✅ Arquivo baixado: ${fileBuffer.byteLength} bytes`);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    let extractedText = "";

    // Detectar tipo de arquivo
    const isImage = fileType.startsWith("image/");
    const isPDF = fileType === "application/pdf";
    const isDOCX = fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    const isText = fileType === "text/plain" || fileType === "text/csv" || fileType === "text/markdown";

    // ==================== EXTRAÇÃO NATIVA DE TEXTO ====================

    if (isDOCX) {
      console.log("[ExtractDocument] 📝 Extraindo texto de DOCX com JSZip...");
      try {
        const zip = await JSZip.loadAsync(fileBuffer);
        const xmlFile = zip.file("word/document.xml");
        
        if (!xmlFile) {
          throw new Error("Arquivo DOCX inválido: word/document.xml não encontrado");
        }
        
        const xmlContent = await xmlFile.async("text");
        const textNodes = xmlContent.match(/<w:t[^>]*>([^<]+)<\/w:t>/g) || [];
        extractedText = textNodes
          .map((node) => node.replace(/<[^>]+>/g, ""))
          .join(" ");
        
        console.log(`[ExtractDocument] ✅ DOCX extraído: ${extractedText.length} caracteres`);
      } catch (e) {
        console.error("[ExtractDocument] ❌ Erro ao extrair DOCX:", e);
        throw new Error(`Falha ao extrair texto do DOCX: ${e instanceof Error ? e.message : "Erro desconhecido"}`);
      }
    } else if (isText) {
      console.log("[ExtractDocument] 📄 Decodificando arquivo de texto...");
      extractedText = new TextDecoder().decode(fileBuffer);
      console.log(`[ExtractDocument] ✅ Texto decodificado: ${extractedText.length} caracteres`);
    } else if (isPDF || isImage) {
      // Para PDF e Imagens: usar Gemini com base64
      console.log(`[ExtractDocument] 🤖 Processando ${isPDF ? 'PDF' : 'imagem'} com Gemini Vision...`);
      
      const base64Content = btoa(String.fromCharCode(...new Uint8Array(fileBuffer)));
      
      const extractPrompt = `Analise este ${isPDF ? 'documento PDF' : 'imagem'} detalhadamente e extraia TODO o texto visível.

**Se for documento escaneado/foto de documento:**
- Aplique OCR para extrair texto (mesmo que manuscrito ou de baixa qualidade)
- Mantenha estrutura, formatação, numeração, tabelas
- Identifique: títulos, subtítulos, parágrafos, listas, rodapés, assinaturas
- Destaque: órgãos, CNPJs, endereços, telefones, e-mails, valores, datas
- Transcreva artigos, incisos, parágrafos com numeração

**Se for planta/diagrama/croqui técnico:**
- Descreva o que está representado
- Identifique medidas, cotas, legendas
- Liste elementos técnicos (portas, janelas, equipamentos, etc.)
- Mencione escalas se houver

**Se for foto de local/situação:**
- Descreva o que está visível
- Identifique problemas aparentes (deterioração, danos, etc.)
- Mencione condições do local
- Liste elementos relevantes para uma obra ou serviço

**Se for tabela/planilha:**
- Transcreva todos os dados mantendo estrutura de linhas e colunas
- Identifique cabeçalhos e totais
- Preserve formatação de valores (R$, %, etc.)

Seja extremamente detalhado e preciso. Extraia TODO o texto, incluindo texto pequeno ou de difícil leitura.`;

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
          temperature: 0.3,
          max_tokens: 8192,
        }),
      });

      if (!extractResponse.ok) {
        if (extractResponse.status === 429) {
          throw new Error("Rate limit atingido. Aguarde alguns segundos e tente novamente.");
        }
        if (extractResponse.status === 402) {
          throw new Error("Créditos Lovable AI insuficientes. Adicione em Settings > Workspace > Usage.");
        }
        const errorText = await extractResponse.text();
        console.error("[ExtractDocument] ❌ Erro na API Gemini:", errorText);
        throw new Error(`Erro na API: ${extractResponse.status} - ${errorText}`);
      }

      const extractData = await extractResponse.json();
      extractedText = extractData.choices?.[0]?.message?.content || "";
      console.log(`[ExtractDocument] ✅ ${isPDF ? 'PDF' : 'Imagem'} processado: ${extractedText.length} caracteres extraídos`);
    } else {
      throw new Error(`Tipo de arquivo não suportado: ${fileType}`);
    }

    // Validar conteúdo extraído
    if (!extractedText || extractedText.length < 20) {
      console.warn("[ExtractDocument] ⚠️ Conteúdo extraído muito curto");
      throw new Error("Não foi possível extrair conteúdo significativo do arquivo");
    }

    console.log(`[ExtractDocument] 📊 Total extraído: ${extractedText.length} caracteres`);

    // ==================== ANÁLISE ESTRUTURADA COM IA ====================

    let analysisJson;

    if (extractedText.length < 50) {
      console.log("[ExtractDocument] ⚠️ Conteúdo muito curto, análise simplificada");
      analysisJson = {
        identificacao: {
          orgao_nome: "Não extraído - informar manualmente",
          observacao: `Arquivo ${fileName} anexado. Conteúdo insuficiente para análise automática.`,
        },
        resumo_executivo: `Documento ${fileName} foi anexado. O agente solicitará as informações através das perguntas.`,
      };
    } else {
      console.log("[ExtractDocument] 🤖 Analisando conteúdo com Gemini Flash...");
      
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
          model: "google/gemini-2.5-flash",
          messages: [{ role: "user", content: analysisPrompt }],
          temperature: 0.3,
          max_tokens: 4096,
        }),
      });

      if (!analysisResponse.ok) {
        if (analysisResponse.status === 429) {
          throw new Error("Rate limit atingido durante análise. Aguarde alguns segundos.");
        }
        if (analysisResponse.status === 402) {
          throw new Error("Créditos Lovable AI insuficientes. Adicione em Settings > Workspace > Usage.");
        }
        const errorText = await analysisResponse.text();
        console.error("[ExtractDocument] ❌ Erro na análise:", errorText);
        throw new Error(`Erro na análise: ${analysisResponse.status}`);
      }

      const analysisData = await analysisResponse.json();
      let analysisText = analysisData.choices?.[0]?.message?.content || "{}";

      // Limpar markdown se houver
      analysisText = analysisText
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();

      try {
        analysisJson = JSON.parse(analysisText);
        console.log("[ExtractDocument] ✅ Análise estruturada gerada com sucesso");
      } catch (e) {
        console.error("[ExtractDocument] ❌ JSON inválido retornado pela IA:", e);
        console.error("[ExtractDocument] 📄 Conteúdo recebido:", analysisText.substring(0, 500));
        analysisJson = { 
          resumo_executivo: "Falha ao estruturar análise - formato JSON inválido",
          erro_parsing: String(e)
        };
      }
    }

    // ==================== SALVAR NO BANCO ====================

    console.log("[ExtractDocument] 💾 Salvando no banco de dados...");

    const { error: updateError } = await supabase
      .from("attachments")
      .update({
        extracted_content: extractedText.substring(0, 50000),
        analysis_summary: JSON.stringify(analysisJson, null, 2),
      })
      .eq("id", attachmentId);

    if (updateError) {
      console.error("[ExtractDocument] ❌ Erro ao salvar:", updateError);
      throw updateError;
    }

    // Incrementar contador
    await supabase.rpc("increment_files_analyzed", { project_id_param: projectId });

    console.log(`[ExtractDocument] ✅ ✅ ✅ Processamento concluído: ${fileName}`);
    console.log(`[ExtractDocument] 📊 Resumo: ${extractedText.length} caracteres extraídos`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        extractedLength: extractedText.length, 
        analysis: analysisJson 
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" }, 
        status: 200 
      }
    );

  } catch (error) {
    console.error("[ExtractDocument] ❌ ❌ ❌ ERRO FATAL:", error);
    console.error("[ExtractDocument] 📋 Stack:", error instanceof Error ? error.stack : "N/A");
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Erro desconhecido" 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
