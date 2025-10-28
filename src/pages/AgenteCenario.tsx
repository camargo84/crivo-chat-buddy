import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { ArrowLeft, Send, Paperclip, Bot, User, Loader2 } from "lucide-react";

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
  const [padrao, setPadrao] = useState(0);
  const [adaptativas, setAdaptativas] = useState(0);

  useEffect(() => {
    checkAuth();
  }, [id]);

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
    } else {
      // Send initial message
      const initialMessage = {
        demanda_id: id!,
        role: "assistant" as const,
        content: `Olá! Sou o Agente Cenário do Framework CRIVO. 🎯\n\nVou te ajudar a construir um contexto completo para a demanda "${project.name}".\n\nVamos começar com 10 perguntas padrão sobre sua contratação. Depois, vou gerar perguntas específicas baseadas nas suas respostas.\n\n**Pergunta 1/10: Qual é o órgão responsável por esta contratação?**`,
        metadata: {},
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

    setLoading(false);
  };

  const handleSend = async () => {
    if (!input.trim() || sending) return;

    setSending(true);

    try {
      // Save user message
      const userMessage = {
        demanda_id: id!,
        role: "user" as const,
        content: input.trim(),
        metadata: {},
      };

      const { data: userMsg, error: userError } = await supabase
        .from("demanda_messages")
        .insert(userMessage)
        .select()
        .single();

      if (userError) throw userError;

      setMessages((prev) => [...prev, userMsg as Message]);
      setInput("");

      // TODO: Call AI to generate next question
      // For now, mock response
      setTimeout(async () => {
        const aiMessage = {
          demanda_id: id!,
          role: "assistant" as const,
          content: "Obrigado pela resposta! **Pergunta 2/10: Qual é o objeto desta contratação?** (aquisição, serviço, obra)",
          metadata: {},
        };

        const { data: aiMsg } = await supabase
          .from("demanda_messages")
          .insert(aiMessage)
          .select()
          .single();

        if (aiMsg) {
          setMessages((prev) => [...prev, aiMsg as Message]);
          setPadrao((prev) => Math.min(prev + 1, 10));
        }

        setSending(false);
      }, 1000);
    } catch (error: any) {
      console.error("Send message error:", error);
      toast.error(error.message || "Erro ao enviar mensagem");
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalProgress = ((padrao + adaptativas) / 20) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex flex-col">
      {/* Header */}
      <header className="border-b bg-card shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-bold">Agente Cenário</h1>
              <p className="text-sm text-muted-foreground">{projectName}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Progress Card */}
      <div className="container mx-auto px-4 py-4">
        <Card className="p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Progresso</span>
              <span className="text-muted-foreground">{padrao + adaptativas}/20 perguntas</span>
            </div>
            <Progress value={totalProgress} className="h-2" />
            <div className="flex items-center gap-6 text-sm">
              <span className="text-primary">Padrão: {padrao}/10</span>
              <span className="text-secondary">Adaptativas: {adaptativas}/10</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Messages */}
      <div className="flex-1 container mx-auto px-4 py-6 overflow-y-auto">
        <div className="space-y-6 max-w-4xl mx-auto">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="w-10 h-10 rounded-full bg-gradient-blue flex items-center justify-center flex-shrink-0">
                  <Bot className="w-5 h-5 text-white" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl p-4 shadow-md ${
                  msg.role === "user"
                    ? "bg-gradient-green text-white rounded-br-none border-r-4 border-secondary"
                    : "bg-gradient-blue text-white rounded-bl-none border-l-4 border-primary-light"
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
                <p className="text-xs mt-2 opacity-80">
                  {new Date(msg.created_at).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              {msg.role === "user" && (
                <div className="w-10 h-10 rounded-full bg-gradient-green flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-white" />
                </div>
              )}
            </div>
          ))}
          {sending && (
            <div className="flex gap-3 justify-start">
              <div className="w-10 h-10 rounded-full bg-gradient-blue flex items-center justify-center flex-shrink-0">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="bg-gradient-blue text-white rounded-2xl rounded-bl-none p-4 shadow-md border-l-4 border-primary-light">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t bg-card shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="max-w-4xl mx-auto flex gap-2">
            <Button variant="outline" size="icon" disabled={sending}>
              <Paperclip className="h-5 w-5" />
            </Button>
            <Textarea
              placeholder="Digite sua resposta..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              disabled={sending}
              rows={1}
              className="min-h-[44px] max-h-[200px] resize-none"
            />
            <Button onClick={handleSend} disabled={sending || !input.trim()}>
              {sending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgenteCenario;
