-- Journal d'audit en ajout seul (PROMPT.md §8) : aucune ligne ne se modifie ni ne se supprime,
-- même par une requête qui contournerait l'application.
CREATE OR REPLACE FUNCTION audit_log_ajout_seul() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog est en ajout seul : % refusé', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_ajout_seul
  BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION audit_log_ajout_seul();

CREATE TRIGGER audit_log_pas_de_vidage
  BEFORE TRUNCATE ON "AuditLog"
  FOR EACH STATEMENT EXECUTE FUNCTION audit_log_ajout_seul();
