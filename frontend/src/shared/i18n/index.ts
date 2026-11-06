import { fr } from "./fr";

// Le français est la langue par défaut. L'anglais est prévu (PROMPT.md §15) :
// il prendra la même forme que `fr` et sera choisi selon User.locale.
export const dict = fr;

type Params = Record<string, string | number>;

/** Remplace les {clés} d'un libellé du dictionnaire. */
export function t(template: string, params: Params = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = params[key];
    if (value === undefined) throw new Error(`Paramètre manquant « ${key} » pour « ${template} »`);
    return String(value);
  });
}
