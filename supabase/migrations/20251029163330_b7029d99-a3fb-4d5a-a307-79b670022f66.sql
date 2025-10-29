-- Corrigir função search_projects com search_path seguro
DROP FUNCTION IF EXISTS search_projects(TEXT, UUID, BOOLEAN);

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
) 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

COMMENT ON FUNCTION search_projects IS 'Busca global em títulos e conversas dos projetos com ranking por similaridade';