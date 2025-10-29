import { AuthError } from '@supabase/supabase-js';

export type AuthErrorType = 
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'rate_limit'
  | 'invalid_email'
  | 'weak_password'
  | 'user_already_exists'
  | 'network_error'
  | 'unknown';

export interface AuthErrorInfo {
  type: AuthErrorType;
  title: string;
  description: string;
  action?: {
    label: string;
    handler: 'resend_verification' | 'goto_signup' | 'goto_login' | 'goto_forgot_password';
  };
}

export function parseAuthError(error: AuthError | Error | unknown): AuthErrorInfo {
  let errorMessage = '';

  if (error instanceof Error) {
    errorMessage = error.message.toLowerCase();
  } else if (typeof error === 'string') {
    errorMessage = error.toLowerCase();
  } else if (error && typeof error === 'object' && 'message' in error) {
    errorMessage = String(error.message).toLowerCase();
  }

  // CENÁRIO 1: Credenciais inválidas (email não existe OU senha errada)
  if (
    errorMessage.includes('invalid login credentials') ||
    errorMessage.includes('invalid_credentials') ||
    errorMessage.includes('email not found') ||
    errorMessage.includes('incorrect password')
  ) {
    return {
      type: 'invalid_credentials',
      title: '❌ Email ou senha incorretos',
      description: 'Verifique suas credenciais e tente novamente. Se não tem conta, cadastre-se.',
      action: {
        label: 'Criar conta',
        handler: 'goto_signup'
      }
    };
  }

  // CENÁRIO 2: Email não verificado
  if (
    errorMessage.includes('email not confirmed') ||
    errorMessage.includes('not_verified') ||
    errorMessage.includes('email_not_confirmed')
  ) {
    return {
      type: 'email_not_confirmed',
      title: '⚠️ Email não verificado',
      description: 'Verifique sua caixa de entrada e clique no link de verificação. Não esqueça de checar a pasta de spam.',
      action: {
        label: 'Reenviar email',
        handler: 'resend_verification'
      }
    };
  }

  // CENÁRIO 3: Rate limit (muitas tentativas)
  if (
    errorMessage.includes('rate limit') ||
    errorMessage.includes('too many requests') ||
    errorMessage.includes('email rate limit exceeded')
  ) {
    return {
      type: 'rate_limit',
      title: '⏱️ Muitas tentativas',
      description: 'Aguarde alguns minutos antes de tentar novamente. Isso protege sua conta contra acessos não autorizados.',
      action: undefined
    };
  }

  // CENÁRIO 4: Email inválido (formato)
  if (
    errorMessage.includes('invalid email') ||
    errorMessage.includes('invalid_email')
  ) {
    return {
      type: 'invalid_email',
      title: '❌ Email inválido',
      description: 'Verifique o formato do email (deve ser algo como: seu@email.com).',
      action: undefined
    };
  }

  // CENÁRIO 5: Senha fraca (não atende requisitos)
  if (
    errorMessage.includes('password') ||
    errorMessage.includes('weak') ||
    errorMessage.includes('too short')
  ) {
    return {
      type: 'weak_password',
      title: '❌ Senha fraca',
      description: 'A senha deve ter no mínimo 8 caracteres, incluindo letras maiúsculas, minúsculas e números.',
      action: undefined
    };
  }

  // CENÁRIO 6: Usuário já existe (signup)
  if (
    errorMessage.includes('already registered') ||
    errorMessage.includes('duplicate') ||
    errorMessage.includes('user already exists')
  ) {
    return {
      type: 'user_already_exists',
      title: '⚠️ Email já cadastrado',
      description: 'Este email já possui uma conta. Faça login ou recupere sua senha.',
      action: {
        label: 'Fazer login',
        handler: 'goto_login'
      }
    };
  }

  // CENÁRIO 7: Erro de rede
  if (
    errorMessage.includes('network') ||
    errorMessage.includes('fetch') ||
    errorMessage.includes('connection')
  ) {
    return {
      type: 'network_error',
      title: '🌐 Erro de conexão',
      description: 'Verifique sua internet e tente novamente.',
      action: undefined
    };
  }

  // CENÁRIO GENÉRICO
  return {
    type: 'unknown',
    title: '❌ Erro inesperado',
    description: errorMessage || 'Ocorreu um erro. Tente novamente ou entre em contato com o suporte.',
    action: undefined
  };
}
