import { useEffect, useState } from 'react';
import { FileText, Image as ImageIcon } from 'lucide-react';
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

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return '🖼️';
    return '📄';
  };

  if (loading) return null;
  if (attachments.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {attachments.map((att) => (
        <div 
          key={att.id} 
          className="flex-shrink-0 p-3 bg-card border border-border rounded-lg min-w-[180px]"
        >
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
        </div>
      ))}
    </div>
  );
}