import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Mail, Loader2, FileText } from "lucide-react";

const VerificarEmail = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email || "";
  const password = location.state?.password || "";
  const type = location.state?.type || "signup";
  
  const [loading, setLoading] = useState(false);
  const [resendDisabled, setResendDisabled] = useState(true);
  const [resendTimer, setResendTimer] = useState(60);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutos
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!email) {
      navigate("/auth");
      return;
    }

    // Focus no primeiro input
    inputRefs.current[0]?.focus();

    // Timer para validade do código (10 minutos)
    const validityTimer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    // Countdown para reenvio (60 segundos)
    const resendCountdown = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          setResendDisabled(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(validityTimer);
      clearInterval(resendCountdown);
    };
  }, [email, navigate]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^[0-9]$/.test(value) && value !== "") return;

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    // Auto-focus próximo input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit quando preencher todos
    if (index === 5 && value && newOtp.every((d) => d)) {
      verifyOtp(newOtp.join(""));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace") {
      if (!otp[index] && index > 0) {
        const newOtp = [...otp];
        newOtp[index - 1] = "";
        setOtp(newOtp);
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const newOtp = pastedData.split("");
    while (newOtp.length < 6) newOtp.push("");
    setOtp(newOtp);
    if (newOtp.every((d) => d)) {
      verifyOtp(newOtp.join(""));
    }
    inputRefs.current[5]?.focus();
  };

  const verifyOtp = async (code: string) => {
    if (code.length !== 6) {
      toast.error("✗ Digite todos os 6 dígitos");
      return;
    }

    if (timeLeft === 0) {
      toast.error("✗ Código expirado. Solicite um novo código.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: type === "recovery" ? "recovery" : "signup",
      });

      if (error) throw error;

      toast.success("✓ Email verificado com sucesso!");
      
      if (type === "signup" && password) {
        await supabase.auth.signInWithPassword({ email, password });
        navigate("/completar-cadastro");
      } else if (type === "recovery") {
        navigate("/redefinir-senha", { state: { email } });
      } else {
        navigate("/completar-cadastro");
      }
    } catch (error: any) {
      console.error("OTP verification error:", error);
      toast.error("✗ Código inválido. Tente novamente.");
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setLoading(true);
    try {
      if (type === "recovery") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: undefined,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.resend({
          type: "signup",
          email,
        });
        if (error) throw error;
      }

      toast.success("✓ Novo código enviado para " + email);
      setResendDisabled(true);
      setResendTimer(60);
      setTimeLeft(600);
      
      const interval = setInterval(() => {
        setResendTimer((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setResendDisabled(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (error: any) {
      toast.error("✗ Erro ao reenviar código");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-gradient-blue rounded-xl flex items-center justify-center shadow-lg">
            <FileText className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl">Verifique seu email</CardTitle>
          <CardDescription className="text-base">
            Enviamos um código de 6 dígitos para<br />
            <strong className="text-foreground">{email}</strong>
          </CardDescription>
          
          {timeLeft > 0 ? (
            <p className="text-sm text-muted-foreground">
              ⏱️ Código válido por <strong className="text-foreground">{formatTime(timeLeft)}</strong>
            </p>
          ) : (
            <p className="text-sm text-red-500 font-medium">
              ⏱️ Código expirado
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-center gap-2" onPaste={handlePaste}>
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(el) => (inputRefs.current[index] = el)}
                type="text"
                inputMode="numeric"
                pattern="[0-9]"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                disabled={loading || timeLeft === 0}
                className="w-12 h-14 text-center text-2xl font-bold border-2 border-input rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50 transition-all hover:border-primary/50"
                autoFocus={index === 0}
              />
            ))}
          </div>

          <Button
            type="button"
            onClick={() => verifyOtp(otp.join(""))}
            disabled={loading || otp.some((d) => !d) || timeLeft === 0}
            className="w-full"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Validar Código
          </Button>

          <div className="text-center">
            <Button
              type="button"
              variant="ghost"
              onClick={handleResend}
              disabled={resendDisabled || loading}
              className="text-sm"
            >
              {resendDisabled ? (
                `Reenviar código em ${resendTimer}s`
              ) : loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Reenviando...
                </>
              ) : (
                "Reenviar código"
              )}
            </Button>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            ℹ️ Não recebeu? Verifique sua caixa de spam
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VerificarEmail;
