import { useEffect, useState } from 'react';
import { X, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

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
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setAttachments(data);
    }
    setLoading(false);
  };

  const handleDelete = async (attachmentId: string) => {
    try {
      const attachment = attachments.find(a => a.id === attachmentId);
      if (!attachment) return;

      const { error: storageError } = await supabase.storage
        .from('demanda-attachments')
        .remove([attachment.file_path]);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from('attachments')
        .delete()
        .eq('id', attachmentId);

      if (dbError) throw dbError;

      toast.success('Arquivo removido');
      loadAttachments();
    } catch (error) {
      console.error('Erro ao deletar:', error);
      toast.error('Erro ao remover arquivo');
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground text-center py-2">Carregando...</div>;
  }

  if (attachments.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        Nenhum arquivo anexado ainda.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {attachments.map((att) => (
        <div 
          key={att.id}
          className="bg-muted/30 rounded-lg p-3 relative group hover:bg-muted/50 transition-colors"
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => handleDelete(att.id)}
          >
            <X className="h-4 w-4" />
          </Button>

          {att.file_type.startsWith('image/') && att.storage_url && (
            <img 
              src={att.storage_url}
              alt={att.file_name}
              className="w-full h-24 object-cover rounded mb-2"
            />
          )}

          <div className="flex items-start gap-2">
            <FileText className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {att.file_name}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground">
                  {formatBytes(att.file_size)}
                </span>
                {att.extracted_content ? (
                  <span className="text-xs text-success">✓</span>
                ) : (
                  <span className="text-xs text-warning">⏳</span>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
