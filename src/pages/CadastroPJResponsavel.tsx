import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, ArrowLeft, CheckCircle, XCircle, ChevronDown } from "lucide-react";
import { validateCPF, formatCPF, formatPhone } from "@/lib/validators";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const CadastroPJResponsavel = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [orgData, setOrgData] = useState<any>(null);
  const [showOrgData, setShowOrgData] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    cpf: "",
    role_in_organization: "",
    phone: "",
  });
  const [cpfValid, setCpfValid] = useState<boolean | null>(null);

  useEffect(() => {
    // Load step 1 data from localStorage
    const savedData = localStorage.getItem("cadastro_pj_step1");
    if (!savedData) {
      toast.error("Dados da entidade não encontrados. Volte ao passo anterior.");
      navigate("/cadastro-pj");
      return;
    }
    setOrgData(JSON.parse(savedData));
  }, [navigate]);

  const handleCPFChange = (value: string) => {
    const formatted = formatCPF(value);
    setFormData({ ...formData, cpf: formatted });
    
    const clean = value.replace(/\D/g, '');
    if (clean.length === 11) {
      setCpfValid(validateCPF(clean));
    } else {
      setCpfValid(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanCPF = formData.cpf.replace(/\D/g, '');
    if (!validateCPF(cleanCPF)) {
      toast.error("CPF inválido. Verifique os números.");
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Check if organization exists
      const cleanCNPJ = orgData.cnpj.replace(/\D/g, '');
      const { data: existingOrg } = await supabase
        .from("organizations")
        .select("id")
        .eq("cnpj", cleanCNPJ)
        .maybeSingle();

      let orgId: string;
      
      if (existingOrg) {
        orgId = existingOrg.id;
      } else {
        // Create organization
        const { data: newOrg, error: orgError } = await supabase
          .from("organizations")
          .insert({
            name: orgData.sigla || orgData.razao_social,
            full_name: orgData.razao_social,
            cnpj: cleanCNPJ,
            municipality: orgData.municipio,
            state: orgData.uf,
            sphere: "municipal", // Default
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
          organization_name: orgData.razao_social,
          organization_cnpj: cleanCNPJ,
          role_in_organization: formData.role_in_organization,
          phone: formData.phone,
          profile_type: "contratante_pj",
        });

      if (profileError) throw profileError;

      // Clear localStorage
      localStorage.removeItem("cadastro_pj_step1");

      toast.success("✓ Cadastro concluído com sucesso!");
      navigate("/dashboard");
    } catch (error: any) {
      console.error("Profile creation error:", error);
      toast.error(error.message || "Erro ao criar perfil");
    } finally {
      setLoading(false);
    }
  };

  if (!orgData) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary via-primary/90 to-primary/80 p-4">
      <Card className="w-full max-w-2xl shadow-2xl">
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/cadastro-pj")}
              disabled={loading}
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Voltar e Editar
            </Button>
          </div>
          <CardTitle className="text-2xl">Cadastro Pessoa Jurídica</CardTitle>
          <CardDescription>
            Passo 2 de 2 - Responsável pela Conta
          </CardDescription>
          <div className="w-full bg-primary/20 rounded-full h-2 mt-4">
            <div className="bg-primary h-2 rounded-full w-full transition-all" />
          </div>
        </CardHeader>
        <CardContent>
          {/* Resumo Step 1 (Collapsible) */}
          <Collapsible open={showOrgData} onOpenChange={setShowOrgData} className="mb-6">
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                <span>Dados da Entidade</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showOrgData ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 p-4 bg-muted/50 rounded-lg space-y-2 text-sm">
              <div><strong>Razão Social:</strong> {orgData.razao_social}</div>
              <div><strong>CNPJ:</strong> {orgData.cnpj}</div>
              {orgData.nome_fantasia && <div><strong>Nome Fantasia:</strong> {orgData.nome_fantasia}</div>}
              {orgData.sigla && <div><strong>Sigla:</strong> {orgData.sigla}</div>}
              <div><strong>UF:</strong> {orgData.uf}</div>
              {orgData.municipio && <div><strong>Município:</strong> {orgData.municipio}</div>}
            </CollapsibleContent>
          </Collapsible>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="px-3 py-1 bg-primary/10 text-primary text-sm font-medium rounded-full">
                  Seus Dados Pessoais
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="full_name">Nome Completo do Responsável *</Label>
                <Input
                  id="full_name"
                  placeholder="Ex: Maria Silva Santos"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  required
                  disabled={loading}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cpf">CPF do Responsável *</Label>
                  <div className="relative">
                    <Input
                      id="cpf"
                      placeholder="000.000.000-00"
                      value={formData.cpf}
                      onChange={(e) => handleCPFChange(e.target.value)}
                      required
                      disabled={loading}
                      className={
                        cpfValid === true
                          ? "border-green-500 focus-visible:ring-green-500"
                          : cpfValid === false
                          ? "border-red-500 focus-visible:ring-red-500"
                          : ""
                      }
                    />
                    {cpfValid !== null && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {cpfValid ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-500" />
                        )}
                      </div>
                    )}
                  </div>
                  {cpfValid === false && (
                    <p className="text-sm text-red-500">CPF inválido. Verifique os dígitos.</p>
                  )}
                  {cpfValid === true && (
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

              <div className="space-y-2">
                <Label htmlFor="role">Cargo no Órgão</Label>
                <Input
                  id="role"
                  placeholder="Ex: Secretário de Administração"
                  value={formData.role_in_organization}
                  onChange={(e) => setFormData({ ...formData, role_in_organization: e.target.value })}
                  disabled={loading}
                />
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

export default CadastroPJResponsavel;
