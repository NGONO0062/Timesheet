"use client";
import { Card } from "@/components/ods";
import { SignatureZone } from "@/components/ts/SignatureZone";
import { Planche } from "../Planche";

// Planche C3-Signature.
const SIGNED_PATH = "M20 70 C 40 20, 60 20, 70 60 S 95 90, 110 50 S 135 20, 150 60 S 180 85, 200 45 S 240 30, 280 62";

const demoSign = async () => "Démonstration : la signature est enregistrée au jalon 5.";

export default function Page() {
  return (
    <Planche title="Zone de signature électronique" lead="Deux modes, tracé ou validation par mot de passe, et un bloc de traçabilité toujours visible." minHeight={860}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0px, 1fr))", gap: 20, alignItems: "start" }}>
        <Card strong>
          <h2 className="h5">1. Vide, mode tracé</h2>
          <SignatureZone signerName="Aïcha Ndongo" signerRole="Staff" onSign={demoSign} />
        </Card>
        <Card strong>
          <h2 className="h5">2. Validation par mot de passe</h2>
          <SignatureZone signerName="Aïcha Ndongo" signerRole="Staff" defaultMode="PASSWORD" onSign={demoSign} />
        </Card>
        <Card strong>
          <h2 className="h5">3. Signée et verrouillée</h2>
          <SignatureZone
            signerName="Aïcha Ndongo"
            signerRole="Staff"
            signed={{ method: "DRAWN", drawing: SIGNED_PATH, signedAt: new Date("2026-03-19T09:48:27Z"), sha256: "[empreinte SHA-256 du PDF signé]" }}
          />
        </Card>
      </div>
    </Planche>
  );
}
