import type { ReactNode } from "react";
import { logout } from "@/app/actions/auth";
import { AppShell } from "@/components/ts/AppShell";
import { requireViewer } from "@/lib/data/viewer";
import { homeFor, navigationFor } from "@/lib/navigation";
import { initials, roleLabel } from "@/lib/viewer";

// Écrans connectés : la session est vérifiée ici, et chaque page revérifie sa permission.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const viewer = await requireViewer();
  return (
    <AppShell
      items={navigationFor(viewer)}
      home={homeFor(viewer)}
      logout={logout}
      user={{
        initials: initials(viewer),
        name: `${viewer.firstName} ${viewer.lastName}`,
        roleLabel: roleLabel(viewer.role),
        divisionLabel: viewer.divisionName ?? "Toutes les divisions",
      }}
    >
      {children}
    </AppShell>
  );
}
