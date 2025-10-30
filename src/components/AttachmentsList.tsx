import { useEffect, useState } from 'react';
import { FileText, Download, CheckCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  projectId: string;
}

export function AttachmentsList({ projectId }: Props) {
  const [attachments, setAttachments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAttachments();
    
    const channel = supabase
      .channel(`attachments_${projectId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'attachments',
        filter: `demanda_id=eq.${projectId}`
      }, () => {
        loadAttachments();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  const loadAttachments = async () => {
    const { data, error } = await supabase
      .from('attachments')
      .select('*')
      .eq('demanda_id', projectId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setAttachments(data);
    }
    setLoading(false);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (loading) return <div className="p-4 text-sm text-muted-foreground">Carregando...</div>;
  if (attachments.length === 0) return null;

  return (
    <div className="border-t border-border p-4">
      <h3 className="font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
        <FileText className="w-4 h-4" />
        Documentos Anexados ({attachments.length})
      </h3>
      
      <div className="space-y-2">
        {attachments.map((att) => (
          <div 
            key={att.id} 
            className="flex items-start gap-2 p-3 bg-accent rounded-lg hover:bg-accent/80 transition-colors"
          >
            <FileText className="w-4 h-4 text-primary mt-1 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {att.file_name}
              </p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-xs text-muted-foreground">
                  {formatBytes(att.file_size)}
                </span>
                {att.extracted_content ? (
                  <Badge variant="default" className="text-xs gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Analisado
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs gap-1">
                    <Clock className="w-3 h-3" />
                    Processando
                  </Badge>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0"
              onClick={() => window.open(att.storage_url, '_blank')}
            >
              <Download className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}