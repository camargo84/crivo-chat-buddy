import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useDemanda() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const createDemanda = async (situacaoProblema: string) => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      toast.error('❌ Não autenticado', {
        description: 'Você precisa estar logado para criar uma demanda.'
      });
      return null;
    }

    setLoading(true);

    try {
      // Validação final
      const trimmed = situacaoProblema.trim();
      
      if (trimmed.length < 10) {
        throw new Error('Situação-problema muito curta (mínimo 10 caracteres)');
      }
      
      if (trimmed.length > 150) {
        throw new Error('Situação-problema muito longa (máximo 150 caracteres)');
      }

      // Gerar título a partir dos primeiros 80 caracteres
      const titulo = trimmed.length > 80 
        ? trimmed.substring(0, 77) + '...' 
        : trimmed;

      // Buscar perfil do usuário para pegar organization_id
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

      // Criar registro no banco
      const { data: project, error: insertError } = await supabase
        .from('projects')
        .insert({
          user_id: user.id,
          organization_id: profile?.organization_id,
          name: titulo,
          description: trimmed,
          status: 'em_formalizacao',
          current_enfoque: 'cenario'
        })
        .select()
        .single();

      if (insertError) {
        console.error('Erro ao inserir projeto:', insertError);
        throw new Error('Erro ao criar demanda no banco de dados');
      }

      if (!project) {
        throw new Error('Projeto não foi criado (retorno vazio)');
      }

      // Log de sucesso
      console.log('✅ Demanda criada com sucesso:', project);

      // Toast de sucesso
      toast.success('✅ Demanda criada!', {
        description: 'Iniciando conversa com o agente especializado...'
      });

      // Aguardar 500ms para toast ser visualizado
      await new Promise(resolve => setTimeout(resolve, 500));

      // Redirecionar para chat do agente
      navigate(`/agente-cenario/${project.id}`);

      return project;

    } catch (error) {
      console.error('❌ Erro ao criar demanda:', error);
      
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Erro desconhecido ao criar demanda';

      toast.error('❌ Erro ao criar demanda', {
        description: errorMessage
      });

      return null;

    } finally {
      setLoading(false);
    }
  };

  return {
    createDemanda,
    loading
  };
}
