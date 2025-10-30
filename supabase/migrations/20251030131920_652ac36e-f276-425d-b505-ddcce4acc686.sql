-- FASE 2: Habilitar Realtime para tabela attachments (sem IF NOT EXISTS)
DO $$ 
BEGIN
  -- Adicionar tabela attachments ao realtime se não estiver presente
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'attachments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.attachments;
  END IF;
END $$;

-- FASE 3: Adicionar coluna de contagem de arquivos e triggers

-- Adicionar coluna attachment_count
ALTER TABLE projects ADD COLUMN IF NOT EXISTS attachment_count INTEGER DEFAULT 0;

-- Função para incrementar contador
CREATE OR REPLACE FUNCTION increment_attachment_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE projects 
  SET attachment_count = attachment_count + 1
  WHERE id = NEW.demanda_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para incrementar
DROP TRIGGER IF EXISTS on_attachment_insert ON attachments;
CREATE TRIGGER on_attachment_insert
AFTER INSERT ON attachments
FOR EACH ROW
EXECUTE FUNCTION increment_attachment_count();

-- Função para decrementar contador
CREATE OR REPLACE FUNCTION decrement_attachment_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE projects 
  SET attachment_count = GREATEST(0, attachment_count - 1)
  WHERE id = OLD.demanda_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para decrementar
DROP TRIGGER IF EXISTS on_attachment_delete ON attachments;
CREATE TRIGGER on_attachment_delete
AFTER DELETE ON attachments
FOR EACH ROW
EXECUTE FUNCTION decrement_attachment_count();

-- Inicializar contadores existentes
UPDATE projects p
SET attachment_count = (
  SELECT COUNT(*) 
  FROM attachments a 
  WHERE a.demanda_id = p.id 
    AND a.deleted_at IS NULL
);
