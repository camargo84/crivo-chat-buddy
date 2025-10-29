import { useState } from 'react';
import { Card, CardHeader, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, ExternalLink, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { EditDescriptionModal } from './EditDescriptionModal';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

interface ProjectCardProps {
  project: {
    id: string;
    name: string;
    status: string;
    current_enfoque: string;
    last_accessed_at: string;
    created_at: string;
  };
  onUpdate: () => void;
}

/**
 * Card de demanda no dashboard
 * Com botões de Abrir e Editar descrição
 */
export function ProjectCard({ project, onUpdate }: ProjectCardProps) {
  const navigate = useNavigate();
  const [showEditModal, setShowEditModal] = useState(false);
  
  const handleOpen = async () => {
    console.log(`[ProjectCard] Abrindo projeto ${project.id}`);
    
    // Atualizar last_accessed_at
    await supabase
      .from('projects')
      .update({ last_accessed_at: new Date().toISOString() })
      .eq('id', project.id);
    
    // Navegar para projeto
    navigate(`/agente-cenario/${project.id}`);
  };
  
  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowEditModal(true);
  };
  
  return (
    <>
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            {/* Título/Situação-Problema */}
            <p className="text-sm text-foreground line-clamp-3 leading-relaxed flex-1 min-w-0">
              {project.name}
            </p>
            
            {/* Badge de etapa */}
            <Badge variant="secondary" className="shrink-0 capitalize">
              {project.current_enfoque}
            </Badge>
          </div>
        </CardHeader>
        
        <CardFooter className="flex flex-col gap-3 pt-3 border-t">
          {/* Timestamp de último acesso */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground w-full">
            <Clock className="w-3 h-3 shrink-0" />
            <span className="truncate">
              Acessado {formatDistanceToNow(new Date(project.last_accessed_at), { 
                locale: ptBR, 
                addSuffix: true 
              })}
            </span>
          </div>
          
          {/* Botões de ação */}
          <div className="flex gap-2 w-full">
            <Button 
              className="flex-1 gap-2" 
              size="sm"
              onClick={handleOpen}
            >
              <ExternalLink className="w-4 h-4" />
              Abrir
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              className="gap-2"
              onClick={handleEditClick}
              title="Editar descrição da situação-problema"
            >
              <Edit className="w-4 h-4" />
              Editar
            </Button>
          </div>
        </CardFooter>
      </Card>
      
      {/* Modal de edição */}
      <EditDescriptionModal
        projectId={project.id}
        currentName={project.name}
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSuccess={onUpdate}
      />
    </>
  );
}
