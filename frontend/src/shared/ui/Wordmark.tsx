/**
 * Le mot « TimeSheet » : « Time » en orange d'interface, « Sheet » en blanc sur fond noir.
 * Pas de logo. `bare` : sur un fond déjà noir (colonne de connexion, barre latérale).
 */
export function Wordmark({ bare }: { bare?: boolean }) {
  return (
    <span className={bare ? "inline-flex" : "inline-flex bg-black px-5"}>
      <span className="text-primary">Time</span>
      <span className="text-white">Sheet</span>
    </span>
  );
}
