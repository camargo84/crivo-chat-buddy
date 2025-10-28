import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, ArrowLeft, CheckCircle, XCircle } from "lucide-react";
import { validateCPF, validateCNPJ, formatCPF, formatCNPJ, formatPhone } from "@/lib/validators";

const CadastroPF = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    cpf: "",
    phone: "",
    organization_name: "",
    organization_cnpj: "",
    role_in_organization: "",
  });
  const [validation, setValidation] = useState({
    cpf: null as boolean | null,
    cnpj: null as boolean | null,
  });

  const handleCPFChange = (value: string) => {
    const formatted = formatCPF(value);
    setFormData({ ...formData, cpf: formatted });
    
    const clean = value.replace(/\D/g, '');
    if (clean.length === 11) {
      setValidation({ ...validation, cpf: validateCPF(clean) });
    } else {
      setValidation({ ...validation, cpf: null });
    }
  };

  const handleCNPJChange = (value: string) => {
    const formatted = formatCNPJ(value);
    setFormData({ ...formData, organization_cnpj: formatted });
    
    const clean = value.replace(/\D/g, '');
    if (clean.length === 14) {
      setValidation({ ...validation, cnpj: validateCNPJ(clean) });
    } else {
      setValidation({ ...validation, cnpj: null });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validações
    const cleanCPF = formData.cpf.replace(/\D/g, '');
    if (!validateCPF(cleanCPF)) {
      toast.error("CPF inválido. Verifique os números.");
      return;
    }

    const cleanCNPJ = formData.organization_cnpj.replace(/\D/g, '');
    if (cleanCNPJ && !validateCNPJ(cleanCNPJ)) {
      toast.error("CNPJ inválido. Verifique os números.");
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Create or find organization
      let orgId: string;
      if (cleanCNPJ) {
        const { data: existingOrg } = await supabase
          .from("organizations")
          .select("id")
          .eq("cnpj", cleanCNPJ)
          .maybeSingle();

        if (existingOrg) {
          orgId = existingOrg.id;
        } else {
          const { data: newOrg, error: orgError } = await supabase
            .from("organizations")
            .insert({
              name: formData.organization_name,
              cnpj: cleanCNPJ,
            })
            .select()
            .single();

          if (orgError) throw orgError;
          orgId = newOrg.id;
        }
      } else {
        // Organization without CNPJ
        const { data: newOrg, error: orgError } = await supabase
          .from("organizations")
          .insert({
            name: formData.organization_name,
          })
          .select()
          .single();

        if (orgError) throw orgError;
        orgId = newOrg.id;
      }

      // Create user profile
      const { error: profileError } = await supabase
        .from("user_profiles")
        .insert({
          id: user.id,
          full_name: formData.full_name,
          email: user.email!,
          cpf: cleanCPF,
          organization_id: orgId,
          organization_name: formData.organization_name,
          organization_cnpj: cleanCNPJ || null,
          role_in_organization: formData.role_in_organization,
          phone: formData.phone,
          profile_type: "contratante_pf",
        });

      if (profileError) throw profileError;

      toast.success("✓ Cadastro concluído com sucesso!");
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
      <Card className="w-full max-w-2xl shadow-2xl">
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/completar-cadastro")}
              disabled={loading}
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Voltar
            </Button>
          </div>
          <CardTitle className="text-2xl">Cadastro Pessoa Física</CardTitle>
          <CardDescription>
            Passo 1 de 1 - Preencha seus dados pessoais e organizacionais
          </CardDescription>
          <div className="w-full bg-primary/20 rounded-full h-2 mt-4">
            <div className="bg-primary h-2 rounded-full w-full transition-all" />
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Dados Pessoais */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="px-3 py-1 bg-primary/10 text-primary text-sm font-medium rounded-full">
                  Dados Pessoais
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="full_name">Nome Completo *</Label>
                  <Input
                    id="full_name"
                    placeholder="Ex: João Silva Santos"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    required
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cpf">CPF *</Label>
                  <div className="relative">
                    <Input
                      id="cpf"
                      placeholder="000.000.000-00"
                      value={formData.cpf}
                      onChange={(e) => handleCPFChange(e.target.value)}
                      required
                      disabled={loading}
                      className={
                        validation.cpf === true
                          ? "border-green-500 focus-visible:ring-green-500"
                          : validation.cpf === false
                          ? "border-red-500 focus-visible:ring-red-500"
                          : ""
                      }
                    />
                    {validation.cpf !== null && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {validation.cpf ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-500" />
                        )}
                      </div>
                    )}
                  </div>
                  {validation.cpf === false && (
                    <p className="text-sm text-red-500">CPF inválido. Verifique os dígitos.</p>
                  )}
                  {validation.cpf === true && (
                    <p className="text-sm text-green-500">✓ CPF válido</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    placeholder="(00) 00000-0000"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: formatPhone(e.target.value) })}
                    disabled={loading}
                  />
                </div>
              </div>
            </div>

            {/* Vínculo Organizacional */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="px-3 py-1 bg-gray-100 text-gray-700 text-sm font-medium rounded-full">
                  Vínculo Organizacional
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="organization_name">Nome do Órgão *</Label>
                  <Input
                    id="organization_name"
                    placeholder="Ex: Secretaria Municipal de Educação"
                    value={formData.organization_name}
                    onChange={(e) => setFormData({ ...formData, organization_name: e.target.value })}
                    required
                    disabled={loading}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="organization_cnpj">CNPJ do Órgão</Label>
                    <div className="relative">
                      <Input
                        id="organization_cnpj"
                        placeholder="00.000.000/0000-00"
                        value={formData.organization_cnpj}
                        onChange={(e) => handleCNPJChange(e.target.value)}
                        disabled={loading}
                        className={
                          validation.cnpj === true
                            ? "border-green-500 focus-visible:ring-green-500"
                            : validation.cnpj === false
                            ? "border-red-500 focus-visible:ring-red-500"
                            : ""
                        }
                      />
                      {validation.cnpj !== null && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          {validation.cnpj ? (
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-500" />
                          )}
                        </div>
                      )}
                    </div>
                    {validation.cnpj === false && (
                      <p className="text-sm text-red-500">CNPJ inválido. Verifique os dígitos.</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="role_in_organization">Cargo/Função</Label>
                    <Input
                      id="role_in_organization"
                      placeholder="Ex: Analista de Compras"
                      value={formData.role_in_organization}
                      onChange={(e) => setFormData({ ...formData, role_in_organization: e.target.value })}
                      disabled={loading}
                    />
                  </div>
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Concluir Cadastro
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CadastroPF;
