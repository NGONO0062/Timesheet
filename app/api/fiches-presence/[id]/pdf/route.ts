// PDF d'une fiche de présence (PROMPT.md §16) : servi seulement au stagiaire et à son
// superviseur. Après la signature du superviseur, le PDF signé stocké, tel qu'envoyé aux RH.
import { attendancePdf } from "@/lib/data/attendance";
import { getViewer, scopeOf } from "@/lib/data/viewer";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  const { id } = await params;
  if (!viewer?.divisionId || !/^[a-z0-9]{1,64}$/i.test(id)) return new Response(null, { status: 404 });
  const pdf = await attendancePdf(scopeOf(viewer), id);
  if (!pdf) return new Response(null, { status: 404 });
  const inline = new URL(request.url).searchParams.get("affichage") === "1";
  return new Response(pdf.bytes as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${pdf.fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
