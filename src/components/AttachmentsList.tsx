import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
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

      // 1. Deletar do Storage
      const { error: storageError } = await supabase.storage
        .from('demanda-attachments')
        .remove([attachment.file_path]);

      if (storageError) throw storageError;

      // 2. Deletar do banco
      const { error: dbError } = await supabase
        .from('attachments')
        .delete()
        .eq('id', attachmentId);

      if (dbError) throw dbError;

      toast.success('Arquivo removido com sucesso');
      loadAttachments();
    } catch (error) {
      console.error('Erro ao deletar arquivo:', error);
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

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return '🖼️';
    return '📄';
  };

  if (loading) {
    return (
      <div className="text-sm text-muted-foreground text-center py-2">
        Carregando arquivos...
      </div>
    );
  }

  if (attachments.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-2">
        📎 Nenhum arquivo anexado ainda. Use o botão de clipe abaixo para anexar documentos.
      </div>
    );
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {attachments.map((att) => (
        <div 
          key={att.id} 
          className="flex-shrink-0 p-3 bg-card border border-border rounded-lg min-w-[180px] relative group"
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground"
            onClick={() => handleDelete(att.id)}
          >
            <X className="h-4 w-4" />
          </Button>
          
          <div className="flex items-start gap-2">
            <span className="text-2xl">{getFileIcon(att.file_type)}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {att.file_name}
              </p>
              <span className="text-xs text-muted-foreground">
                {formatBytes(att.file_size)}
              </span>
            </div>
          </div>
          
          {att.file_type.startsWith('image/') && att.storage_url && (
            <img 
              src={att.storage_url} 
              alt={att.file_name}
              className="w-full h-20 object-cover rounded mt-2"
            />
          )}
        </div>
      ))}
    </div>
  );
}