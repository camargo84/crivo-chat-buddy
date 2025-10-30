import { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Circle, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  projectId: string;
}

export function CollectionStatus({ projectId }: Props) {
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

  return (
    <div className="bg-card border-b border-border p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          {status.complete ? (
            <CheckCircle className="w-6 h-6 text-green-600" />
          ) : (
            <Circle className="w-6 h-6 text-primary animate-pulse" />
          )}
          <div>
            <h3 className="font-semibold text-foreground">
              {status.complete ? '✅ Coleta Concluída' : '⏳ Coletando Informações'}
            </h3>
            <p className="text-xs text-muted-foreground">
              {status.complete 
                ? 'Pronto para gerar relatório'
                : `Fase: ${status.phase === 'universal' ? 'Perguntas Universais (1-10)' : 'Perguntas Específicas (11-20)'}`
              }
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {status.filesAnalyzed > 0 && (
            <Badge variant="outline" className="gap-1">
              <FileText className="w-3 h-3" />
              {status.filesAnalyzed} arquivo{status.filesAnalyzed !== 1 ? 's' : ''}
            </Badge>
          )}
          <Badge variant={status.complete ? 'default' : 'secondary'} className="text-sm font-bold">
            {status.answered}/{status.total}
          </Badge>
        </div>
      </div>
      
      <Progress value={progress} className="h-2" />
    </div>
  );
}