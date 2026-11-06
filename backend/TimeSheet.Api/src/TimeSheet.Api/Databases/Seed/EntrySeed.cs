namespace TimeSheet.Api.Databases.Seed;

using TimeSheet.Api.Domain.Divisions;
using TimeSheet.Api.Domain.Projects;
using TimeSheet.Api.Domain.Timesheets;
using TimeSheet.Api.Domain.Users;

/// <summary>
/// Données de démonstration de la saisie (reprises de prisma/seed.ts, en jours) : projets,
/// réglages de la division, fiches de temps de l'équipe de Samuel Etoga (écrans 02 à 05,
/// file de validation 07). Les fiches des équipes Études et Data CX viendront avec la vue
/// consolidée (jalon 4).
/// </summary>
public static class EntrySeed
{
    private sealed record ProjectSeed(string Code, string Name, string Start, string? End, int? Budget, ProjectStatus Status, string[] Activities, string[] Members, string Manager);

    private static readonly ProjectSeed[] Projects =
    [
        new("CX-2026-00", "Veille et formation", "2026-01-01", "2026-12-31", null, ProjectStatus.IN_PROGRESS, ["Formation"], ["Aïcha Ndongo", "Kevin Fotso", "Laure Bikoï", "Ibrahim Njoya", "Sandrine Mvondo", "Yannick Essomba"], "Samuel Etoga"),
        new("CX-2026-01", "Refonte parcours souscription", "2026-01-05", "2026-06-26", 120, ProjectStatus.IN_PROGRESS, ["Tests utilisateurs", "Atelier"], ["Aïcha Ndongo", "Kevin Fotso", "Laure Bikoï", "Ibrahim Njoya"], "Samuel Etoga"),
        new("CX-2026-02", "Baromètre NPS T1 2026", "2026-01-05", "2026-03-27", 50, ProjectStatus.IN_PROGRESS, ["Analyse"], ["Aïcha Ndongo", "Sandrine Mvondo", "Yannick Essomba"], "Samuel Etoga"),
        new("CX-2026-03", "Cartographie des irritants", "2026-02-02", "2026-05-29", 75, ProjectStatus.IN_PROGRESS, ["Atelier", "Rédaction"], ["Aïcha Ndongo", "Kevin Fotso", "Laure Bikoï", "Sandrine Mvondo", "Yannick Essomba"], "Samuel Etoga"),
        new("CX-2026-04", "Tests d'usage appli mobile", "2026-01-12", "2026-02-27", 40, ProjectStatus.DONE, ["Tests utilisateurs"], ["Kevin Fotso", "Ibrahim Njoya", "Sandrine Mvondo", "Yannick Essomba"], "Samuel Etoga"),
        new("CX-2026-05", "Refonte FAQ en ligne", "2026-02-02", "2026-04-30", 38, ProjectStatus.ON_HOLD, ["Rédaction"], ["Kevin Fotso", "Laure Bikoï"], "Samuel Etoga"),
        new("CX-2026-06", "Enquête boutiques T2 2026", "2026-04-06", "2026-06-26", 30, ProjectStatus.NOT_STARTED, ["Enquête", "Analyse"], ["Aïcha Ndongo", "Ibrahim Njoya", "Yannick Essomba"], "Samuel Etoga"),
        new("CX-2026-07", "Études de satisfaction clients", "2026-01-05", "2026-06-30", 125, ProjectStatus.IN_PROGRESS, ["Enquête", "Analyse"], ["Christelle Nana", "Boris Mbida", "Estelle Owona", "Franck Ateba", "Nadège Fouda"], "Hélène Nkoa"),
        new("CX-2026-08", "Tableaux de bord CX", "2026-01-05", "2026-12-18", 175, ProjectStatus.IN_PROGRESS, ["Données", "Visualisation"], ["Arnaud Biyong", "Carine Messi", "Thierry Eyenga", "Vanessa Ndzana"], "Olivier Manga"),
    ];

    /// <summary>Journée : code du projet et activité ; null si rien n'est saisi ce jour-là.</summary>
    private sealed record Day(string Code, string Activity);

    private static Day D(string code, string activity) => new(code, activity);

    private static DateOnly Date(string iso) => DateOnly.Parse(iso, System.Globalization.CultureInfo.InvariantCulture);

    /// <summary>Instant à Douala (UTC+1).</summary>
    private static DateTimeOffset At(string isoLocal) =>
        new DateTimeOffset(DateTime.Parse(isoLocal, System.Globalization.CultureInfo.InvariantCulture), WeekRules.DoualaOffset).ToUniversalTime();

    public static async Task RunAsync(TimeSheetDbContext db, Division division, IReadOnlyDictionary<string, User> people, CancellationToken cancellationToken)
    {
        db.DivisionSettings.Add(DivisionSettings.Defaults(division.Id));
        var created = At("2026-01-05T08:00:00");

        var activities = new Dictionary<(string, string), Guid>();
        foreach (var p in Projects)
        {
            var project = Project.Create(division.Id, p.Code, p.Name, Date(p.Start), p.End is null ? null : Date(p.End), p.Budget, p.Status, created, people[p.Manager].Id);
            foreach (var name in p.Activities) activities[(p.Code, name)] = project.AddActivity(name).Id;
            foreach (var member in p.Members) project.AddMember(people[member].Id);
            db.Projects.Add(project);
        }
        // Activité système « Absence » (PROMPT.md §20) : toujours ouverte, compte comme une journée.
        var absence = Project.Create(division.Id, "ABSENCE", "Absence", Date("2026-01-01"), null, null, ProjectStatus.IN_PROGRESS, created, null, isSystem: true);
        activities[("ABSENCE", "Absence")] = absence.AddActivity("Absence").Id;
        db.Projects.Add(absence);
        await db.SaveChangesAsync(cancellationToken);

        var samuel = people["Samuel Etoga"].Id;

        void Sheet(string person, int week, Day?[] days, string? submittedAt = null, string? validatedAt = null, (string At, string Reason, int[] Flagged)? rejected = null,
            (string SubmittedAt, string RejectedAt, string Reason)? previous = null, string? comment = null)
        {
            var user = people[person];
            var iso = new IsoWeek(2026, week);
            var sheet = Timesheet.Create(division.Id, user.Id, iso, At($"{iso.Monday:yyyy-MM-dd}T09:05:00"));
            var map = days.Select((d, i) => (d, i)).Where(x => x.d is not null).ToDictionary(x => iso.Monday.AddDays(x.i), x => activities[(x.d!.Code, x.d.Activity)]);
            sheet.SaveDraft(map, comment, At($"{iso.Monday:yyyy-MM-dd}T09:05:00"));
            if (previous is { } p)
            {
                sheet.Submit(user.Id, At(p.SubmittedAt));
                sheet.Reject(samuel, At(p.RejectedAt), p.Reason, []);
            }
            if (submittedAt is not null) sheet.Submit(user.Id, At(submittedAt));
            if (validatedAt is not null) sheet.Validate(samuel, At(validatedAt));
            if (rejected is { } r) sheet.Reject(samuel, At(r.At), r.Reason, r.Flagged.Select(i => iso.Monday.AddDays(i)));
            db.Timesheets.Add(sheet);
        }

        // Semaines validées : soumises le vendredi à 16:30, validées le lundi suivant à 10:00.
        void Validated(string person, int week, Day?[] days)
        {
            var monday = new IsoWeek(2026, week).Monday;
            Sheet(person, week, days, $"{monday.AddDays(4):yyyy-MM-dd}T16:30:00", $"{monday.AddDays(7):yyyy-MM-dd}T10:00:00");
        }

        var january = new Day?[] { D("CX-2026-01", "Tests utilisateurs"), D("CX-2026-01", "Tests utilisateurs"), D("CX-2026-02", "Analyse"), D("CX-2026-02", "Analyse"), D("CX-2026-00", "Formation") };
        var february = new Day?[] { D("CX-2026-01", "Tests utilisateurs"), D("CX-2026-01", "Tests utilisateurs"), D("CX-2026-02", "Analyse"), D("CX-2026-03", "Atelier"), D("CX-2026-00", "Formation") };

        // Aïcha Ndongo, stagiaire depuis le 5 janvier : semaines 2 à 10 validées, semaine 11
        // non saisie (manquante), semaine 12 en brouillon (3 jours sur 5).
        for (var week = 2; week <= 10; week++) Validated("Aïcha Ndongo", week, week <= 5 ? january : february);
        Sheet("Aïcha Ndongo", 12, [D("CX-2026-01", "Tests utilisateurs"), D("CX-2026-02", "Analyse"), D("CX-2026-03", "Atelier"), null, null]);

        // Kevin Fotso : semaine 12 rejetée, jeudi 19 signalé (écran 05).
        var kevinEarly = new Day?[] { D("CX-2026-01", "Tests utilisateurs"), D("CX-2026-01", "Tests utilisateurs"), D("CX-2026-01", "Tests utilisateurs"), D("CX-2026-01", "Tests utilisateurs"), D("CX-2026-00", "Formation") };
        var kevinWeek = new Day?[] { D("CX-2026-01", "Tests utilisateurs"), D("CX-2026-01", "Tests utilisateurs"), D("CX-2026-03", "Atelier"), D("CX-2026-03", "Atelier"), D("CX-2026-00", "Formation") };
        for (var week = 2; week <= 11; week++) Validated("Kevin Fotso", week, week <= 5 ? kevinEarly : kevinWeek);
        Sheet("Kevin Fotso", 12, [D("CX-2026-01", "Tests utilisateurs"), D("CX-2026-01", "Tests utilisateurs"), D("CX-2026-03", "Atelier"), D("CX-2026-01", "Tests utilisateurs"), D("CX-2026-00", "Formation")],
            submittedAt: "2026-03-20T16:42:00",
            rejected: ("2026-03-23T09:15:00", "Jeudi 19 mars, journée déclarée sur Refonte parcours souscription alors que l'atelier de tests a été annulé. Merci de réaffecter cette journée.", [3]));

        // File de validation de Samuel Etoga (écran 07) : semaine 12 soumise ; Ibrahim Njoya en
        // 2e soumission pour la semaine 11.
        Day?[] Usual(string code, string activity) => [D(code, activity), D(code, activity), D(code, activity), D(code, activity), D("CX-2026-00", "Formation")];
        foreach (var (name, days, last) in new[]
                 {
                     ("Laure Bikoï", Usual("CX-2026-01", "Tests utilisateurs"), 11),
                     ("Ibrahim Njoya", Usual("CX-2026-01", "Tests utilisateurs"), 10),
                     ("Sandrine Mvondo", Usual("CX-2026-02", "Analyse"), 11),
                     ("Yannick Essomba", Usual("CX-2026-02", "Analyse"), 11),
                 })
        {
            for (var week = 2; week <= last; week++) Validated(name, week, days);
        }
        Sheet("Laure Bikoï", 12, [D("CX-2026-01", "Tests utilisateurs"), D("CX-2026-01", "Tests utilisateurs"), D("CX-2026-01", "Tests utilisateurs"), D("CX-2026-03", "Atelier"), D("CX-2026-03", "Atelier")], submittedAt: "2026-03-20T17:30:00");
        Sheet("Sandrine Mvondo", 12, [D("CX-2026-02", "Analyse"), D("CX-2026-02", "Analyse"), D("CX-2026-03", "Atelier"), D("CX-2026-03", "Atelier"), D("CX-2026-00", "Formation")], submittedAt: "2026-03-20T15:10:00");
        Sheet("Yannick Essomba", 12, Usual("CX-2026-02", "Analyse"), submittedAt: "2026-03-20T17:48:00");
        Sheet("Ibrahim Njoya", 11, Usual("CX-2026-01", "Tests utilisateurs"),
            submittedAt: "2026-03-19T08:50:00",
            previous: ("2026-03-13T17:05:00", "2026-03-16T10:20:00", "Vendredi 13 mars : la journée de formation manque. Merci de l'ajouter."),
            comment: "Journée de formation du vendredi ajoutée, comme demandé.");

        await db.SaveChangesAsync(cancellationToken);
    }
}
