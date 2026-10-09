import "server-only";
// Fichiers produits par l'application (PDF signés), hors du dossier public
// (PROMPT.md §16) : servis seulement par une route qui vérifie les droits.
import fs from "node:fs/promises";
import path from "node:path";

const root = () => path.resolve(process.env.STORAGE_DIR ?? "./storage");

/** Chemin relatif sûr : lettres, chiffres, tirets et barres obliques seulement. */
function resolve(relative: string): string {
  if (!/^[A-Za-z0-9_\-/.]+$/.test(relative) || relative.includes("..")) throw new Error("chemin de stockage invalide");
  return path.join(root(), relative);
}

export async function writeStored(relative: string, bytes: Uint8Array): Promise<void> {
  const full = resolve(relative);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, bytes);
}

export async function readStored(relative: string): Promise<Uint8Array | null> {
  try {
    return new Uint8Array(await fs.readFile(resolve(relative)));
  } catch {
    return null;
  }
}
