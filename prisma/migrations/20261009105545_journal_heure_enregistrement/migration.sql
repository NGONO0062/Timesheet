-- Heure réelle d'enregistrement : fenêtres de limitation (connexion, signature), qui ne
-- doivent pas suivre l'horloge de démonstration. Les lignes déjà présentes reçoivent une
-- date ancienne fixe (valeur par défaut posée à l'ajout de la colonne, sans UPDATE : le
-- journal reste en ajout seul) ; les nouvelles lignes, l'heure courante.
ALTER TABLE "AuditLog" ADD COLUMN "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT TIMESTAMP '2000-01-01 00:00:00';
ALTER TABLE "AuditLog" ALTER COLUMN "recordedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "AuditLog_action_objectLabel_recordedAt_idx" ON "AuditLog"("action", "objectLabel", "recordedAt");
