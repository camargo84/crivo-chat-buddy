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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
      <Card className="w-full max-w-2xl shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl">Complete seu Perfil</CardTitle>
          <CardDescription>
            Precisamos de algumas informações para personalizar sua experiência
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Nome Completo *</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="(00) 00000-0000"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="organization_name">Nome do Órgão *</Label>
              <Input
                id="organization_name"
                placeholder="Ex: Prefeitura Municipal de..."
                value={formData.organization_name}
                onChange={(e) => setFormData({ ...formData, organization_name: e.target.value })}
                required
                disabled={loading}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="organization_cnpj">CNPJ do Órgão</Label>
                <Input
                  id="organization_cnpj"
                  placeholder="00.000.000/0000-00"
                  value={formData.organization_cnpj}
                  onChange={(e) => setFormData({ ...formData, organization_cnpj: e.target.value })}
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role_in_organization">Cargo/Função</Label>
                <Input
                  id="role_in_organization"
                  placeholder="Ex: Gestor de Compras"
                  value={formData.role_in_organization}
                  onChange={(e) => setFormData({ ...formData, role_in_organization: e.target.value })}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile_type">Tipo de Perfil</Label>
              <Select
                value={formData.profile_type}
                onValueChange={(value) => setFormData({ ...formData, profile_type: value })}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="usuario_regular">Usuário Regular</SelectItem>
                  <SelectItem value="gestor_orgao">Gestor do Órgão</SelectItem>
                  <SelectItem value="master_admin">Master Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar Perfil e Continuar
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CompleteProfile;
