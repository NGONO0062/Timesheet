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
        db.Divisions.Add(Division.Create("Expérience boutiques", "experience-boutiques", "DEC"));

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
        var active = People.Count(p => p.Active);
        return $"Division CX Expertise : {active} comptes actifs, {People.Length - active} désactivé. Admin plateforme : Rose Ekambi.";
    }
}
