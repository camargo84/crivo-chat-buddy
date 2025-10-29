import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Mail, CheckCircle, Loader2, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const VerificarEmail = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [resending, setResending] = useState(false);

  useEffect(() => {
    const emailFromState = location.state?.email;
    if (emailFromState) {
      setEmail(emailFromState);
    }
  }, [location.state]);

  const handleResend = async () => {
    if (!email) {
      toast.error('❌ Email não encontrado', {
        description: 'Volte e faça o cadastro novamente.'
      });
      return;
    }

    setResending(true);

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email
      });

      if (error) throw error;

      toast.success('✅ Email reenviado!', {
        description: 'Verifique sua caixa de entrada e pasta de spam.'
      });

    } catch (error) {
      console.error('❌ Erro ao reenviar email:', error);

      toast.error('❌ Erro ao reenviar', {
        description: 'Não foi possível reenviar o email. Tente novamente em alguns minutos.'
      });

    } finally {
      setResending(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-primary/5 to-background p-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8">
          <div className="flex flex-col items-center text-center space-y-6">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
              <Mail className="w-10 h-10 text-primary" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold">Verifique seu email</h1>
              <p className="text-muted-foreground">
                Enviamos um link de verificação para:
              </p>
              <p className="font-semibold text-lg break-all">{email}</p>
            </div>

            <div className="w-full space-y-4">
              <div className="bg-secondary/50 p-4 rounded-lg text-left space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <p className="text-sm">
                    Clique no link do email para ativar sua conta
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <p className="text-sm">O link expira em 1 hora</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <p className="text-sm">
                    Verifique a pasta de spam se não encontrar
                  </p>
                </div>
              </div>

              <Button
                onClick={handleResend}
                disabled={resending || !email}
                variant="outline"
                className="w-full"
              >
                {resending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Reenviando...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Reenviar email de verificação
                  </>
                )}
              </Button>

              <div className="pt-4 border-t">
                <Button
                  variant="ghost"
                  onClick={() => navigate('/auth')}
                  className="w-full"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar para login
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VerificarEmail;
