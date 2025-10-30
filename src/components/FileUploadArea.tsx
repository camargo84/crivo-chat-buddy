import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Paperclip, X, FileText, Image, File, Loader2, CheckCircle2, Upload } from "lucide-react";
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

interface StagedFile {
  file: File;
  preview?: string;
}

export const FileUploadArea = ({ projectId, onUploadComplete }: FileUploadAreaProps) => {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return <Image className="h-4 w-4" />;
    if (type.includes("pdf")) return <FileText className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  const handleFileSelection = async (files: FileList) => {
    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
      "image/gif",
      "image/svg+xml",
      "image/bmp",
      "image/tiff",
      "text/plain",
      "text/csv",
      "text/markdown",
    ];

    const MAX_FILES_PER_UPLOAD = 10;
    const MAX_FILES_PER_PROJECT = 50;
    const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

    // Validar quantidade de arquivos por upload
    if (files.length > MAX_FILES_PER_UPLOAD) {
      toast.error(`Máximo de ${MAX_FILES_PER_UPLOAD} arquivos por upload`);
      return;
    }

    // Buscar contador atual do projeto
    const { data: project } = await supabase
      .from('projects')
      .select('attachment_count')
      .eq('id', projectId)
      .single();

    const currentCount = project?.attachment_count || 0;
    const totalAfterUpload = currentCount + stagedFiles.length + files.length;

    if (totalAfterUpload > MAX_FILES_PER_PROJECT) {
      toast.error(`Limite de ${MAX_FILES_PER_PROJECT} arquivos por projeto atingido (atual: ${currentCount}). Remova arquivos antigos antes de continuar.`);
      return;
    }

    const newStagedFiles: StagedFile[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Validar tipo
      if (!allowedTypes.includes(file.type)) {
        toast.error(`Tipo não suportado: ${file.name}`);
        continue;
      }

      // Validar tamanho
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`Arquivo muito grande (máx 20MB): ${file.name}`);
        continue;
      }

      // Gerar preview para imagens
      let preview: string | undefined;
      if (file.type.startsWith("image/")) {
        preview = URL.createObjectURL(file);
      }

      newStagedFiles.push({ file, preview });
    }

    setStagedFiles(prev => [...prev, ...newStagedFiles]);
    
    if (newStagedFiles.length > 0) {
      toast.success(`${newStagedFiles.length} arquivo(s) selecionado(s). Clique em "Enviar" para fazer upload.`);
    }
  };

  const removeStagedFile = (index: number) => {
    setStagedFiles(prev => {
      const newFiles = [...prev];
      // Revogar URL do preview se houver
      if (newFiles[index].preview) {
        URL.revokeObjectURL(newFiles[index].preview!);
      }
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const handleStartUpload = async () => {
    if (stagedFiles.length === 0) {
      toast.error("Nenhum arquivo selecionado");
      return;
    }

    toast.info(`Iniciando upload de ${stagedFiles.length} arquivo(s)...`);

    for (const staged of stagedFiles) {
      const uploadingFile: UploadingFile = {
        file: staged.file,
        progress: 0,
        status: "uploading",
      };

      setUploadingFiles(prev => [...prev, uploadingFile]);
      await uploadFile(staged.file, uploadingFile);

      // Revogar preview após upload
      if (staged.preview) {
        URL.revokeObjectURL(staged.preview);
      }
    }

    setStagedFiles([]);
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
      // 1. Upload to Storage (FASE 2: adicionar UUID para evitar colisão)
      const timestamp = Date.now();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const uuid = crypto.randomUUID().substring(0, 8);
      const filePath = `${projectId}/${timestamp}_${uuid}_${sanitizedName}`;

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

      updateFileStatus(file, { progress: 60, status: "analyzing" });

      // 4. Processar em background
      supabase.functions
        .invoke("extract-document-content", {
          body: {
            attachmentId: attachment.id,
            fileUrl: urlData.publicUrl,
            fileType: file.type,
            fileName: file.name,
            projectId: projectId,
          },
        })
        .then(() => {
          console.log(`✅ Processamento concluído para ${file.name}`);
        })
        .catch((err) => {
          console.warn(`⚠️ Falha no processamento de ${file.name}:`, err);
        });

      toast.success(`✅ ${file.name} anexado! Processando conteúdo...`);

      updateFileStatus(file, { progress: 100, status: "complete" });
      onUploadComplete(attachment);

      // Remove from list after 2 seconds
      setTimeout(() => {
        setUploadingFiles(prev => prev.filter(f => f.file !== file));
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
    setUploadingFiles(prev =>
      prev.map(f =>
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
      handleFileSelection(e.dataTransfer.files);
    }
  };

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.png,.jpg,.jpeg,.webp,.gif,.svg,.bmp,.tiff,.txt,.csv,.md"
        onChange={(e) => e.target.files && handleFileSelection(e.target.files)}
        className="hidden"
      />

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingFiles.some(f => f.status === "uploading")}
        >
          <Paperclip className="h-5 w-5" />
        </Button>

        {stagedFiles.length > 0 && (
          <Button
            variant="default"
            size="sm"
            onClick={handleStartUpload}
            disabled={uploadingFiles.some(f => f.status === "uploading")}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            Enviar {stagedFiles.length} arquivo(s)
          </Button>
        )}
      </div>

      {/* FASE 4: Preview dos arquivos selecionados (staged) */}
      {stagedFiles.length > 0 && (
        <Card className="p-4 space-y-3">
          <div className="text-sm font-medium text-muted-foreground mb-2">
            Arquivos selecionados ({stagedFiles.length}/10):
          </div>
          {stagedFiles.map((staged, index) => (
            <div key={index} className="flex items-center gap-3 p-2 rounded-md bg-muted/50">
              {staged.preview ? (
                <img 
                  src={staged.preview} 
                  alt={staged.file.name} 
                  className="h-12 w-12 object-cover rounded"
                />
              ) : (
                <div className="h-12 w-12 flex items-center justify-center bg-muted rounded">
                  {getFileIcon(staged.file.type)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{staged.file.name}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(staged.file.size)}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeStagedFile(index)}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </Card>
      )}

      {/* Upload em progresso */}
      {uploadingFiles.length > 0 && (
        <Card className="p-4 space-y-3">
          <div className="text-sm font-medium text-muted-foreground mb-2">
            Enviando arquivos:
          </div>
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
              PDF, DOCX, PNG, JPG, WEBP, GIF, SVG, BMP, TIFF, TXT, CSV, MD (máx 20MB cada, 10 arquivos por upload)
            </p>
          </Card>
        </div>
      )}
    </div>
  );
};
