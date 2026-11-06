// Bloc « Prototype uniquement : entrer avec un profil » (PROMPT.md §10). Il n'apparaît
// que si l'API l'autorise (DEMO_PROFILES, jamais sur une adresse publique en production).
import { dict } from "@/shared/i18n";
import { Button } from "@/shared/ui/Button";
import { useDemoProfiles, useDemoSignIn } from "../api/mutations";

export function DemoProfiles() {
  const profiles = useDemoProfiles();
  const signIn = useDemoSignIn();
  if (!profiles.data?.length) return null;
  return (
    <div className="flex flex-col gap-10 border-2 border-dashed border-gray-595 p-10 text-gray-595">
      <p className="text-sm font-bold">{dict.login.demoTitle}</p>
      <ul className="flex flex-wrap gap-x-20 gap-y-10">
        {profiles.data.map((a) => (
          <li key={a.email}>
            <Button variant="link" disabled={signIn.isPending} onClick={() => signIn.mutate(a.email)}>
              {a.label}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
