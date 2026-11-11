namespace TimeSheet.Api.Databases.Seed;

using System.Globalization;
using System.Text;
using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Domain.Access;
using TimeSheet.Api.Domain.Divisions;
using TimeSheet.Api.Domain.Teams;
using TimeSheet.Api.Domain.Users;
using TimeSheet.Api.Services.Security;

/// <summary>
/// Données de démonstration (reprises de prisma/seed.ts), partie accès : division CX Expertise,
/// ses comptes et ses équipes, division « Expérience boutiques » en onboarding, admin plateforme.
/// Comptes fictifs, mot de passe SEED_PASSWORD. Sans effet si la division existe déjà.
/// Les projets, fiches et journal de démonstration s'ajoutent avec leurs jalons.
/// </summary>
public static class DemoSeed
{
    private sealed record Person(string First, string Last, Role Role, string? Team = null, string? Manager = null, bool Active = true);

    // Équipes : Parcours (Samuel Etoga, 6), Études (Hélène Nkoa, 5), Data CX (Olivier Manga, 4).
    private static readonly Person[] People =
    [
        new("Brigitte", "Mbarga", Role.OWNER),
        new("Paul", "Tchouta", Role.DIVISION_ADMIN),
        new("Samuel", "Etoga", Role.MANAGER, "Parcours", "Brigitte Mbarga"),
        new("Hélène", "Nkoa", Role.MANAGER, "Études", "Brigitte Mbarga"),
        new("Olivier", "Manga", Role.MANAGER, "Data CX", "Brigitte Mbarga"),
        .. Staff("Parcours", "Samuel Etoga", "Aïcha Ndongo", "Kevin Fotso", "Laure Bikoï", "Ibrahim Njoya", "Sandrine Mvondo", "Yannick Essomba"),
        .. Staff("Études", "Hélène Nkoa", "Christelle Nana", "Boris Mbida", "Estelle Owona", "Franck Ateba", "Nadège Fouda"),
        .. Staff("Data CX", "Olivier Manga", "Arnaud Biyong", "Carine Messi", "Thierry Eyenga", "Vanessa Ndzana"),
        new("Marie-Claire", "Abega", Role.STAFF, "Études", "Hélène Nkoa", Active: false),
    ];

    private static IEnumerable<Person> Staff(string team, string manager, params string[] names) =>
        names.Select(n => n.Split(' ', 2)).Select(p => new Person(p[0], p[1], Role.STAFF, team, manager));

    /// <summary>« Aïcha Ndongo » → « aicha.ndongo@exemple.com » (sans accents, espaces en tirets).</summary>
    public static string EmailOf(string first, string last)
    {
        var raw = $"{first}.{last}".Normalize(NormalizationForm.FormD);
        var plain = new string(raw.Where(c => CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark).ToArray());
        return plain.ToLowerInvariant().Replace(' ', '-') + "@exemple.com";
    }

    public static async Task<string> RunAsync(TimeSheetDbContext db, string password, CancellationToken cancellationToken = default)
    {
        if (await db.Divisions.AnyAsync(d => d.Slug == "cx-expertise", cancellationToken))
            return "Données de démonstration déjà présentes. Pour repartir de zéro, recréez la base.";

        var passwordHash = PasswordHasher.Hash(password);
        var division = Division.Create("CX Expertise", "cx-expertise", "DEC", "CX", "CX Expertise", DivisionStatus.ACTIVE);
        db.Divisions.Add(division);
        // Division en onboarding, arrêtée à l'étape 2 (planche 13).
        var boutiques = Division.Create("Expérience boutiques", "experience-boutiques", "DEC");
        boutiques.AdvanceTo(2);
        db.Divisions.Add(boutiques);
        db.DivisionSettings.Add(DivisionSettings.Defaults(boutiques.Id));

        // Comptes, managers d'abord pour pouvoir rattacher les équipes.
        var ids = new Dictionary<string, User>();
        foreach (var p in People)
        {
            var user = User.Create(division.Id, EmailOf(p.First, p.Last), p.First, p.Last, p.Role);
            user.SetPassword(passwordHash);
            user.SetActive(p.Active);
            if (p.Manager is not null) user.AssignManager(ids[p.Manager].Id);
            ids[$"{p.First} {p.Last}"] = user;
            db.Users.Add(user);
        }

        // Admin plateforme : sans division.
        var rose = User.Create(null, "rose.ekambi@exemple.com", "Rose", "Ekambi", Role.PLATFORM_ADMIN);
        rose.SetPassword(passwordHash);
        db.Users.Add(rose);

        // Comptes d'abord, équipes ensuite : l'équipe pointe vers son manager, le manager vers son équipe.
        await db.SaveChangesAsync(cancellationToken);
        foreach (var (name, manager) in new[] { ("Parcours", "Samuel Etoga"), ("Études", "Hélène Nkoa"), ("Data CX", "Olivier Manga") })
        {
            var team = Team.Create(division.Id, name, ids[manager].Id);
            db.Teams.Add(team);
            await db.SaveChangesAsync(cancellationToken);
            foreach (var p in People.Where(p => p.Team == name)) ids[$"{p.First} {p.Last}"].AssignTeam(team.Id);
        }
        await db.SaveChangesAsync(cancellationToken);
        await EntrySeed.RunAsync(db, division, ids, cancellationToken);

        await PlatformAsync(db, division, boutiques, ids, cancellationToken);

        var active = People.Count(p => p.Active);
        return $"Division CX Expertise : {active} comptes actifs, {People.Length - active} désactivé. Admin plateforme : Rose Ekambi.";
    }

    private static DateTimeOffset Douala(string iso) => DateTimeOffset.Parse($"{iso}+01:00", System.Globalization.CultureInfo.InvariantCulture).ToUniversalTime();

    /// <summary>
    /// Écran 13 (repris de prisma/seed.ts) : dates de création des divisions et journal d'audit de
    /// la semaine 12. Connexions du matin, soumissions et décisions des fiches du seed, puis les six
    /// dernières lignes de la planche (vendredi 20 mars). Marquées « seed » dans leurs détails.
    /// </summary>
    private static async Task PlatformAsync(TimeSheetDbContext db, Division division, Division boutiques, Dictionary<string, User> ids, CancellationToken cancellationToken)
    {
        division.UpdateCreationProperties(Douala("2026-01-05T09:00:00"), "seed");
        boutiques.UpdateCreationProperties(Douala("2026-03-19T10:15:00"), "seed");
        await db.SaveChangesAsync(cancellationToken);

        var events = new List<(DateTimeOffset At, string? Actor, string Action, string Object, Domain.Access.AuditResult Result)>();
        var activePeople = People.Where(p => p.Active).ToList();
        for (var i = 0; i < activePeople.Count; i++)
        {
            var p = activePeople[i];
            for (var day = 0; day < 5; day++)
            {
                var minute = (i * 7 + day * 11) % 50 + 5;
                var second = (i * 13 + day * 17) % 60;
                events.Add((Douala($"2026-03-{16 + day}T08:{minute:00}:{second:00}"), $"{p.First} {p.Last}", "LOGIN_SUCCESS", EmailOf(p.First, p.Last), Domain.Access.AuditResult.SUCCESS));
            }
        }

        var weekStart = Douala("2026-03-16T00:00:00");
        var cutoff = Douala("2026-03-20T16:00:00");
        var names = ids.ToDictionary(x => x.Value.Id, x => x.Key);
        var sheets = await db.Timesheets.AsNoTracking().Where(t => t.DivisionId == division.Id && (t.SubmittedAt >= weekStart || t.DecidedAt >= weekStart)).ToListAsync(cancellationToken);
        foreach (var t in sheets)
        {
            var owner = names[t.UserId];
            if (t.SubmittedAt is { } s && s >= weekStart && s < cutoff)
                events.Add((s, owner, "TIMESHEET_SUBMITTED", $"Semaine {t.WeekNumber}", Domain.Access.AuditResult.SUCCESS));
            if (t.DecidedAt is { } d && d >= weekStart && t.DecidedById is { } by)
                events.Add((d, names[by], t.Status == Domain.Timesheets.TimesheetStatus.REJECTED ? "TIMESHEET_REJECTED" : "TIMESHEET_VALIDATED", $"Semaine {t.WeekNumber} · {owner}", Domain.Access.AuditResult.SUCCESS));
        }

        // Planche 13 : les six dernières lignes du journal.
        events.Add((Douala("2026-03-20T16:10:45"), "Paul Tchouta", "RULES_CHANGED", "Seuil d'alerte de remplissage : 80 %", Domain.Access.AuditResult.SUCCESS));
        events.Add((Douala("2026-03-20T16:42:10"), "Aïcha Ndongo", "TIMESHEET_SUBMITTED", "Semaine 12", Domain.Access.AuditResult.SUCCESS));
        events.Add((Douala("2026-03-20T17:03:12"), null, "LOGIN_FAILURE", "kevin.fotso@exemple.com", Domain.Access.AuditResult.FAILURE));
        events.Add((Douala("2026-03-20T17:05:41"), "Kevin Fotso", "TIMESHEET_SUBMITTED", "Semaine 12", Domain.Access.AuditResult.SUCCESS));
        events.Add((Douala("2026-03-20T17:30:26"), "Laure Bikoï", "TIMESHEET_SUBMITTED", "Semaine 12", Domain.Access.AuditResult.SUCCESS));
        events.Add((Douala("2026-03-20T17:48:02"), "Yannick Essomba", "TIMESHEET_SUBMITTED", "Semaine 12", Domain.Access.AuditResult.SUCCESS));

        var recorded = DateTimeOffset.UtcNow;
        foreach (var e in events)
        {
            var actor = e.Actor is not null && ids.TryGetValue(e.Actor, out var u) ? u.Id : (Guid?)null;
            db.AuditLog.Add(Domain.Audit.AuditEntry.Create(e.At, recorded, e.Action, e.Actor ?? e.Object, e.Object, e.Result, actor, division.Id, "{\"seed\":true}"));
        }
        await db.SaveChangesAsync(cancellationToken);
    }
}
