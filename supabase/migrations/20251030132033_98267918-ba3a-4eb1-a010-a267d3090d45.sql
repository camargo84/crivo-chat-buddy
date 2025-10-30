-- Corrigir search_path nas funções de contador de attachments

CREATE OR REPLACE FUNCTION increment_attachment_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.projects 
  SET attachment_count = attachment_count + 1
  WHERE id = NEW.demanda_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION decrement_attachment_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.projects 
  SET attachment_count = GREATEST(0, attachment_count - 1)
  WHERE id = OLD.demanda_id;
  RETURN OLD;
END;
$$;
