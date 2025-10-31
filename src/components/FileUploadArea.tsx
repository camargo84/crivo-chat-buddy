import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Cloud, X, FileText, Loader2, CheckCircle2, Upload } from "lucide-react";
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
}

export const FileUploadArea = ({ projectId, onUploadComplete }: FileUploadAreaProps) => {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
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
      "text/plain",
      "text/csv",
      "text/markdown",
    ];

    const MAX_FILE_SIZE = 20 * 1024 * 1024;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (!allowedTypes.includes(file.type)) {
        toast.error(`Tipo não suportado: ${file.name}`);
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        toast.error(`Arquivo muito grande (máx 20MB): ${file.name}`);
        continue;
      }

      const uploadingFile: UploadingFile = {
        file,
        progress: 0,
        status: "uploading",
      };

      setUploadingFiles(prev => [...prev, uploadingFile]);
      uploadFile(file, uploadingFile);
    }
  };

  const uploadFile = async (file: File, uploadingFile: UploadingFile) => {
    try {
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

      const { data: urlData } = supabase.storage
        .from("demanda-attachments")
        .getPublicUrl(filePath);

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

      toast.success(`✅ ${file.name} anexado!`);
      updateFileStatus(file, { progress: 100, status: "complete" });
      onUploadComplete(attachment);

      setTimeout(() => {
        setUploadingFiles(prev => prev.filter(f => f.file !== file));
      }, 2000);

    } catch (error: any) {
      console.error("Upload error:", error);
      updateFileStatus(file, {
        status: "error",
        error: error.message || "Erro no upload",
      });
      toast.error(`Erro: ${error.message}`);
    }
  };

  const updateFileStatus = (file: File, updates: Partial<UploadingFile>) => {
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
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.png,.jpg,.jpeg,.webp,.gif,.txt,.csv,.md"
        onChange={(e) => e.target.files && handleFileSelection(e.target.files)}
        className="hidden"
      />

      {/* Área de Upload com Drag & Drop */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-8 transition-colors duration-200 ${
          isDragging 
            ? 'border-primary bg-primary/10' 
            : 'border-muted-foreground/30 hover:border-muted-foreground/50'
        } flex flex-col items-center justify-center gap-3 cursor-pointer`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center">
          <Cloud className="w-8 h-8 text-muted-foreground" />
        </div>
        
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">
            Arraste e solte arquivos
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            ou clique para selecionar
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            máx. 20MB • PDF, DOCX, PNG, JPG
          </p>
        </div>
      </div>

      {/* Upload em progresso */}
      {uploadingFiles.map((uploadFile, index) => (
        <div key={index} className="bg-muted/30 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-foreground flex-1 truncate">{uploadFile.file.name}</span>
            {uploadFile.status === "complete" && (
              <CheckCircle2 className="h-4 w-4 text-success" />
            )}
            {uploadFile.status === "analyzing" && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
          </div>
          <Progress value={uploadFile.progress} className="h-1" />
          {uploadFile.status === "analyzing" && (
            <p className="text-xs text-muted-foreground">Processando...</p>
          )}
        </div>
      ))}
    </div>
  );
};
