// Mots de passe en argon2id (PROMPT.md §16). hash-wasm : WebAssembly, sans
// binaire natif à compiler. Paramètres recommandés par l'OWASP (19 Mio, 2 passes).
import { argon2id, argon2Verify } from "hash-wasm";

const PARAMS = { parallelism: 1, iterations: 2, memorySize: 19_456, hashLength: 32 } as const;

export async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  return argon2id({ ...PARAMS, password, salt, outputType: "encoded" });
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await argon2Verify({ password, hash });
  } catch {
    return false;
  }
}

/**
 * Hachage factice vérifié quand le compte n'existe pas : le temps de réponse
 * ne révèle pas si l'adresse est connue.
 */
let dummy: Promise<string> | null = null;
export async function verifyAgainstDummy(password: string): Promise<false> {
  dummy ??= hashPassword("compte-inexistant");
  await verifyPassword(password, await dummy);
  return false;
}
