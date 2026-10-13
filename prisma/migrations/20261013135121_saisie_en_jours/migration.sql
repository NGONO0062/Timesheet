-- Saisie en jours entiers (questions ouvertes, point 82) : une journée vaut 1.
-- Les heures déjà saisies et les budgets sont convertis avec les heures par jour
-- de leur division (8 sans réglage enregistré), puis toutes les divisions passent
-- en jours : 1 par jour, pas de 1.

-- AlterTable
ALTER TABLE "TimeEntry" ALTER COLUMN "hours" SET DATA TYPE DECIMAL(8,5);

-- Heures saisies → jours.
UPDATE "TimeEntry" e
SET "hours" = e."hours" / COALESCE((
  SELECT s."hoursPerDay"
  FROM "TimesheetLine" l
  JOIN "Timesheet" t ON t."id" = l."timesheetId"
  JOIN "DivisionSettings" s ON s."divisionId" = t."divisionId"
  WHERE l."id" = e."lineId"
), 8);

-- Budgets d'heures → jours entiers.
UPDATE "Project" p
SET "budgetHours" = ROUND(p."budgetHours" / COALESCE((
  SELECT s."hoursPerDay" FROM "DivisionSettings" s WHERE s."divisionId" = p."divisionId"
), 8))
WHERE p."budgetHours" IS NOT NULL;

UPDATE "DivisionSettings" SET "unit" = 'DAYS', "hoursPerDay" = 1, "step" = 1;

-- AlterTable
ALTER TABLE "DivisionSettings" ALTER COLUMN "unit" SET DEFAULT 'DAYS',
ALTER COLUMN "hoursPerDay" SET DEFAULT 1,
ALTER COLUMN "step" SET DEFAULT 1;
