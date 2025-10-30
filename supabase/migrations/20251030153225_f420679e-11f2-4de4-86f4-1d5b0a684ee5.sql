-- Recalcular contadores de arquivos para todos os projetos
UPDATE projects p
SET attachment_count = (
  SELECT COUNT(*) 
  FROM attachments a 
  WHERE a.demanda_id = p.id 
    AND a.deleted_at IS NULL
);