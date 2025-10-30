import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Paperclip, X, FileText, Image, File, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface FileUploadAreaProps {
  projectId: string;
  onUploadComplete: (file: any) => void;
}

interface UploadingFile {
  file: File;
  progress: number;
  status: "uploading" | "analyzing" | "complete" | "error";
  error?: string;
  attachmentId?: string;
}

export const FileUploadArea = ({ projectId, onUploadComplete }: FileUploadAreaProps) => {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return <Image className="h-4 w-4" />;
    if (type.includes("pdf")) return <FileText className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  const handleFiles = async (files: FileList) => {
    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/png",
      "image/jpeg",
      "image/jpg",
      "text/plain",
      "text/csv",
      "text/markdown",
    ];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (!allowedTypes.includes(file.type)) {
        toast.error(`Tipo de arquivo não suportado: ${file.name}`);
        continue;
      }

      if (file.size > 20 * 1024 * 1024) {
        toast.error(`Arquivo muito grande (máx 20MB): ${file.name}`);
        continue;
      }

      const uploadingFile: UploadingFile = {
        file,
        progress: 0,
        status: "uploading",
      };

      setUploadingFiles((prev) => [...prev, uploadingFile]);
      await uploadFile(file, uploadingFile);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const uploadFile = async (file: File, uploadingFile: UploadingFile) => {
    try {
      // 1. Upload to Storage
      const timestamp = Date.now();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const filePath = `${projectId}/${timestamp}_${sanitizedName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("demanda-attachments")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      updateFileStatus(file, { progress: 40, status: "analyzing" });

      // 2. Get public URL
      const { data: urlData } = supabase.storage
        .from("demanda-attachments")
        .getPublicUrl(filePath);

      // 3. Create attachment record
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: attachment, error: attachmentError } = await supabase
        .from("attachments")
        .insert({
          demanda_id: projectId,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          file_path: filePath,
          storage_url: urlData.publicUrl,
          uploaded_by: user.id,
        })
        .select()
        .single();

      if (attachmentError) throw attachmentError;

      updateFileStatus(file, { progress: 50, attachmentId: attachment.id });

      // 4. Create visual message in conversation (processing)
      const { data: messageData, error: msgError } = await supabase
        .from('demanda_messages')
        .insert({
          demanda_id: projectId,
          role: 'user',
          content: `📎 **Anexou arquivo:** ${file.name}\n\n_Tamanho: ${formatBytes(file.size)}_\n_Tipo: ${file.type}_\n\n⏳ Processando documento...`,
          metadata: { 
            type: 'attachment',
            attachment_id: attachment.id,
            file_name: file.name,
            file_type: file.type,
            status: 'processing'
          }
        })
        .select()
        .single();

      if (msgError) console.error('Erro ao criar mensagem:', msgError);

      updateFileStatus(file, { progress: 60 });

      // 5. Call extraction function for supported types
      if (file.type.includes("pdf") || file.type.includes("wordprocessing") || file.type.startsWith("image/")) {
        try {
          const { data: extractResult, error: extractError } = await supabase.functions.invoke(
            'extract-document-content',
            {
              body: {
                attachmentId: attachment.id,
                fileUrl: urlData.publicUrl,
                fileType: file.type,
                fileName: file.name,
                projectId: projectId
              }
            }
          );

          if (extractError || !extractResult?.success) {
            // Update message to error
            if (messageData) {
              await supabase
                .from('demanda_messages')
                .update({
                  content: `📎 **Arquivo:** ${file.name}\n\n❌ Não foi possível processar. Erro: ${extractError?.message || 'Desconhecido'}\n\nVocê pode descrever o conteúdo manualmente.`,
                  metadata: { 
                    type: 'attachment',
                    attachment_id: attachment.id,
                    file_name: file.name,
                    status: 'error'
                  }
                })
                .eq('id', messageData.id);
            }
            
            toast.error('Erro ao processar documento');
          } else {
            // Update message to success
            if (messageData) {
              await supabase
                .from('demanda_messages')
                .update({
                  content: `📎 **Arquivo analisado:** ${file.name}\n\n✅ Documento processado com sucesso!\n_${extractResult.extractedLength || 0} caracteres extraídos_\n\n🤖 O agente está revisando as informações...`,
                  metadata: { 
                    type: 'attachment',
                    attachment_id: attachment.id,
                    file_name: file.name,
                    status: 'completed',
                    extracted_length: extractResult.extractedLength
                  }
                })
                .eq('id', messageData.id);
            }

            // Notify agent to review questions
            await supabase.from('demanda_messages').insert({
              demanda_id: projectId,
              role: 'system',
              content: `SISTEMA: Arquivo "${file.name}" processado. Revisar perguntas e buscar respostas no conteúdo extraído.`,
              metadata: { 
                type: 'system_trigger',
                action: 'review_after_upload',
                attachment_id: attachment.id
              }
            });

            toast.success(`Arquivo ${file.name} processado!`);
          }
        } catch (analysisError) {
          console.error('Erro ao analisar:', analysisError);
        }
      } else {
        // For unsupported types, just mark as uploaded
        if (messageData) {
          await supabase
            .from('demanda_messages')
            .update({
              content: `📎 **Arquivo anexado:** ${file.name}\n\n✅ Arquivo carregado com sucesso!`,
              metadata: { 
                type: 'attachment',
                attachment_id: attachment.id,
                file_name: file.name,
                status: 'completed'
              }
            })
            .eq('id', messageData.id);
        }
        toast.success(`Arquivo ${file.name} anexado!`);
      }

      updateFileStatus(file, { progress: 100, status: "complete" });
      onUploadComplete(attachment);

      // Remove from list after 2 seconds
      setTimeout(() => {
        setUploadingFiles((prev) => prev.filter((f) => f.file !== file));
      }, 2000);

    } catch (error: any) {
      console.error("Upload error:", error);
      updateFileStatus(file, {
        status: "error",
        error: error.message || "Erro no upload",
      });
      toast.error(`Erro ao enviar ${file.name}: ${error.message}`);
    }
  };

  const updateFileStatus = (
    file: File,
    updates: Partial<UploadingFile>
  ) => {
    setUploadingFiles((prev) =>
      prev.map((f) =>
        f.file === file ? { ...f, ...updates } : f
      )
    );
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  };

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.png,.jpg,.jpeg,.txt,.csv,.md"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
        className="hidden"
      />

      <Button
        variant="outline"
        size="icon"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploadingFiles.some((f) => f.status === "uploading")}
      >
        <Paperclip className="h-5 w-5" />
      </Button>

      {uploadingFiles.length > 0 && (
        <Card className="p-4 space-y-3">
          {uploadingFiles.map((uploadFile, index) => (
            <div key={index} className="space-y-2">
              <div className="flex items-center gap-2">
                {getFileIcon(uploadFile.file.type)}
                <span className="text-sm flex-1 truncate">{uploadFile.file.name}</span>
                {uploadFile.status === "complete" && (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                )}
                {uploadFile.status === "analyzing" && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {uploadFile.status === "error" && (
                  <X className="h-4 w-4 text-destructive" />
                )}
              </div>
              <Progress value={uploadFile.progress} className="h-1" />
              {uploadFile.status === "analyzing" && (
                <p className="text-xs text-muted-foreground">Analisando documento com IA...</p>
              )}
              {uploadFile.error && (
                <p className="text-xs text-destructive">{uploadFile.error}</p>
              )}
            </div>
          ))}
        </Card>
      )}

      {isDragging && (
        <div
          className="fixed inset-0 bg-primary/10 backdrop-blur-sm z-50 flex items-center justify-center"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Card className="p-8 text-center">
            <Paperclip className="h-12 w-12 mx-auto mb-4 text-primary" />
            <p className="text-lg font-medium">Solte os arquivos aqui</p>
            <p className="text-sm text-muted-foreground mt-2">
              PDF, DOCX, PNG, JPG, TXT, CSV, MD (máx 20MB)
            </p>
          </Card>
        </div>
      )}
    </div>
  );
};
