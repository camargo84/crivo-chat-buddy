import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { FileText, Loader2 } from "lucide-react";

const Auth = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("login");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      // Check if profile exists
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (profile) {
        navigate("/dashboard");
      } else {
        navigate("/completar-cadastro");
      }
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password.length < 6) {
      toast.error("✗ A senha deve ter no mínimo 6 caracteres");
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        // Verificar se é erro de email não confirmado
        if (error.message.includes("Email not confirmed") || 
            (error.message.includes("Invalid login credentials") && email)) {
          toast.error(
            "Sua conta precisa ser validada por email antes de fazer login.",
            {
              duration: 5000,
              action: {
                label: "Reenviar código",
                onClick: async () => {
                  const { error: resendError } = await supabase.auth.resend({
                    type: 'signup',
                    email,
                  });
                  if (!resendError) {
                    toast.success("✓ Novo código enviado para " + email);
                    navigate("/verificar-email", { state: { email, password, type: "signup" } });
                  } else {
                    toast.error("✗ Não foi possível reenviar. Tente novamente.");
                  }
                },
              },
            }
          );
        } else {
          toast.error("✗ Email ou senha incorretos");
        }
        return;
      }
      
      // Check if profile exists
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("id", data.user.id)
        .maybeSingle();

      if (profile) {
        toast.success("✓ Login realizado com sucesso!");
        navigate("/dashboard");
      } else {
        toast.success("✓ Login realizado! Complete seu cadastro.");
        navigate("/completar-cadastro");
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      toast.error("✗ Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const emailInput = prompt("Digite seu email:");
    if (!emailInput) return;
    
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(emailInput, {
        redirectTo: undefined,
      });
      
      if (error) {
        toast.error("✗ Erro ao enviar código");
      } else {
        toast.success("✓ Código enviado para " + emailInput);
        navigate("/verificar-email", { state: { email: emailInput, type: "recovery" } });
      }
    } catch (error) {
      toast.error("✗ Erro ao enviar código");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast.error("✗ As senhas não coincidem");
      return;
    }

    if (password.length < 8) {
      toast.error("✗ A senha deve ter no mínimo 8 caracteres");
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: undefined,
        },
      });
      
      if (error) {
        if (error.message.includes("already") || error.message.includes("User already registered")) {
          // Email já existe - verificar se foi confirmado
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          
          if (signInError) {
            // Se não conseguiu fazer login, provavelmente o email não foi confirmado
            if (signInError.message.includes("Email not confirmed") || signInError.message.includes("Invalid login credentials")) {
              toast.error(
                "Você já iniciou o cadastro, mas precisa validar seu email antes de continuar.",
                {
                  duration: 5000,
                  action: {
                    label: "Reenviar código",
                    onClick: async () => {
                      const { error: resendError } = await supabase.auth.resend({
                        type: 'signup',
                        email,
                      });
                      if (!resendError) {
                        toast.success("✓ Novo código enviado para " + email);
                        navigate("/verificar-email", { state: { email, password, type: "signup" } });
                      } else {
                        toast.error("✗ Não foi possível reenviar. Tente novamente ou use outro email.");
                      }
                    },
                  },
                }
              );
            } else {
              toast.error("✗ Este email já está cadastrado. Use a aba Entrar.");
            }
          } else {
            // Login funcionou - email já foi confirmado
            toast.error("✗ Este email já está ativo. Use a aba Entrar.");
          }
        } else {
          toast.error("✗ Erro ao criar conta: " + error.message);
        }
        return;
      }
      
      // Cadastro novo bem-sucedido
      toast.success("✓ Código de verificação enviado para " + email);
      navigate("/verificar-email", { state: { email, password, type: "signup" } });
    } catch (error: any) {
      console.error("Auth error:", error);
      toast.error("✗ Erro ao criar conta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto w-16 h-16 bg-gradient-blue rounded-xl flex items-center justify-center shadow-lg">
            <FileText className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-3xl font-bold">Framework CRIVO</CardTitle>
          <CardDescription className="text-base">
            Planejamento inteligente de contratações públicas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="register">Criar Conta</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">E-mail</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="seu@email.gov.br"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="login-password">Senha</Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    minLength={6}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="remember" 
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                  />
                  <label
                    htmlFor="remember"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Manter conectado
                  </label>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Entrar
                </Button>

                <div className="text-center space-y-2">
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-sm text-primary hover:underline"
                    disabled={loading}
                  >
                    Esqueci minha senha
                  </button>
                  <div className="text-sm text-muted-foreground">
                    Não tem conta?{" "}
                    <button
                      type="button"
                      onClick={() => setActiveTab("register")}
                      className="text-primary hover:underline font-medium"
                      disabled={loading}
                    >
                      Crie aqui
                    </button>
                  </div>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="register-email">E-mail</Label>
                  <Input
                    id="register-email"
                    type="email"
                    placeholder="seu@email.gov.br"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="register-password">Senha</Label>
                  <Input
                    id="register-password"
                    type="password"
                    placeholder="Mínimo 8 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    minLength={8}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirmar Senha</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="Digite a senha novamente"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={loading}
                    minLength={8}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Criar Conta
                </Button>

                <div className="text-center text-sm text-muted-foreground">
                  Já tem conta?{" "}
                  <button
                    type="button"
                    onClick={() => setActiveTab("login")}
                    className="text-primary hover:underline font-medium"
                    disabled={loading}
                  >
                    Entre aqui
                  </button>
                </div>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
