// Chargement de l'administration (E4) : tableau des utilisateurs en squelette,
// formulaires désactivés.
import { Placeholder } from "@/components/ods/Display";
import { dict } from "@/lib/i18n";

const a = dict.admin;

export default function Loading() {
  return (
    <main className="container ts-stack" aria-busy="true">
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h1>{a.title}</h1>
        <Placeholder width={360} />
      </div>
      <p className="visually-hidden" role="status">{a.loading}</p>
      <section className="ts-section" aria-hidden="true">
        <div className="ts-head">
          <h2>{a.usersTitle}</h2>
          <button className="btn btn-primary" type="button" disabled tabIndex={-1}>{a.invite}</button>
        </div>
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">{a.colName}</th>
                <th scope="col">{a.colRole}</th>
                <th scope="col">{a.colManager}</th>
                <th scope="col">{a.colAccount}</th>
                <th scope="col">{a.colAction}</th>
              </tr>
            </thead>
            <tbody>
              {[200, 180, 220, 160, 190].map((w) => (
                <tr key={w}>
                  <td><Placeholder width={w} /></td>
                  <td><Placeholder width={160} height={30} radius={4} /></td>
                  <td><Placeholder width={140} /></td>
                  <td><Placeholder width={110} height={30} radius={4} /></td>
                  <td><Placeholder width={70} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="ts-section" aria-hidden="true">
        <h2>{a.permissionsTitle}</h2>
        <Placeholder width="100%" height={240} radius={6} />
      </section>
    </main>
  );
}
