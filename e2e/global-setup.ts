// Avant les tests de bout en bout : fiches des comptes de test remises à leur état de départ.
import { resetE2eFixtures } from "../prisma/e2e-fixtures";

export default async function globalSetup() {
  await resetE2eFixtures();
}
