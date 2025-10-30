import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Send, Bot, User, Loader2, FileText, Download, ChevronLeft, ChevronRight, Copy } from "lucide-react";
import { FileUploadArea } from "@/components/FileUploadArea";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";
import { CollectionStatus } from "@/components/CollectionStatus";
import { AttachmentsList } from "@/components/AttachmentsList";

type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
};

const AgenteCenario = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [questionNumber, setQuestionNumber] = useState(1);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [generatedReport, setGeneratedReport] = useState<string | null>(null);
  const [reportMode, setReportMode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkAuth();
  }, [id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      navigate("/auth");
      return;
    }

    // Get project
    const { data: project, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", id!)
      .single();

    if (error || !project) {
      toast.error("Demanda não encontrada");
      navigate("/dashboard");
      return;
    }

    setProjectName(project.name);

    // Get messages
    const { data: messagesData } = await supabase
      .from("demanda_messages")
      .select("*")
      .eq("demanda_id", id!)
      .order("created_at", { ascending: true });

    if (messagesData && messagesData.length > 0) {
      setMessages(messagesData as Message[]);
      // Contar perguntas já feitas
      const assistantMessages = messagesData.filter((m) => m.role === "assistant");
      setQuestionNumber(assistantMessages.length);
    } else {
      // Send initial message
      const initialMessage = {
        demanda_id: id!,
        role: "assistant" as const,
        content: `Olá! Sou o Agente Cenário do Framework CRIVO. 🎯\n\nVou te ajudar a construir um contexto completo para a demanda **"${project.name}"**.\n\nVou fazer perguntas adaptativas para coletar todas as informações necessárias para o relatório de cenário. Você pode anexar documentos a qualquer momento usando o botão de clipe - vou consultá-los sempre que você digitar "buscar". 📎\n\n---\n\n**Pergunta 1 - ÓRGÃO RESPONSÁVEL**\n\nQual é o órgão ou entidade responsável por esta demanda? (Inclua nome completo, sigla e CNPJ se possível)\n\n(Digite 'buscar' se quiser que eu consulte os arquivos anexados)`,
        metadata: { question_number: 1 },
      };

      const { data: newMsg } = await supabase
        .from("demanda_messages")
        .insert(initialMessage)
        .select()
        .single();

      if (newMsg) {
        setMessages([newMsg as Message]);
      }
    }

    // Get attachments
    const { data: attachmentsData } = await supabase
      .from("attachments")
      .select("*")
      .eq("demanda_id", id!)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (attachmentsData) {
      setAttachments(attachmentsData);
    }

    setLoading(false);
  };

  const handleCopyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success("Mensagem copiada!");
  };

  const handleSend = async () => {
    if (!input.trim() || sending) return;

    // Verificar se usuário digitou "buscar"
    if (input.trim().toLowerCase() === "buscar") {
      setSending(true);
      try {
        const lastAssistantMsg = [...messages].reverse().find(m => m.role === "assistant");
        if (!lastAssistantMsg) {
          toast.error("Nenhuma pergunta anterior encontrada");
          setSending(false);
          return;
        }

        const { data: ragData, error: ragError } = await supabase.functions.invoke(
          "search-attachments-rag",
          {
            body: {
              demanda_id: id!,
              question: lastAssistantMsg.content,
            },
          }
        );

        if (ragError) throw ragError;

        const userMsg = {
          demanda_id: id!,
          role: "user" as const,
          content: "buscar",
          metadata: { question_number: questionNumber },
        };

        const { data: savedUserMsg } = await supabase
          .from("demanda_messages")
          .insert(userMsg)
          .select()
          .single();

        if (savedUserMsg) {
          setMessages((prev) => [...prev, savedUserMsg as Message]);
        }

        let assistantResponse = "";
        if (ragData?.found) {
          assistantResponse = `📄 **Encontrei nos arquivos:**\n\n${ragData.answer}\n\n(Fonte: ${ragData.source_file})\n\nVocê confirma essa informação ou deseja fazer alguma alteração?`;
        } else {
          assistantResponse = "❌ Não encontrei essa informação nos arquivos anexados. Você poderia fornecer diretamente?";
        }

        const assistantMsg = {
          demanda_id: id!,
          role: "assistant" as const,
          content: assistantResponse,
          metadata: { question_number: questionNumber, rag_search: true },
        };

        const { data: savedAssistantMsg } = await supabase
          .from("demanda_messages")
          .insert(assistantMsg)
          .select()
          .single();

        if (savedAssistantMsg) {
          setMessages((prev) => [...prev, savedAssistantMsg as Message]);
        }

        setInput("");
        setSending(false);
        return;
      } catch (error: any) {
        console.error("RAG search error:", error);
        toast.error(error.message || "Erro ao buscar nos arquivos");
        setSending(false);
        return;
      }
    }

    setSending(true);

    try {
      // Save user message
      const userMessage = {
        demanda_id: id!,
        role: "user" as const,
        content: input.trim(),
        metadata: { question_number: questionNumber },
      };

      const { data: userMsg, error: userError } = await supabase
        .from("demanda_messages")
        .insert(userMessage)
        .select()
        .single();

      if (userError) throw userError;

      setMessages((prev) => [...prev, userMsg as Message]);
      const userInput = input.trim();
      setInput("");

      // Call AI to generate next question
      const conversationHistory = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const { data: aiData, error: aiError } = await supabase.functions.invoke("chat-cenario", {
        body: {
          messages: conversationHistory,
          projectId: id!,
          questionNumber: questionNumber + 1,
        },
      });

      if (aiError) throw aiError;

      if (aiData?.savedMessage) {
        setMessages((prev) => [...prev, aiData.savedMessage as Message]);
        setQuestionNumber(questionNumber + 1);
      }

      setSending(false);
    } catch (error: any) {
      console.error("Send message error:", error);
      toast.error(error.message || "Erro ao enviar mensagem");
      setSending(false);
    }
  };

  const handleGenerateReport = async () => {
    setLoading(true);
    toast.info("Gerando relatório técnico... Isso pode levar alguns instantes.");

    try {
      const { data: reportData, error: reportError } = await supabase.functions.invoke(
        "generate-report-docx",
        {
          body: {
            projectId: id!,
          },
        }
      );

      if (reportError) throw reportError;

      setGeneratedReport(reportData.report);
      setReportMode(true);
      toast.success("✅ Relatório gerado com sucesso!");
    } catch (error: any) {
      console.error("Generate report error:", error);
      toast.error(error.message || "Erro ao gerar relatório");
    } finally {
      setLoading(false);
    }
  };

  const handleApproveReport = () => {
    toast.success("Relatório aprovado! (Funcionalidade de download em desenvolvimento)");
    // TODO: Implementar geração de DOCX e download
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <div
        className={`${
          sidebarCollapsed ? "w-14" : "w-80"
        } border-r bg-card transition-all duration-300 flex flex-col`}
      >
        <div className="p-4 border-b flex items-center justify-between">
          {!sidebarCollapsed && (
            <div className="flex-1">
              <h2 className="font-semibold text-sm">Etapa CENÁRIO</h2>
              <p className="text-xs text-muted-foreground truncate">{projectName}</p>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        {!sidebarCollapsed && (
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {/* Status Integrado */}
              <CollectionStatus projectId={id!} />

              {/* Actions */}
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => navigate("/dashboard")}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar ao Dashboard
                </Button>
                {questionNumber >= 20 && !reportMode && (
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={handleGenerateReport}
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <FileText className="h-4 w-4 mr-2" />
                    )}
                    Gerar Relatório
                  </Button>
                )}
              </div>
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="border-b bg-card px-6 py-4">
          <h1 className="text-xl font-bold mb-3">
            {reportMode ? "Relatório de Cenário" : "Conversa com Agente Cenário"}
          </h1>
          {/* Área de Arquivos Anexados - Estilo ChatGPT */}
          {!reportMode && <AttachmentsList projectId={id!} />}
        </header>

        {/* Content */}
        {reportMode && generatedReport ? (
          <div className="flex-1 overflow-hidden flex flex-col">
            <ScrollArea className="flex-1 p-6">
              <div className="max-w-4xl mx-auto prose prose-sm dark:prose-invert">
                <ReactMarkdown>{generatedReport}</ReactMarkdown>
              </div>
            </ScrollArea>
            <div className="border-t bg-card p-4 flex gap-2 justify-center">
              <Button variant="outline" onClick={() => setReportMode(false)}>
                ✏️ Solicitar Alterações
              </Button>
              <Button onClick={handleApproveReport}>
                <Download className="h-4 w-4 mr-2" />
                Aprovar e Baixar .DOCX
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Messages */}
            <ScrollArea className="flex-1 p-6">
              <div className="max-w-4xl mx-auto space-y-6">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${
                      msg.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {msg.role === "assistant" && (
                      <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                        <Bot className="w-5 h-5 text-primary-foreground" />
                      </div>
                    )}
                    <Card
                      className={`max-w-[80%] p-4 relative group ${
                        msg.role === "user"
                          ? "bg-secondary text-secondary-foreground"
                          : "bg-card"
                      }`}
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleCopyMessage(msg.content)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(msg.created_at).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </Card>
                    {msg.role === "user" && (
                      <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                        <User className="w-5 h-5 text-secondary-foreground" />
                      </div>
                    )}
                  </div>
                ))}
                {sending && (
                  <div className="flex gap-3 justify-start">
                    <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                      <Bot className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <Card className="p-4">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      <p className="text-xs text-muted-foreground mt-2">
                        Processando resposta...
                      </p>
                    </Card>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="border-t bg-card p-4">
              <div className="max-w-4xl mx-auto flex gap-2">
                <FileUploadArea
                  projectId={id!}
                  onUploadComplete={(file) => {
                    setAttachments((prev) => [...prev, file]);
                    toast.success(`Documento ${file.file_name} anexado!`);
                  }}
                />
                <Textarea
                  placeholder="Digite sua resposta ou 'buscar' para consultar arquivos... (Enter para enviar)"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  disabled={sending}
                  rows={2}
                  className="flex-1 resize-none"
                />
                <Button onClick={handleSend} disabled={sending || !input.trim()} size="lg">
                  {sending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AgenteCenario;
