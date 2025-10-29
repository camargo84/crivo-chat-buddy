-- 1. Ampliar campo name para 280 caracteres (tabela projects)
ALTER TABLE projects ALTER COLUMN name TYPE VARCHAR(280);
COMMENT ON COLUMN projects.name IS 'Situação-problema da demanda (máximo 280 caracteres)';

-- 2. Adicionar campo last_accessed_at para controle de ordenação
ALTER TABLE projects ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
COMMENT ON COLUMN projects.last_accessed_at IS 'Última vez que usuário acessou/abriu o projeto';

-- 3. Ativar extensão trigram para busca fuzzy
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 4. Criar índices para performance de busca e ordenação
CREATE INDEX IF NOT EXISTS idx_projects_last_accessed ON projects(last_accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_name_trgm ON projects USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_messages_content_trgm ON demanda_messages USING gin(content gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_projects_user_visibility ON projects(user_id, visibility_status);

-- 5. Criar função de busca global com busca em títulos e conversas
CREATE OR REPLACE FUNCTION search_projects(
  search_query TEXT,
  user_id_param UUID,
  search_archived BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  id UUID,
  name VARCHAR(280),
  status TEXT,
  current_enfoque TEXT,
  last_accessed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE,
  similarity REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (p.id)
    p.id,
    p.name,
    p.status,
    p.current_enfoque,
    p.last_accessed_at,
    p.created_at,
    GREATEST(
      COALESCE(similarity(p.name, search_query), 0),
      COALESCE(
        (SELECT MAX(similarity(dm.content, search_query))
         FROM demanda_messages dm
         WHERE dm.demanda_id = p.id),
        0
      )
    )::REAL as similarity
  FROM projects p
  WHERE p.user_id = user_id_param
    AND (
      (search_archived = TRUE AND p.visibility_status = 'arquivada') OR
      (search_archived = FALSE AND p.visibility_status = 'ativa')
    )
    AND (
      p.name ILIKE '%' || search_query || '%'
      OR EXISTS (
        SELECT 1 FROM demanda_messages dm
        WHERE dm.demanda_id = p.id
          AND dm.content ILIKE '%' || search_query || '%'
      )
    )
  ORDER BY p.id, similarity DESC, p.last_accessed_at DESC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION search_projects IS 'Busca global em títulos e conversas dos projetos com ranking por similaridade';

-- 6. Migrar projetos existentes com título > 280 caracteres (se necessário)
UPDATE projects
SET name = LEFT(name, 277) || '...'
WHERE LENGTH(name) > 280;