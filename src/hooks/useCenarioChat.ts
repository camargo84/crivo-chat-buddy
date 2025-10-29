import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { callAI, isResponseTooShort, isResponseVague, type Message } from '@/lib/ai-service';
import { getStandardQuestion } from '@/lib/prompts/standard-questions';
import { generateAdaptiveQuestions } from '@/lib/prompts/adaptive-questions';
import { monitorCompleteness, type CompletenessStatus } from '@/lib/completeness-monitor';
import { generateSynthesis, type SynthesisData } from '@/lib/synthesis-service';

interface Props {
  projectId: string;
  userProfile: any;
  demandaTitle: string;
}

export function useCenarioChat({ projectId, userProfile, demandaTitle }: Props) {
  const { toast } = useToast();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [adaptiveQuestions, setAdaptiveQuestions] = useState<string[]>([]);
  const [completenessStatus, setCompletenessStatus] = useState<CompletenessStatus | null>(null);
  const [synthesisData, setSynthesisData] = useState<SynthesisData | null>(null);
  const [phase, setPhase] = useState<'questions' | 'synthesis' | 'complete'>('questions');
  
  useEffect(() => {
    if (userProfile && messages.length === 0) {
      initializeConversation();
    }
  }, [userProfile]);
  
  useEffect(() => {
    const userMsgs = messages.filter(m => m.role === 'user');
    if (userMsgs.length > 0 && userMsgs.length % 2 === 0) {
      checkCompleteness();
    }
  }, [messages]);
  
  async function initializeConversation() {
    const intro = getStandardQuestion(1, userProfile, demandaTitle);
    const msg: Message = { role: 'assistant', content: intro };
    
    setMessages([msg]);
    setCurrentQuestion(1);
    await saveMessage(msg);
  }
  
  async function checkCompleteness() {
    try {
      const status = await monitorCompleteness(messages);
      setCompletenessStatus(status);
      
      await supabase
        .from('projects')
        .update({
          coleta_completa: status.isComplete,
          completude_score: status.score,
          informacoes_essenciais: status.essentialInfo
        })
        .eq('id', projectId);
      
    } catch (error) {
      console.error('[Check] Erro:', error);
    }
  }
  
  async function handleSendMessage(userMessage: string) {
    if (!userMessage.trim() || isLoading) return;
    
    try {
      setIsLoading(true);
      
      const userMsg: Message = { role: 'user', content: userMessage.trim() };
      const updated = [...messages, userMsg];
      setMessages(updated);
      await saveMessage(userMsg);
      
      // Validar resposta curta/vaga
      if (isResponseTooShort(userMessage) || isResponseVague(userMessage)) {
        const validation = await callAI({
          messages: updated,
          phase: 'validate_response',
          systemPrompt: `Resposta vaga: "${userMessage}". Peça mais detalhes com exemplos.`
        });
        
        const assistantMsg: Message = { role: 'assistant', content: validation };
        setMessages([...updated, assistantMsg]);
        await saveMessage(assistantMsg);
        setIsLoading(false);
        return;
      }
      
      const userAnswers = updated.filter(m => m.role === 'user').length;
      
      // FASE 1: Perguntas padrão (1-10)
      if (currentQuestion < 10) {
        const next = getStandardQuestion(currentQuestion + 1, userProfile, demandaTitle, userMessage);
        const assistantMsg: Message = { role: 'assistant', content: next };
        
        setMessages([...updated, assistantMsg]);
        await saveMessage(assistantMsg);
        setCurrentQuestion(currentQuestion + 1);
        
        if ((currentQuestion + 1) % 5 === 0) {
          toast({
            title: `🎉 ${currentQuestion + 1} perguntas!`,
            description: 'Indo muito bem!'
          });
        }
        
        setIsLoading(false);
        return;
      }
      
      // FASE 2: Gerar adaptativas
      if (currentQuestion === 10 && adaptiveQuestions.length === 0) {
        toast({ title: 'Processando...', description: 'Gerando perguntas específicas.' });
        
        const status = await monitorCompleteness(updated);
        setCompletenessStatus(status);
        
        const adaptive = await generateAdaptiveQuestions(updated, status);
        setAdaptiveQuestions(adaptive);
        
        if (adaptive.length > 0) {
          const first: Message = { role: 'assistant', content: adaptive[0] };
          setMessages([...updated, first]);
          await saveMessage(first);
          setCurrentQuestion(11);
        } else {
          await finalizeCollection(updated);
        }
        
        setIsLoading(false);
        return;
      }
      
      // FASE 3: Adaptativas (11-20)
      if (currentQuestion >= 11 && currentQuestion <= 20) {
        const idx = currentQuestion - 11;
        
        if (idx < adaptiveQuestions.length - 1) {
          const next: Message = { role: 'assistant', content: adaptiveQuestions[idx + 1] };
          setMessages([...updated, next]);
          await saveMessage(next);
          setCurrentQuestion(currentQuestion + 1);
        } else {
          await finalizeCollection(updated);
        }
        
        setIsLoading(false);
        return;
      }
      
    } catch (error) {
      console.error('[Send] Erro:', error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Tente novamente.' });
    } finally {
      setIsLoading(false);
    }
  }
  
  async function finalizeCollection(history: Message[]) {
    try {
      const status = await monitorCompleteness(history);
      
      if (!status.isComplete) {
        const warning: Message = {
          role: 'assistant',
          content: `⚠️ **Atenção:** Faltam: ${status.missingCritical.join(', ')}.\n\n**Opções:**\n1. Responder perguntas adicionais\n2. Prosseguir assim (complementar depois)\n\nO que prefere?`
        };
        
        setMessages([...history, warning]);
        await saveMessage(warning);
        return;
      }
      
      const success: Message = {
        role: 'assistant',
        content: `✅ **Coleta concluída!**\n\nTodas informações essenciais coletadas. Processando...\n\nAguarde.`
      };
      
      setMessages([...history, success]);
      await saveMessage(success);
      
      await startSynthesis(history);
      
    } catch (error) {
      console.error('[Finalize] Erro:', error);
    }
  }
  
  async function startSynthesis(history: Message[]) {
    try {
      setPhase('synthesis');
      
      const synthesis = await generateSynthesis(history, userProfile);
      setSynthesisData(synthesis);
      
      await supabase
        .from('projects')
        .update({
          synthesis_data: synthesis as any,
          current_enfoque: 'requisitos',
          coleta_completa: true,
          completude_score: 100
        })
        .eq('id', projectId);
      
      const conclusion: Message = {
        role: 'assistant',
        content: `✅ **Síntese concluída!**\n\n**Próximos passos:**\n- Baixar Relatório .docx\n- Visualizar Síntese\n- Prosseguir para Requisitos\n\nUse os botões abaixo.`
      };
      
      setMessages([...history, conclusion]);
      await saveMessage(conclusion);
      setPhase('complete');
      
      toast({ title: '✅ Cenário concluído!', description: 'Baixe o relatório.' });
      
    } catch (error) {
      console.error('[Synthesis] Erro:', error);
      toast({ variant: 'destructive', title: 'Erro síntese', description: 'Tente novamente.' });
      setPhase('questions');
    }
  }
  
  async function saveMessage(msg: Message) {
    try {
      await supabase.from('demanda_messages').insert({
        demanda_id: projectId,
        role: msg.role,
        content: msg.content
      });
    } catch (error) {
      console.error('[DB] Erro:', error);
    }
  }
  
  return {
    messages,
    isLoading,
    currentQuestion,
    completenessStatus,
    synthesisData,
    phase,
    handleSendMessage
  };
}
