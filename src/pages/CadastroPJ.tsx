import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, CheckCircle, XCircle } from "lucide-react";
import { validateCNPJ, formatCNPJ } from "@/lib/validators";

const CadastroPJ = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    razao_social: "",
    cnpj: "",
    nome_fantasia: "",
    sigla: "",
    uf: "",
    municipio: "",
  });
  const [cnpjValid, setCnpjValid] = useState<boolean | null>(null);

  const handleCNPJChange = (value: string) => {
    const formatted = formatCNPJ(value);
    setFormData({ ...formData, cnpj: formatted });
    
    const clean = value.replace(/\D/g, '');
    if (clean.length === 14) {
      setCnpjValid(validateCNPJ(clean));
    } else {
      setCnpjValid(null);
    }
  };

  const handleNext = () => {
    if (!formData.razao_social || !formData.cnpj || !formData.uf) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    const cleanCNPJ = formData.cnpj.replace(/\D/g, '');
    if (!validateCNPJ(cleanCNPJ)) {
      toast.error("CNPJ inválido. Verifique os números.");
      return;
    }

    // Save to localStorage
    localStorage.setItem("cadastro_pj_step1", JSON.stringify(formData));
    navigate("/cadastro-pj/responsavel");
  };

  const estadosBR = [
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
    "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
    "RS", "RO", "RR", "SC", "SP", "SE", "TO"
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary via-primary/90 to-primary/80 p-4">
      <Card className="w-full max-w-2xl shadow-2xl">
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/completar-cadastro")}
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Voltar
            </Button>
          </div>
          <CardTitle className="text-2xl">Cadastro Pessoa Jurídica</CardTitle>
          <CardDescription>
            Passo 1 de 2 - Dados da Entidade
          </CardDescription>
          <div className="w-full bg-primary/20 rounded-full h-2 mt-4">
            <div className="bg-primary h-2 rounded-full w-1/2 transition-all" />
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); handleNext(); }} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="razao_social">Razão Social *</Label>
                <Input
                  id="razao_social"
                  placeholder="Ex: Prefeitura Municipal do Rio de Janeiro"
                  value={formData.razao_social}
                  onChange={(e) => setFormData({ ...formData, razao_social: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cnpj">CNPJ *</Label>
                  <div className="relative">
                    <Input
                      id="cnpj"
                      placeholder="00.000.000/0000-00"
                      value={formData.cnpj}
                      onChange={(e) => handleCNPJChange(e.target.value)}
                      required
                      className={
                        cnpjValid === true
                          ? "border-green-500 focus-visible:ring-green-500"
                          : cnpjValid === false
                          ? "border-red-500 focus-visible:ring-red-500"
                          : ""
                      }
                    />
                    {cnpjValid !== null && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {cnpjValid ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-500" />
                        )}
                      </div>
                    )}
                  </div>
                  {cnpjValid === false && (
                    <p className="text-sm text-red-500">CNPJ inválido. Verifique os dígitos.</p>
                  )}
                  {cnpjValid === true && (
                    <p className="text-sm text-green-500">✓ CNPJ válido</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nome_fantasia">Nome Fantasia</Label>
                  <Input
                    id="nome_fantasia"
                    placeholder="Ex: PMRJ"
                    value={formData.nome_fantasia}
                    onChange={(e) => setFormData({ ...formData, nome_fantasia: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sigla">Sigla</Label>
                  <Input
                    id="sigla"
                    placeholder="Ex: PMRJ"
                    value={formData.sigla}
                    onChange={(e) => setFormData({ ...formData, sigla: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="uf">UF *</Label>
                  <Select
                    value={formData.uf}
                    onValueChange={(value) => setFormData({ ...formData, uf: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {estadosBR.map((estado) => (
                        <SelectItem key={estado} value={estado}>
                          {estado}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="municipio">Município</Label>
                  <Input
                    id="municipio"
                    placeholder="Ex: Rio de Janeiro"
                    value={formData.municipio}
                    onChange={(e) => setFormData({ ...formData, municipio: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full" size="lg">
              Próximo: Dados do Responsável
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CadastroPJ;
