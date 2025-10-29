-- Adicionar campos de órgão/entidade ao user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS entidade_nome VARCHAR(255);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS entidade_cnpj VARCHAR(18);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS orgao_demandante VARCHAR(255);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS uasg_codigo VARCHAR(6);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS codigo_pncp VARCHAR(50);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS endereco_completo TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS telefone_contato VARCHAR(20);

-- Adicionar campos de controle de completude na tabela projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS coleta_completa BOOLEAN DEFAULT false;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS completude_score INTEGER DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS informacoes_essenciais JSONB DEFAULT '{}';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS synthesis_data JSONB;

-- Índices
CREATE INDEX IF NOT EXISTS idx_user_profiles_entidade_cnpj ON user_profiles(entidade_cnpj);
CREATE INDEX IF NOT EXISTS idx_user_profiles_uasg ON user_profiles(uasg_codigo);
CREATE INDEX IF NOT EXISTS idx_projects_coleta_completa ON projects(coleta_completa);

-- Comentários
COMMENT ON COLUMN projects.coleta_completa IS 'Indica se informações essenciais foram coletadas';
COMMENT ON COLUMN projects.completude_score IS 'Score 0-100 de completude das informações';
COMMENT ON COLUMN projects.informacoes_essenciais IS 'Status de cada informação essencial (JSON)';
COMMENT ON COLUMN projects.synthesis_data IS 'Dados estruturados do cenário (JSON)';