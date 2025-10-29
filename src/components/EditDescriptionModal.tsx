import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { AlertCircle } from 'lucide-react';

interface EditDescriptionModalProps {
  projectId: string;
  currentName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Modal para edição rápida da situação-problema da demanda
 * Permite atualizar o título diretamente do dashboard
 */
export function EditDescriptionModal({ 
  projectId, 
  currentName, 
  isOpen, 
  onClose, 
  onSuccess 
}: EditDescriptionModalProps) {
  const [name, setName] = useState(currentName);
  const [isLoading, setIsLoading] = useState(false);
  
  // Sincronizar com título atual quando modal abre
  useEffect(() => {
    if (isOpen) {
      setName(currentName);
    }
  }, [isOpen, currentName]);
  
  const handleSave = async () => {
    // Validação: campo vazio
    if (!name.trim()) {
      toast.error('A situação-problema não pode estar vazia.');
      return;
    }
    
    // Validação: limite de caracteres
    if (name.length > 280) {
      toast.error('Máximo 280 caracteres permitidos.');
      return;
    }
    
    // Validação: sem mudanças
    if (name.trim() === currentName.trim()) {
      toast.info('O texto não foi modificado.');
      onClose();
      return;
    }
    
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('projects')
        .update({ 
          name: name.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', projectId);
      
      if (error) throw error;
      
      toast.success('Descrição atualizada com sucesso!');
      
      onSuccess();
      onClose();
      
    } catch (error) {
      console.error('[EditDescription] Erro ao atualizar:', error);
      toast.error('Erro ao atualizar. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleCancel = () => {
    setName(currentName);
    onClose();
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Editar Situação-Problema
          </DialogTitle>
          <DialogDescription>
            Atualize a descrição do problema que originou esta demanda.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <Textarea
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Descreva a situação-problema..."
            rows={6}
            maxLength={280}
            className="resize-none text-base"
            autoFocus
          />
          
          <div className="flex justify-between items-center text-xs">
            <div className="flex items-center gap-1 text-muted-foreground">
              <AlertCircle className="w-3 h-3" />
              <span>Descreva o <strong>problema</strong>, não a solução</span>
            </div>
            <span className={`font-mono font-medium transition-colors ${
              name.length > 260 ? 'text-orange-600' : 
              name.length > 240 ? 'text-yellow-600' : 
              'text-muted-foreground'
            }`}>
              {name.length}/280
            </span>
          </div>
        </div>
        
        <DialogFooter className="gap-2">
          <Button 
            variant="outline" 
            onClick={handleCancel} 
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isLoading}
          >
            {isLoading ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
