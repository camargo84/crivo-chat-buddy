import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FileText, ArrowRight, CheckCircle2, Bot, Sparkles } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Auto redirect to dashboard if already logged in
    const checkAuth = async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        navigate("/dashboard");
      }
    };
    checkAuth();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-blue rounded-2xl shadow-xl mb-6">
              <FileText className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent">
              Framework CRIVO
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-4">
              Planejamento Inteligente de Contratações Públicas
            </p>
            <p className="text-base text-muted-foreground max-w-2xl mx-auto">
              Reduza 20 horas de trabalho para 2 horas com nosso assistente de IA especializado em Lei 14.133/2021
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-20">
            <Button size="lg" onClick={() => navigate("/auth")} className="text-lg h-14 gap-2 shadow-lg">
              Começar Agora
              <ArrowRight className="h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/auth")} className="text-lg h-14">
              Fazer Login
            </Button>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-8 mb-20">
            <div className="bg-card rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow border border-border">
              <div className="w-12 h-12 bg-gradient-blue rounded-lg flex items-center justify-center mb-4">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-3">IA Especialista</h3>
              <p className="text-muted-foreground">
                Agente conversacional que entende Lei 14.133/2021 e faz as perguntas certas
              </p>
            </div>

            <div className="bg-card rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow border border-border">
              <div className="w-12 h-12 bg-gradient-green rounded-lg flex items-center justify-center mb-4">
                <CheckCircle2 className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Metodologia CRIVO</h3>
              <p className="text-muted-foreground">
                5 etapas guiadas: Cenário, Requisitos, Investigação, Validação, Otimização
              </p>
            </div>

            <div className="bg-card rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow border border-border">
              <div className="w-12 h-12 bg-gradient-orange rounded-lg flex items-center justify-center mb-4">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Artefatos Automáticos</h3>
              <p className="text-muted-foreground">
                Gera DFD, ETP, TR, MR e PP profissionais automaticamente
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="bg-card rounded-2xl p-8 shadow-xl border border-border">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              <div>
                <p className="text-4xl font-bold text-primary mb-2">20h → 2h</p>
                <p className="text-sm text-muted-foreground">Economia de Tempo</p>
              </div>
              <div>
                <p className="text-4xl font-bold text-secondary mb-2">5</p>
                <p className="text-sm text-muted-foreground">Etapas Guiadas</p>
              </div>
              <div>
                <p className="text-4xl font-bold text-accent mb-2">100%</p>
                <p className="text-sm text-muted-foreground">Lei 14.133/2021</p>
              </div>
              <div>
                <p className="text-4xl font-bold text-success mb-2">5</p>
                <p className="text-sm text-muted-foreground">Artefatos Gerados</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
