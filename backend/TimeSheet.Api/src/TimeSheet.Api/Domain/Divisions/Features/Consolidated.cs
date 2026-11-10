namespace TimeSheet.Api.Domain.Divisions.Features;

using MediatR;
using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Databases;
using TimeSheet.Api.Domain.Access;
using TimeSheet.Api.Domain.Timesheets;
using TimeSheet.Api.Domain.Timesheets.Features;
using TimeSheet.Api.Exceptions;
using TimeSheet.Api.Services.Access;
using TimeSheet.Api.Services.Audit;
using TimeSheet.Api.Services.Mail;

/// <summary>En-tête de l'écran 11 : division, équipes, collaborateurs comptés, semaine affichée.</summary>
public sealed record DivisionHeadDto(string Name, int Teams, int People, WeekRef Week, WeekRef Current, int Threshold);

/// <summary>Bloc de la semaine : indicateurs (ligne Division), tableau par équipe, tendance sur six semaines.</summary>
public sealed record WeekBlockDto(IReadOnlyList<TeamRow> Rows, TeamRow Total, IReadOnlyList<TrendPoint> Trend);

public sealed record Reminded(string Name);

/// <summary>
/// Vue consolidée de la division (PROMPT.md §9.6, reprise de lib/data/division.ts). Réservée à
/// la permission « Voir la vue consolidée » : toute la division, jamais une autre. Trois blocs
/// chargés séparément : un bloc en panne n'empêche pas d'afficher les autres (§12).
/// </summary>
public static class Consolidated
{
    private sealed record Frame(
        string Name,
        IReadOnlyList<TeamInfo> Teams,
        IReadOnlyList<Member> People,
        DivisionSettings Settings,
        IReadOnlySet<DateOnly> Holidays,
        IsoWeek Week,
        IsoWeek Current,
        DateTimeOffset Now)
    {
        public int Expected(IsoWeek w) => WeekRules.WorkingDays(w, Settings.WorkingDays).Count(d => !Holidays.Contains(d));

        public DateTimeOffset Deadline(IsoWeek w) => WeekRules.Deadline(w, Settings.DeadlineDay, Settings.DeadlineTime);

        public IReadOnlyList<IsoWeek> TrendWeeks => Enumerable.Range(0, ConsolidatedRules.TrendWeeks).Select(i => Week.Shift(i - ConsolidatedRules.TrendWeeks + 1)).ToList();
    }

    /// <summary>
    /// Division, équipes et collaborateurs comptés : les personnes actives qui saisissent leurs
    /// temps, sauf les managers d'équipe (planche 11 : « Parcours, Samuel Etoga · 6 pers. »).
    /// Semaine demandée, jamais après la semaine courante.
    /// </summary>
    private static async Task<Frame> FrameAsync(TimeSheetDbContext db, DivisionScope scope, DateTimeOffset now, int? year, int? week, CancellationToken cancellationToken)
    {
        var division = await db.Divisions.AsNoTracking().Include(d => d.Permissions).FirstAsync(d => d.Id == scope.DivisionId, cancellationToken);
        var settings = await db.DivisionSettings.AsNoTracking().FirstOrDefaultAsync(s => s.DivisionId == scope.DivisionId, cancellationToken) ?? DivisionSettings.Defaults(scope.DivisionId);
        var holidays = (await db.Holidays.AsNoTracking().Where(h => h.DivisionId == scope.DivisionId).Select(h => h.Date).ToListAsync(cancellationToken)).ToHashSet();
        var users = await db.Users.AsNoTracking()
            .Where(u => u.DivisionId == scope.DivisionId && u.Active && u.Role != Role.PLATFORM_ADMIN)
            .OrderBy(u => u.FirstName).ThenBy(u => u.LastName)
            .Select(u => new { u.Id, Name = u.FirstName + " " + u.LastName, u.Role, u.TeamId, u.ManagerId })
            .ToListAsync(cancellationToken);
        var names = users.ToDictionary(u => u.Id, u => u.Name);
        var managerNames = await db.Users.AsNoTracking().Where(u => u.DivisionId == scope.DivisionId).ToDictionaryAsync(u => u.Id, u => u.FirstName + " " + u.LastName, cancellationToken);
        var teams = (await db.Teams.AsNoTracking().Where(t => t.DivisionId == scope.DivisionId).OrderBy(t => t.Name).ToListAsync(cancellationToken))
            .Select(t => new TeamInfo(t.Id, t.Name, t.ManagerId, t.ManagerId is { } m ? managerNames.GetValueOrDefault(m) : null))
            .ToList();
        var teamManagers = teams.Where(t => t.ManagerId != null).Select(t => t.ManagerId!.Value).ToHashSet();
        var people = users
            .Where(u => !teamManagers.Contains(u.Id) && PermissionRules.Effective(u.Role, division.Overrides).Contains(Permission.ENTER_TIME))
            .Select(u => new Member(u.Id, u.Name, u.TeamId, u.ManagerId, u.ManagerId is { } m ? managerNames.GetValueOrDefault(m) : null))
            .ToList();

        var current = WeekRules.CurrentWeek(now);
        var asked = year is { } y && week is { } w && IsoWeek.IsValid(y, w) ? new IsoWeek(y, w) : current;
        return new Frame(division.Name, teams, people, settings, holidays, asked <= current ? asked : current, current, now);
    }

    /// <summary>Jours saisis (brouillons compris) et statut de chaque fiche, par personne et par semaine.</summary>
    private static async Task<IReadOnlyList<PersonWeek>> StatesAsync(TimeSheetDbContext db, DivisionScope scope, Frame frame, IReadOnlyList<IsoWeek> weeks, CancellationToken cancellationToken)
    {
        var ids = frame.People.Select(p => p.Id).ToList();
        var keys = weeks.Select(w => w.Year * 100 + w.Week).ToList();
        return await db.Timesheets.AsNoTracking()
            .Where(t => t.DivisionId == scope.DivisionId && ids.Contains(t.UserId) && keys.Contains(t.WeekYear * 100 + t.WeekNumber))
            .Select(t => new PersonWeek(t.UserId, new IsoWeek(t.WeekYear, t.WeekNumber), t.Days.Count, t.Status))
            .ToListAsync(cancellationToken);
    }

    /// <summary>Fiches soumises en attente : validateur et délai dépassé (règle de relance de la division).</summary>
    private static async Task<List<(Guid ManagerId, string Manager, string Team, bool Late)>> PendingAsync(TimeSheetDbContext db, DivisionScope scope, Frame frame, CancellationToken cancellationToken)
    {
        var ids = frame.People.Select(p => p.Id).ToList();
        var pending = await db.Timesheets.AsNoTracking()
            .Where(t => t.DivisionId == scope.DivisionId && t.Status == TimesheetStatus.SUBMITTED && t.SubmittedAt != null && ids.Contains(t.UserId))
            .Select(t => new { t.UserId, t.SubmittedAt })
            .ToListAsync(cancellationToken);
        var today = WeekRules.DoualaDay(frame.Now);
        var result = new List<(Guid, string, string, bool)>();
        foreach (var s in pending)
        {
            var person = frame.People.First(p => p.Id == s.UserId);
            if (person.ManagerId is not { } managerId) continue;
            var team = frame.Teams.FirstOrDefault(t => t.ManagerId == managerId) ?? frame.Teams.FirstOrDefault(t => t.Id == person.TeamId);
            var late = ValidationRules.ReminderDue(WeekRules.DoualaDay(s.SubmittedAt!.Value), today, frame.Settings.ReminderAfterWorkingDays, frame.Settings.WorkingDays, frame.Holidays, alreadyReminded: false);
            result.Add((managerId, person.Manager ?? "", team?.Name ?? person.Manager ?? "", late));
        }
        return result;
    }

    // ------------------------------------------------------------------------------------

    public sealed record HeadQuery(int? Year, int? Week) : IRequest<DivisionHeadDto>;

    public sealed class HeadHandler(TimeSheetDbContext db, IViewerAccessor viewers, TimeProvider clock) : IRequestHandler<HeadQuery, DivisionHeadDto>
    {
        public async Task<DivisionHeadDto> Handle(HeadQuery request, CancellationToken cancellationToken)
        {
            var scope = (await viewers.RequireAsync(cancellationToken)).Require(Permission.VIEW_DIVISION).Scope;
            var f = await FrameAsync(db, scope, clock.GetUtcNow(), request.Year, request.Week, cancellationToken);
            return new DivisionHeadDto(f.Name, f.Teams.Count, f.People.Count, new WeekRef(f.Week.Year, f.Week.Week), new WeekRef(f.Current.Year, f.Current.Week), f.Settings.FillAlertThreshold);
        }
    }

    public sealed record WeekQuery(int? Year, int? Week) : IRequest<WeekBlockDto>;

    public sealed class WeekHandler(TimeSheetDbContext db, IViewerAccessor viewers, TimeProvider clock) : IRequestHandler<WeekQuery, WeekBlockDto>
    {
        public async Task<WeekBlockDto> Handle(WeekQuery request, CancellationToken cancellationToken)
        {
            var scope = (await viewers.RequireAsync(cancellationToken)).Require(Permission.VIEW_DIVISION).Scope;
            var f = await FrameAsync(db, scope, clock.GetUtcNow(), request.Year, request.Week, cancellationToken);
            var weeks = f.TrendWeeks;
            var states = await StatesAsync(db, scope, f, weeks, cancellationToken);
            var (rows, total) = ConsolidatedRules.TeamTable(f.Teams, f.People, states, f.Week, f.Expected(f.Week), f.Settings.FillAlertThreshold);
            return new WeekBlockDto(rows, total, ConsolidatedRules.Trend(weeks, states, f.People.Count, weeks.Select(f.Expected).ToList(), f.Current));
        }
    }

    public sealed record DriftsQuery(int? Year, int? Week) : IRequest<IReadOnlyList<Drift>>;

    public sealed class DriftsHandler(TimeSheetDbContext db, IViewerAccessor viewers, TimeProvider clock) : IRequestHandler<DriftsQuery, IReadOnlyList<Drift>>
    {
        public async Task<IReadOnlyList<Drift>> Handle(DriftsQuery request, CancellationToken cancellationToken)
        {
            var scope = (await viewers.RequireAsync(cancellationToken)).Require(Permission.VIEW_DIVISION).Scope;
            var f = await FrameAsync(db, scope, clock.GetUtcNow(), request.Year, request.Week, cancellationToken);
            var weeks = f.TrendWeeks;
            var states = await StatesAsync(db, scope, f, weeks, cancellationToken);
            var (rows, _) = ConsolidatedRules.TeamTable(f.Teams, f.People, states, f.Week, f.Expected(f.Week), f.Settings.FillAlertThreshold);

            // Budget : jours des fiches soumises ou validées, projets budgétés et non archivés.
            var budgeted = await db.Projects.AsNoTracking()
                .Where(p => p.DivisionId == scope.DivisionId && !p.IsSystem && p.ArchivedAt == null && p.BudgetDays != null)
                .Select(p => new { p.Id, p.Name, Budget = p.BudgetDays!.Value, p.ManagerId })
                .ToListAsync(cancellationToken);
            var budgetIds = budgeted.Select(p => p.Id).ToList();
            var consumed = await (from d in db.TimesheetDays
                                  join t in db.Timesheets on d.TimesheetId equals t.Id
                                  join a in db.Activities on d.ActivityId equals a.Id
                                  where t.DivisionId == scope.DivisionId && budgetIds.Contains(a.ProjectId) && (t.Status == TimesheetStatus.SUBMITTED || t.Status == TimesheetStatus.VALIDATED)
                                  group d by a.ProjectId into g
                                  select new { g.Key, Days = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.Days, cancellationToken);
            var owners = await db.Users.AsNoTracking().Where(u => u.DivisionId == scope.DivisionId).ToDictionaryAsync(u => u.Id, u => u.FirstName + " " + u.LastName, cancellationToken);

            return ConsolidatedRules.Sort(
                ConsolidatedRules.BudgetDrifts(budgeted.Select(p => (p.Id, p.Name, consumed.GetValueOrDefault(p.Id), p.Budget, p.ManagerId is { } m ? owners.GetValueOrDefault(m) : null)))
                    .Concat(ConsolidatedRules.UnderfillDrifts(rows, f.Week, f.Settings.FillAlertThreshold))
                    .Concat(ConsolidatedRules.LateDrifts(await PendingAsync(db, scope, f, cancellationToken), f.Settings.ReminderAfterWorkingDays))
                    .Concat(ConsolidatedRules.MissingDrifts(f.People, states, weeks, weeks.Select(f.Expected).ToList(), weeks.Select(f.Deadline).ToList(), f.Now)));
        }
    }

    // ------------------------------------------------------------------------------------
    // Relances (actions des dérives)
    // ------------------------------------------------------------------------------------

    /// <summary>« Relancer le manager » : fiches de ses rattachés en attente depuis plus de N jours ouvrés.</summary>
    public sealed record RemindManagerCommand(Guid ManagerId) : IRequest<Reminded>;

    public sealed class RemindManagerHandler(TimeSheetDbContext db, IViewerAccessor viewers, IAuditWriter audit, IMailSender mail, IConfiguration configuration, TimeProvider clock)
        : IRequestHandler<RemindManagerCommand, Reminded>
    {
        public async Task<Reminded> Handle(RemindManagerCommand request, CancellationToken cancellationToken)
        {
            var viewer = (await viewers.RequireAsync(cancellationToken)).Require(Permission.VIEW_DIVISION);
            var scope = viewer.Scope;
            var manager = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == request.ManagerId && u.DivisionId == scope.DivisionId && u.Active, cancellationToken)
                          ?? throw new NotFoundException("Manager introuvable.");
            var f = await FrameAsync(db, scope, clock.GetUtcNow(), null, null, cancellationToken);
            var count = (await PendingAsync(db, scope, f, cancellationToken)).Count(s => s.ManagerId == manager.Id && s.Late);
            if (count == 0) throw new RuleException("nothingLate");
            var team = f.Teams.FirstOrDefault(t => t.ManagerId == manager.Id)?.Name ?? manager.FullName;
            var url = $"{(configuration["APP_URL"] ?? "http://localhost:5173").TrimEnd('/')}/validation";
            var ok = await mail.SendAsync(MailTemplates.ManagerReminder(manager.Email, manager.FirstName, team, count, f.Settings.ReminderAfterWorkingDays, url), cancellationToken);
            await audit.AppendAsync("VALIDATION_REMINDER_SENT", viewer.FullName, $"Équipe {team} · {manager.FullName}", ok ? AuditResult.SUCCESS : AuditResult.FAILURE, viewer.UserId, scope.DivisionId, new { count }, cancellationToken);
            if (!ok) throw new RuleException("mailFailed");
            return new Reminded(manager.FullName);
        }
    }

    /// <summary>« Relancer » : rappel de saisie d'une semaine dont l'échéance est passée sans soumission.</summary>
    public sealed record RemindPersonCommand(Guid PersonId, int Year, int Week) : IRequest<Reminded>;

    public sealed class RemindPersonHandler(TimeSheetDbContext db, IViewerAccessor viewers, IAuditWriter audit, IMailSender mail, IConfiguration configuration, TimeProvider clock)
        : IRequestHandler<RemindPersonCommand, Reminded>
    {
        public async Task<Reminded> Handle(RemindPersonCommand request, CancellationToken cancellationToken)
        {
            var viewer = (await viewers.RequireAsync(cancellationToken)).Require(Permission.VIEW_DIVISION);
            var scope = viewer.Scope;
            var week = WeekRequest.Parse(request.Year, request.Week);
            var person = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == request.PersonId && u.DivisionId == scope.DivisionId && u.Active, cancellationToken)
                         ?? throw new NotFoundException("Personne introuvable.");
            var f = await FrameAsync(db, scope, clock.GetUtcNow(), null, null, cancellationToken);
            var stored = await db.Timesheets.AsNoTracking()
                .Where(t => t.DivisionId == scope.DivisionId && t.UserId == person.Id && t.WeekYear == week.Year && t.WeekNumber == week.Week)
                .Select(t => (TimesheetStatus?)t.Status).FirstOrDefaultAsync(cancellationToken);
            if (WeekRules.Display(stored, f.Deadline(week), f.Now) != DisplayStatus.MISSING) throw new RuleException("nothingLate");

            var days = WeekRules.WorkingDays(week, f.Settings.WorkingDays);
            var url = $"{(configuration["APP_URL"] ?? "http://localhost:5173").TrimEnd('/')}/saisie/{week.Year}/{week.Week}";
            // La préférence « rappel de saisie » de l'écran 14 s'applique aussi à cette relance.
            var ok = !person.Wants(Users.NotificationKind.FillReminder) || await mail.SendAsync(MailTemplates.FillReminder(person.Email, person.FirstName, week.Week, FrenchFormat.Range(days[0], days[^1]),
                FrenchFormat.Date(WeekRules.DoualaDay(f.Deadline(week))), url), cancellationToken);
            await audit.AppendAsync("FILL_REMINDER_SENT", viewer.FullName, $"Semaine {week.Week} de {week.Year} · {person.FullName}", ok ? AuditResult.SUCCESS : AuditResult.FAILURE, viewer.UserId, scope.DivisionId, cancellationToken: cancellationToken);
            if (!ok) throw new RuleException("mailFailed");
            return new Reminded(person.FullName);
        }
    }
}
