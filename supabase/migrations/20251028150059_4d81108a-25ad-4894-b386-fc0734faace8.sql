-- FRAMEWORK CRIVO v2.4 - Database Schema Complete
-- 9 tables + triggers + indexes + RLS policies

-- TABELA 1: organizations
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  full_name TEXT,
  cnpj TEXT UNIQUE,
  municipality TEXT,
  state TEXT,
  sphere TEXT CHECK (sphere IN ('municipal', 'estadual', 'federal')),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organizations_cnpj ON public.organizations(cnpj);

-- TABELA 2: user_profiles
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  organization_id UUID REFERENCES public.organizations(id),
  organization_name TEXT NOT NULL,
  organization_cnpj TEXT,
  role_in_organization TEXT,
  phone TEXT,
  profile_type TEXT NOT NULL DEFAULT 'usuario_regular' 
    CHECK (profile_type IN ('usuario_regular', 'gestor_orgao', 'master_admin')),
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_org ON public.user_profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);

-- TABELA 3: projects (demandas)
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  name TEXT NOT NULL CHECK (char_length(name) >= 5 AND char_length(name) <= 200),
  description TEXT CHECK (char_length(description) <= 500),
  status TEXT NOT NULL DEFAULT 'em_formalizacao' 
    CHECK (status IN ('em_formalizacao', 'concluida', 'arquivada')),
  visibility_status TEXT NOT NULL DEFAULT 'ativa'
    CHECK (visibility_status IN ('ativa', 'arquivada', 'excluida_arquivo_morto')),
  current_enfoque TEXT DEFAULT 'cenario'
    CHECK (current_enfoque IN ('cenario', 'requisitos', 'investigacao', 'validacao', 'otimizacao')),
  metadata JSONB DEFAULT '{}',
  archived_at TIMESTAMPTZ,
  archived_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_user ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_org ON public.projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_projects_visibility ON public.projects(visibility_status);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);

-- TABELA 4: demanda_messages (chat)
CREATE TABLE IF NOT EXISTS public.demanda_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demanda_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_demanda ON public.demanda_messages(demanda_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON public.demanda_messages(created_at DESC);

-- TABELA 5: attachments
CREATE TABLE IF NOT EXISTS public.attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demanda_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  message_id UUID REFERENCES public.demanda_messages(id) ON DELETE SET NULL,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  storage_url TEXT,
  extracted_content TEXT,
  analysis_summary TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attachments_demanda ON public.attachments(demanda_id);
CREATE INDEX IF NOT EXISTS idx_attachments_uploaded_by ON public.attachments(uploaded_by);

-- TABELA 6: demanda_artefatos (documentos gerados)
CREATE TABLE IF NOT EXISTS public.demanda_artefatos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demanda_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('DFD', 'ETP', 'TR', 'MR', 'PP', 'CENARIO', 'REQUISITOS')),
  conteudo TEXT,
  versao INTEGER DEFAULT 1,
  generated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_artefatos_demanda ON public.demanda_artefatos(demanda_id);
CREATE INDEX IF NOT EXISTS idx_artefatos_tipo ON public.demanda_artefatos(tipo);

-- TABELA 7: fornecedores_identificados
CREATE TABLE IF NOT EXISTS public.fornecedores_identificados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demanda_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cnpj TEXT,
  contatos JSONB DEFAULT '{}',
  historico_contratos JSONB DEFAULT '[]',
  fonte TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fornecedores_demanda ON public.fornecedores_identificados(demanda_id);
CREATE INDEX IF NOT EXISTS idx_fornecedores_cnpj ON public.fornecedores_identificados(cnpj);

-- TABELA 8: pncp_search_cache
CREATE TABLE IF NOT EXISTS public.pncp_search_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_query TEXT NOT NULL,
  search_params JSONB DEFAULT '{}',
  results JSONB DEFAULT '[]',
  result_count INTEGER,
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pncp_cache_query ON public.pncp_search_cache(search_query);
CREATE INDEX IF NOT EXISTS idx_pncp_cache_expires ON public.pncp_search_cache(expires_at);

-- TABELA 9: validation_rules
CREATE TABLE IF NOT EXISTS public.validation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_type TEXT NOT NULL,
  rule_name TEXT NOT NULL,
  rule_description TEXT,
  rule_config JSONB DEFAULT '{}',
  severity TEXT CHECK (severity IN ('erro', 'aviso', 'info')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_validation_rules_type ON public.validation_rules(rule_type);
CREATE INDEX IF NOT EXISTS idx_validation_rules_active ON public.validation_rules(is_active);

-- TRIGGERS: update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER update_user_profiles_updated_at 
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_projects_updated_at ON public.projects;
CREATE TRIGGER update_projects_updated_at 
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_artefatos_updated_at ON public.demanda_artefatos;
CREATE TRIGGER update_artefatos_updated_at 
  BEFORE UPDATE ON public.demanda_artefatos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ENABLE RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demanda_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demanda_artefatos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fornecedores_identificados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pncp_search_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.validation_rules ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES: user_profiles
CREATE POLICY "Users can view their own profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON public.user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS POLICIES: organizations
CREATE POLICY "Users can view their organization" ON public.organizations
  FOR SELECT USING (
    id IN (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid())
  );

-- RLS POLICIES: projects (CRITICAL - visibility control)
CREATE POLICY "users_see_org_projects" ON public.projects
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid())
    AND (
      (visibility_status = 'ativa') OR
      (visibility_status = 'arquivada' AND EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = auth.uid() 
        AND profile_type IN ('gestor_orgao', 'master_admin')
      )) OR
      (visibility_status = 'excluida_arquivo_morto' AND EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = auth.uid() 
        AND profile_type = 'master_admin'
      ))
    )
  );

CREATE POLICY "users_insert_own_org" ON public.projects
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    organization_id IN (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid())
  );

CREATE POLICY "users_update_own_or_org" ON public.projects
  FOR UPDATE USING (
    user_id = auth.uid() OR
    (organization_id IN (
      SELECT organization_id FROM public.user_profiles 
      WHERE id = auth.uid() AND profile_type IN ('gestor_orgao', 'master_admin')
    ))
  );

-- RLS POLICIES: demanda_messages
CREATE POLICY "users_see_own_messages" ON public.demanda_messages
  FOR SELECT USING (
    demanda_id IN (
      SELECT id FROM public.projects 
      WHERE organization_id IN (
        SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "users_insert_messages" ON public.demanda_messages
  FOR INSERT WITH CHECK (
    demanda_id IN (
      SELECT id FROM public.projects 
      WHERE organization_id IN (
        SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()
      )
    )
  );

-- RLS POLICIES: attachments
CREATE POLICY "users_see_org_attachments" ON public.attachments
  FOR SELECT USING (
    demanda_id IN (
      SELECT id FROM public.projects 
      WHERE organization_id IN (
        SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "users_insert_attachments" ON public.attachments
  FOR INSERT WITH CHECK (
    uploaded_by = auth.uid() AND
    demanda_id IN (
      SELECT id FROM public.projects 
      WHERE organization_id IN (
        SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()
      )
    )
  );

-- RLS POLICIES: demanda_artefatos
CREATE POLICY "users_see_org_artefatos" ON public.demanda_artefatos
  FOR SELECT USING (
    demanda_id IN (
      SELECT id FROM public.projects 
      WHERE organization_id IN (
        SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "users_insert_artefatos" ON public.demanda_artefatos
  FOR INSERT WITH CHECK (
    demanda_id IN (
      SELECT id FROM public.projects 
      WHERE organization_id IN (
        SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()
      )
    )
  );

-- RLS POLICIES: fornecedores
CREATE POLICY "users_see_org_fornecedores" ON public.fornecedores_identificados
  FOR SELECT USING (
    demanda_id IN (
      SELECT id FROM public.projects 
      WHERE organization_id IN (
        SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()
      )
    )
  );

-- RLS POLICIES: pncp_cache (public read)
CREATE POLICY "Anyone can read cache" ON public.pncp_search_cache
  FOR SELECT USING (true);

-- RLS POLICIES: validation_rules (public read)
CREATE POLICY "Anyone can read validation rules" ON public.validation_rules
  FOR SELECT USING (true);