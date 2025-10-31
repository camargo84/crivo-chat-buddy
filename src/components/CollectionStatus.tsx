import { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Circle, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  projectId: string;
  onGenerateReport: () => void;
}

export function CollectionStatus({ projectId, onGenerateReport }: Props) {
  const [status, setStatus] = useState({
    complete: false,
    answered: 0,
    total: 20,
    phase: 'universal',
    filesAnalyzed: 0
  });

  useEffect(() => {
    loadStatus();
    
    const channel = supabase
      .channel(`project_${projectId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'projects',
        filter: `id=eq.${projectId}`
      }, (payload) => {
        if (payload.new.collection_status) {
          updateStatus(payload.new.collection_status);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  const loadStatus = async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('collection_status')
      .eq('id', projectId)
      .single();

    if (!error && data?.collection_status) {
      updateStatus(data.collection_status);
    }
  };

  const updateStatus = (collectionStatus: any) => {
    setStatus({
      complete: collectionStatus.complete || false,
      answered: collectionStatus.answered?.length || 0,
      total: collectionStatus.total_questions || 20,
      phase: collectionStatus.phase || 'universal',
      filesAnalyzed: collectionStatus.files_analyzed || 0
    });
  };

  const progress = (status.answered / status.total) * 100;

  const essentialInfo = [
    'Identificação',
    'Problema / Necessidade',
    'Impacto',
    'Beneficiários',
    'Solução Candidata',
    'Quantitativos',
    'Prazos',
    'Orçamento'
  ];

  return (
    <div className="h-full flex flex-col p-6 space-y-6">
      {/* Título */}
      <div>
        <h2 className="text-lg font-bold text-foreground">Status da Coleta</h2>
        <p className="text-xs text-muted-foreground mt-1">
          A conversa está vazia. Para uma análise completa, forneça detalhes sobre a demanda.
        </p>
      </div>

      {/* Completude */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">Completude</span>
          <Badge variant="default" className="bg-accent text-accent-foreground font-bold">
            {Math.round(progress)}%
          </Badge>
        </div>
        <Progress value={progress} className="h-2 bg-muted" />
      </div>

      {/* Informações Essenciais */}
      <div className="space-y-3 flex-1">
        <h3 className="text-sm font-semibold text-foreground">Informações Essenciais</h3>
        <div className="space-y-2">
          {essentialInfo.map((item, index) => (
            <div key={item} className="flex items-center gap-2">
              <Circle className={`w-4 h-4 ${index < status.answered ? 'text-success fill-success' : 'text-muted-foreground'}`} />
              <span className="text-sm text-muted-foreground">{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Botão Baixar Relatório (rodapé fixo) */}
      <div className="pt-4 border-t border-border space-y-2">
        <Button 
          variant="outline" 
          className="w-full justify-start gap-2 bg-muted/50 hover:bg-muted text-foreground"
          onClick={onGenerateReport}
          disabled={status.answered < 10}
        >
          <FileText className="w-4 h-4" />
          Baixar Relatório DOCX
        </Button>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <span className="text-success">🔒</span>
          Dados seguros em conformidade com a Lei 14.133/2021
        </p>
      </div>
    </div>
  );
}
