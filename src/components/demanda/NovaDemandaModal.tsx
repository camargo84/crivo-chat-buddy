'use client';

import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useDemanda } from '@/hooks/useDemanda';
import { validateSituacaoProblema } from '@/lib/validations/demanda';
import { cn } from '@/lib/utils';
import {
  Info,
  Lightbulb,
  CheckCircle,
  XCircle,
  Loader2,
  ArrowRight,
  Clock,
  FileText
} from 'lucide-react';

interface NovaDemandaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NovaDemandaModal({ open, onOpenChange }: NovaDemandaModalProps) {
  const [situacaoProblema, setSituacaoProblema] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const { createDemanda, loading } = useDemanda();

  // Validação em tempo real
  const isValid = useMemo(() => {
    if (!situacaoProblema.trim()) return false;
    const validation = validateSituacaoProblema(situacaoProblema);
    return validation.isValid;
  }, [situacaoProblema]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = e.target.value;
    setSituacaoProblema(valor);

    // Validação em tempo real
    if (valor.trim().length > 0) {
      const validation = validateSituacaoProblema(valor);
      setErro(validation.error || null);
    } else {
      setErro(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = validateSituacaoProblema(situacaoProblema);
    if (!validation.isValid) {
      setErro(validation.error || 'Validação falhou');
      return;
    }

    const result = await createDemanda(situacaoProblema);
    
    if (result) {
      // Sucesso - modal será fechado após redirecionamento
      setSituacaoProblema('');
      setErro(null);
      onOpenChange(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setSituacaoProblema('');
      setErro(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-2xl">Nova Demanda</DialogTitle>
              <DialogDescription className="text-base">
                Inicie o planejamento de uma nova contratação
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="situacao-problema" className="text-sm font-semibold">
                SITUAÇÃO-PROBLEMA
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 rounded-full hover:bg-muted"
                    aria-label="Ajuda sobre situação-problema"
                  >
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent side="right" align="start" className="w-80 p-4">
                  <div className="space-y-3">
                    <div className="flex items-start gap-2">
                      <Lightbulb className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                      <div>
                        <h4 className="font-semibold mb-1">O que é situação-problema?</h4>
                        <p className="text-sm text-muted-foreground">
                          Descreva o PROBLEMA ou necessidade, não a solução desejada.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                        <div className="text-sm">
                          <p className="font-medium text-green-700">CERTO:</p>
                          <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-1">
                            <li>"Falta de calçada acessível"</li>
                            <li>"Sistema obsoleto"</li>
                            <li>"Equipamentos danificados"</li>
                          </ul>
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <XCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                        <div className="text-sm">
                          <p className="font-medium text-red-700">EVITE:</p>
                          <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-1">
                            <li>"Construir calçada" (solução)</li>
                            <li>"Comprar sistema" (solução)</li>
                            <li>"Adquirir equipamentos" (solução)</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t">
                      <p className="text-xs text-muted-foreground">
                        💡 O agente IA vai detalhar tudo na próxima etapa!
                      </p>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <Input
              id="situacao-problema"
              type="text"
              placeholder="Ex: Ausência de calçada acessível no CAPS"
              value={situacaoProblema}
              onChange={handleChange}
              maxLength={280}
              disabled={loading}
              className={cn(
                "transition-all",
                erro && "border-destructive focus-visible:ring-destructive"
              )}
              aria-describedby="situacao-problema-helper situacao-problema-error"
              aria-invalid={!!erro}
            />

            <div className="space-y-1">
              <p
                id="situacao-problema-helper"
                className="text-sm text-muted-foreground flex items-center gap-2"
              >
                <span className="text-lg">👉</span>
                <span>
                  Descreva o <strong>problema</strong>, não a solução
                </span>
              </p>

              <div className="flex items-center justify-between text-xs">
                <span
                  id="situacao-problema-error"
                  className={cn(
                    "transition-all",
                    erro ? "text-destructive" : "text-transparent"
                  )}
                  role="alert"
                  aria-live="polite"
                >
                  {erro || 'placeholder'}
                </span>
                <span
                  className={cn(
                    "font-mono transition-colors",
                    situacaoProblema.length < 10 && "text-muted-foreground",
                    situacaoProblema.length >= 10 &&
                      situacaoProblema.length <= 260 &&
                      "text-green-600",
                    situacaoProblema.length > 260 &&
                      situacaoProblema.length <= 280 &&
                      "text-orange-600",
                    situacaoProblema.length > 280 && "text-destructive"
                  )}
                >
                  {situacaoProblema.length}/280
                </span>
              </div>
            </div>
          </div>

          <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
            <CardContent className="flex items-start gap-3 p-4">
              <div className="shrink-0">
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                  <Lightbulb className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Não se preocupe em ser completo agora!
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  O agente IA fará aproximadamente 20 perguntas detalhadas para
                  entender toda a situação e gerar um relatório técnico profissional.
                </p>
                <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 mt-2">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Tempo estimado: 15-20 minutos</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              Cancelar
            </Button>

            <Button
              type="submit"
              disabled={loading || !isValid}
              className="min-w-[140px]"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  Iniciar CRIVO
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
