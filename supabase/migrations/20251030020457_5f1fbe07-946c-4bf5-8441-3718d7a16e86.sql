-- ONDA 1: Campos de controle de coleta e dados estruturados

-- 1. Campo para controlar status da coleta
ALTER TABLE projects ADD COLUMN IF NOT EXISTS collection_status JSONB DEFAULT '{
  "complete": false,
  "phase": "universal",
  "answered": [],
  "total_questions": 20,
  "files_analyzed": 0
}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_projects_collection_status ON projects USING gin(collection_status);

-- 2. Campo para armazenar dados estruturados (DFD sem mencionar DFD)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS structured_data JSONB DEFAULT '{}'::jsonb;
COMMENT ON COLUMN projects.structured_data IS 'Dados estruturados coletados para composição do relatório';

-- 3. Função para incrementar contador de arquivos
CREATE OR REPLACE FUNCTION increment_files_analyzed(project_id_param UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE projects
  SET collection_status = jsonb_set(
    collection_status,
    '{files_analyzed}',
    to_jsonb(COALESCE((collection_status->>'files_analyzed')::int, 0) + 1)
  )
  WHERE id = project_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Função para atualizar progresso
CREATE OR REPLACE FUNCTION update_collection_progress(
  project_id_param UUID,
  question_number INT,
  phase TEXT
)
RETURNS VOID AS $$
BEGIN
  UPDATE projects
  SET collection_status = jsonb_set(
    jsonb_set(
      jsonb_set(
        collection_status,
        '{answered}',
        (
          SELECT jsonb_agg(DISTINCT elem)
          FROM (
            SELECT jsonb_array_elements(collection_status->'answered') as elem
            UNION
            SELECT to_jsonb(question_number)
          ) x
        )
      ),
      '{phase}',
      to_jsonb(phase)
    ),
    '{complete}',
    CASE 
      WHEN jsonb_array_length(
        (SELECT jsonb_agg(DISTINCT elem)
         FROM (
           SELECT jsonb_array_elements(collection_status->'answered') as elem
           UNION
           SELECT to_jsonb(question_number)
         ) x)
      ) >= 20 THEN 'true'::jsonb
      ELSE 'false'::jsonb
    END
  )
  WHERE id = project_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;