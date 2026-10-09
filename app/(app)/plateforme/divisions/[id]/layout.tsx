import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getDivisionDetail } from "@/lib/data/platform";
import { requirePlatformAdmin } from "@/lib/data/viewer";

// Division inexistante : vrai 404, vérifié avant l'état de chargement.
export default async function Layout({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const viewer = await requirePlatformAdmin();
  const { id } = await params;
  if (!/^[a-z0-9]{1,64}$/i.test(id) || !(await getDivisionDetail({ userId: viewer.userId, role: "PLATFORM_ADMIN" }, id))) notFound();
  return children;
}
