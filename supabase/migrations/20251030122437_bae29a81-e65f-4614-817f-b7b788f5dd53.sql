-- Criar políticas RLS para DELETE e UPDATE em attachments
-- Permitir DELETE de attachments para usuários da mesma organização
CREATE POLICY "users_delete_org_attachments"
ON attachments
FOR DELETE
TO authenticated
USING (
  demanda_id IN (
    SELECT projects.id
    FROM projects
    WHERE projects.organization_id IN (
      SELECT user_profiles.organization_id
      FROM user_profiles
      WHERE user_profiles.id = auth.uid()
    )
  )
);

-- Permitir UPDATE de attachments para usuários da mesma organização
CREATE POLICY "users_update_org_attachments"
ON attachments
FOR UPDATE
TO authenticated
USING (
  demanda_id IN (
    SELECT projects.id
    FROM projects
    WHERE projects.organization_id IN (
      SELECT user_profiles.organization_id
      FROM user_profiles
      WHERE user_profiles.id = auth.uid()
    )
  )
)
WITH CHECK (
  demanda_id IN (
    SELECT projects.id
    FROM projects
    WHERE projects.organization_id IN (
      SELECT user_profiles.organization_id
      FROM user_profiles
      WHERE user_profiles.id = auth.uid()
    )
  )
);