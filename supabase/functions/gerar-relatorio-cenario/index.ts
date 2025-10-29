import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { conversationHistory, attachments, projectInfo } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    const systemPrompt = `Você é um especialista em elaboração de documentos técnicos para contratações públicas.

MISSÃO: Gerar um RELATÓRIO TÉCNICO PROFISSIONAL DE CARACTERIZAÇÃO DO CENÁRIO seguindo EXATAMENTE a estrutura fornecida.

Com base em TODA a conversa realizada e TODOS os documentos anexados, gere o relatório seguindo o template completo.

ESTRUTURA OBRIGATÓRIA:

# RELATÓRIO DE CARACTERIZAÇÃO DO CENÁRIO
## Framework CRIVO - Lei 14.133/2021

---

**IDENTIFICAÇÃO DA DEMANDA**

| Campo | Informação |
|-------|-----------|
| **Órgão/Entidade** | ${projectInfo.organizacao || "[Nome do órgão]"} |
| **Unidade Requisitante** | ${projectInfo.unidade || "[Setor/Secretaria]"} |
| **Responsável Técnico** | ${projectInfo.responsavel || "[Nome e cargo]"} |
| **Data de Elaboração** | ${new Date().toLocaleDateString("pt-BR")} |
| **Título da Demanda** | ${projectInfo.nome} |
| **Código/Processo** | ${projectInfo.codigo || "A definir"} |

---

## 1. CONTEXTUALIZAÇÃO DA NECESSIDADE

### 1.1 Descrição do Problema e Situação Atual

[GERAR 4 PARÁGRAFOS DENSOS seguindo as diretrizes:]

PARÁGRAFO 1 - CONTEXTO FÍSICO E SOCIAL
PARÁGRAFO 2 - PROBLEMA E NÃO CONFORMIDADE LEGAL
PARÁGRAFO 3 - FORMALIZAÇÃO E PROVIDÊNCIAS TÉCNICAS
PARÁGRAFO 4 - RISCOS E RESPONSABILIZAÇÃO

### 1.2 Base Legal e Normativa

**Legislação Federal:**
- Lei nº 14.133/2021 - Nova Lei de Licitações e Contratos Administrativos
[Listar outras leis mencionadas]

**Legislação Municipal/Estadual:**
[Listar normas locais citadas]

**Normas Técnicas:**
[Listar NBRs e INs aplicáveis]

### 1.3 Documentação Técnica Anexada

${attachments && attachments.length > 0 ? `
Os seguintes documentos foram analisados:

${attachments.map((att: any, i: number) => `
${i + 1}. **${att.file_name}** - ${att.file_type}
   - **Resumo:** ${att.analysis_summary || "Documento técnico complementar"}
   - **Informações-chave:** ${att.extracted_content?.substring(0, 200) || "Dados técnicos relevantes"}
`).join("\n")}
` : "Nenhum documento técnico foi anexado durante a coleta."}

---

## 2. CARACTERIZAÇÃO DOS BENEFICIÁRIOS E IMPACTO

### 2.1 Beneficiários Diretos
[Gerar descrição detalhada com dados da conversa]

### 2.2 Beneficiários Indiretos
[Gerar análise de impacto indireto]

### 2.3 Abrangência e Impacto Social
[Parágrafo sobre alcance da intervenção]

---

## 3. INTERESSE PÚBLICO E JUSTIFICATIVA INSTITUCIONAL

### 3.1 Fundamentação do Interesse Público
[2-3 parágrafos fundamentando interesse público]

### 3.2 Alinhamento Estratégico
[Conexão com planos e programas]

### 3.3 Conformidade Legal e Compliance
[Obrigações normativas e riscos]

---

## 4. ANÁLISE DE CONSEQUÊNCIAS DA NÃO CONTRATAÇÃO

### 4.1 Riscos Operacionais e de Segurança
[Descrever riscos imediatos]

### 4.2 Riscos Jurídicos e Institucionais
[Tabela de passivos potenciais]

### 4.3 Impacto Social
[Consequências para beneficiários]

### 4.4 Classificação de Criticidade
**Nível de urgência:** [CRÍTICO/ALTO/MÉDIO/BAIXO]

---

## 5. SÍNTESE EXECUTIVA

### 📌 O PROBLEMA É...
[3-4 linhas concisas]

### 👥 OS BENEFICIÁRIOS SÃO...
[3-4 linhas concisas]

### ⚖️ O INTERESSE PÚBLICO É...
[3-4 linhas concisas]

### 🚨 SE NADA FOR FEITO...
[3-4 linhas concisas]

---

## 6. CONCLUSÃO E RECOMENDAÇÕES

A presente caracterização evidencia a necessidade [classificação] de proceder à contratação, fundamentada em:
1. Obrigação legal
2. Interesse público primário
3. Riscos concretos
4. Potencial de responsabilização

Recomenda-se prosseguimento IMEDIATO para a etapa REQUISITOS do Framework CRIVO.

---

**Documento gerado automaticamente pelo Framework CRIVO**
**Versão:** 1.0 | **Data:** ${new Date().toLocaleString("pt-BR")}

---

DIRETRIZES:
✅ Use linguagem técnica formal
✅ Seja objetivo e factual
✅ Cite dados específicos da conversa
✅ Inclua citações legais COMPLETAS
✅ Mantenha coerência narrativa
✅ Preencha todos os campos com conteúdo REAL
✅ Se informação não foi fornecida, indique "Não informado"
✅ NUNCA invente dados`;

    const userPrompt = `Aqui está o histórico completo da conversa:

${conversationHistory.map((msg: any) => `${msg.role === "user" ? "USUÁRIO" : "ASSISTENTE"}: ${msg.content}`).join("\n\n")}

${attachments && attachments.length > 0 ? `
Documentos anexados e analisados:
${attachments.map((att: any) => `- ${att.file_name}: ${att.extracted_content?.substring(0, 500) || "Sem análise"}`).join("\n")}
` : ""}

Agora gere o relatório técnico completo seguindo EXATAMENTE o template fornecido.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro", // Pro para geração de relatório complexo
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Aguarde alguns instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("Erro ao gerar relatório");
    }

    const data = await response.json();
    const relatorio = data.choices[0].message.content;

    return new Response(
      JSON.stringify({ relatorio }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Gerar relatório error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
