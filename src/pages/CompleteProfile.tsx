import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const CompleteProfile = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    full_name: "",
    organization_name: "",
    organization_cnpj: "",
    role_in_organization: "",
    phone: "",
    profile_type: "usuario_regular",
  });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      navigate("/auth");
      return;
    }

    setUserId(user.id);

    // Check if profile already exists
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (profile) {
      navigate("/dashboard");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userId) {
      toast.error("Sessão inválida. Faça login novamente.");
      navigate("/auth");
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error("Usuário não autenticado");

      // Create or find organization
      const { data: org, error: orgError } = await supabase
        .from("organizations")
        .upsert({
          name: formData.organization_name,
          cnpj: formData.organization_cnpj || null,
        }, {
          onConflict: "cnpj",
          ignoreDuplicates: false,
        })
        .select()
        .single();

      if (orgError) throw orgError;

      // Create user profile
      const { error: profileError } = await supabase
        .from("user_profiles")
        .insert({
          id: user.id,
          full_name: formData.full_name,
          email: user.email!,
          organization_id: org.id,
          organization_name: formData.organization_name,
          organization_cnpj: formData.organization_cnpj || null,
          role_in_organization: formData.role_in_organization,
          phone: formData.phone,
          profile_type: formData.profile_type,
        });

      if (profileError) throw profileError;

      toast.success("Perfil criado com sucesso!");
      navigate("/dashboard");
    } catch (error: any) {
      console.error("Profile creation error:", error);
      toast.error(error.message || "Erro ao criar perfil");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary via-primary/90 to-primary/80 p-4">
      <Card className="w-full max-w-4xl shadow-2xl">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-3xl">Bem-vindo ao CRIVO!</CardTitle>
          <CardDescription className="text-lg">
            Como você deseja se cadastrar?
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Card Pessoa Física */}
            <Card 
              className="cursor-pointer hover:border-primary hover:shadow-lg transition-all group"
              onClick={() => navigate("/cadastro-pf")}
            >
              <CardContent className="flex flex-col items-center justify-center p-8 space-y-4">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <svg className="w-10 h-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div className="text-center space-y-2">
                  <h3 className="text-xl font-semibold">Pessoa Física</h3>
                  <p className="text-sm text-muted-foreground">
                    Sou servidor público ou profissional autônomo
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Card Pessoa Jurídica */}
            <Card 
              className="cursor-pointer hover:border-primary hover:shadow-lg transition-all group"
              onClick={() => navigate("/cadastro-pj")}
            >
              <CardContent className="flex flex-col items-center justify-center p-8 space-y-4">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <svg className="w-10 h-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div className="text-center space-y-2">
                  <h3 className="text-xl font-semibold">Pessoa Jurídica</h3>
                  <p className="text-sm text-muted-foreground">
                    Represento um órgão público (prefeitura, secretaria, etc)
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CompleteProfile;
