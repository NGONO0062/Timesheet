// Modèle papier de la fiche de présence (PROMPT.md §9.7, §20). « Version » et
// « Mise à jour le » ont été lus sur un scan peu lisible : constantes à confirmer.
export const SHEET_TEMPLATE = {
  title: "FICHE DE PRESENCE STAGIAIRE",
  reference: "OCM/PS-01/SE/049",
  version: "1.0",
  updatedOn: "15/06/2023",
  footer: "Interne Orange Cameroun",
  page: "Page 1/1",
  /** Blocs de semaine imprimés sur la page, utilisés ou non. */
  blocks: 6,
} as const;
