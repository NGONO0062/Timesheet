namespace TimeSheet.Api.Domain.Timesheets.Features;

using MediatR;
using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Databases;
using TimeSheet.Api.Domain.Access;
using TimeSheet.Api.Domain.Divisions;
using TimeSheet.Api.Domain.Users;
using TimeSheet.Api.Exceptions;
using TimeSheet.Api.Services.Access;
using TimeSheet.Api.Services.Audit;
using TimeSheet.Api.Services.Mail;

public sealed record PersonDto(Guid Id, string Name);

public sealed record QueueCountsDto(int Submitted, int Validated, int Rejected, int All);

/// <summary>
/// Ligne de la file (écran 07). Étiquettes d'attention (docs/design-v2.md, §6) : commentaire
/// du collaborateur, absence dans la semaine, projet inhabituel pour la personne ; la
/// deuxième soumission se lit dans <c>SubmissionCount</c>.
/// </summary>
public sealed record QueueRowDto(
    Guid Id,
    string Name,
    int Year,
    int Week,
    DateOnly Monday,
    string Status,
    int Filled,
    int Expected,
    int Projects,
    DateTimeOffset? SubmittedAt,
    int SubmissionCount,
    bool HasComment,
    bool HasAbsence,
    bool UnusualProject);

public sealed record QueueDto(WeekRef Current, IReadOnlyList<PersonDto> People, QueueCountsDto Counts, IReadOnlyList<QueueRowDto> Rows);

public sealed record ReviewDayDto(DateOnly Date, int Expected, Guid? Value, bool Flagged);

/// <summary>Événement de l'historique vu par le validateur : « Soumise par … », « Relance envoyée à … ».</summary>
public sealed record ReviewEventDto(string Type, string By, DateTimeOffset At);

/// <summary>Place de la fiche parmi les fiches en attente : « Fiche 1 sur 6 », Précédente, Suivante.</summary>
public sealed record PositionDto(int Index, int Count, Guid? Previous, Guid? Next);

/// <summary>Détail d'une fiche (écran 08).</summary>
public sealed record ReviewDto(
    Guid Id,
    string Name,
    string Role,
    bool IsIntern,
    int Year,
    int Week,
    string Status,
    DateTimeOffset? SubmittedAt,
    int SubmissionCount,
    string? Comment,
    IReadOnlyList<ReviewDayDto> Days,
    IReadOnlyList<DayChoiceDto> Choices,
    IReadOnlyList<ReviewEventDto> History,
    PositionDto? Position);

/// <summary>Résultat d'une décision : fiches traitées, fiches déjà traitées entre-temps, fiche en attente suivante.</summary>
public sealed record DecisionResult(int Done, int Skipped, Guid? Next);

/// <summary>
/// Validation des fiches (PROMPT.md §9.3, reprise de lib/data/validation.ts). Portée : un
/// manager voit ses rattachés directs, un owner toute sa division ; personne ne voit une autre
/// division ni ses propres fiches. Une fiche hors de la portée n'existe pas (404).
/// </summary>
public static class Validation
{
    /// <summary>Personnes dont le validateur examine les fiches.</summary>
    internal static IQueryable<User> Reviewable(TimeSheetDbContext db, DivisionScope scope)
    {
        var users = db.Users.Where(u => u.DivisionId == scope.DivisionId && u.Id != scope.UserId);
        return scope.Role == Role.OWNER ? users : users.Where(u => u.ManagerId == scope.UserId);
    }

    /// <summary>Fiches visibles du validateur : soumises, validées ou rejetées (jamais un brouillon).</summary>
    internal static IQueryable<Timesheet> Sheets(TimeSheetDbContext db, DivisionScope scope)
    {
        var people = Reviewable(db, scope).Select(u => u.Id);
        return db.Timesheets.Where(t => t.DivisionId == scope.DivisionId && t.Status != TimesheetStatus.DRAFT && people.Contains(t.UserId));
    }

    /// <summary>Fiches en attente, dans l'ordre de la file : semaine la plus récente d'abord, puis par nom.</summary>
    internal static Task<List<Guid>> PendingIdsAsync(TimeSheetDbContext db, DivisionScope scope, CancellationToken cancellationToken) =>
        (from t in Sheets(db, scope).Where(t => t.Status == TimesheetStatus.SUBMITTED)
         join u in db.Users on t.UserId equals u.Id
         orderby t.WeekYear descending, t.WeekNumber descending, u.FirstName, u.LastName
         select t.Id).ToListAsync(cancellationToken);

    private static int Key(int year, int week) => year * 100 + week;

    private sealed record DivisionCalendar(DivisionSettings Settings, IReadOnlySet<DateOnly> Holidays)
    {
        public IReadOnlyList<DateOnly> Days(IsoWeek week) => WeekRules.WorkingDays(week, Settings.WorkingDays);

        public int Expected(IsoWeek week) => Days(week).Count(d => !Holidays.Contains(d));
    }

    private static async Task<DivisionCalendar> CalendarAsync(TimeSheetDbContext db, Guid divisionId, CancellationToken cancellationToken)
    {
        var settings = await db.DivisionSettings.AsNoTracking().FirstOrDefaultAsync(s => s.DivisionId == divisionId, cancellationToken) ?? DivisionSettings.Defaults(divisionId);
        var holidays = await db.Holidays.AsNoTracking().Where(h => h.DivisionId == divisionId).Select(h => h.Date).ToListAsync(cancellationToken);
        return new DivisionCalendar(settings, holidays.ToHashSet());
    }

    /// <summary>Activité → projet (et projet système « Absence »), pour une division.</summary>
    private static async Task<Dictionary<Guid, (Guid ProjectId, bool IsSystem, string Project, string Activity, string Code)>> ActivitiesAsync(TimeSheetDbContext db, Guid divisionId, CancellationToken cancellationToken) =>
        await (from a in db.Activities
               join p in db.Projects on a.ProjectId equals p.Id
               where p.DivisionId == divisionId
               select new { a.Id, a.ProjectId, p.IsSystem, Project = p.Name, Activity = a.Name, p.Code })
            .ToDictionaryAsync(x => x.Id, x => (x.ProjectId, x.IsSystem, x.Project, x.Activity, x.Code), cancellationToken);

    // ------------------------------------------------------------------------------------
    // File (écran 07)
    // ------------------------------------------------------------------------------------

    public sealed record QueueQuery(Guid? PersonId, string? Period, QueueTab Tab) : IRequest<QueueDto>;

    public sealed class QueueHandler(TimeSheetDbContext db, IViewerAccessor viewers, TimeProvider clock) : IRequestHandler<QueueQuery, QueueDto>
    {
        /// <summary>Semaines regardées en arrière pour dire qu'un projet est inhabituel.</summary>
        private const int UsualWeeks = 8;

        public async Task<QueueDto> Handle(QueueQuery request, CancellationToken cancellationToken)
        {
            var scope = (await viewers.RequireAsync(cancellationToken)).Require(Permission.VALIDATE_TEAM).Scope;
            var current = WeekRules.CurrentWeek(clock.GetUtcNow());
            var weeks = ValidationRules.PeriodWeeks(request.Period, current);

            var people = await Reviewable(db, scope).AsNoTracking()
                .OrderBy(u => u.FirstName).ThenBy(u => u.LastName)
                .Select(u => new PersonDto(u.Id, u.FirstName + " " + u.LastName))
                .ToListAsync(cancellationToken);
            // Une personne hors de la portée vaut « Toute l'équipe ».
            var personId = people.Any(p => p.Id == request.PersonId) ? request.PersonId : null;

            var sheets = Sheets(db, scope).AsNoTracking();
            if (personId is { } id) sheets = sheets.Where(t => t.UserId == id);
            if (weeks is not null)
            {
                var keys = weeks.Select(w => Key(w.Year, w.Week)).ToList();
                sheets = sheets.Where(t => keys.Contains(t.WeekYear * 100 + t.WeekNumber));
            }

            var grouped = await sheets.GroupBy(t => t.Status).Select(g => new { g.Key, Count = g.Count() }).ToListAsync(cancellationToken);
            int Count(TimesheetStatus s) => grouped.FirstOrDefault(g => g.Key == s)?.Count ?? 0;
            var counts = new QueueCountsDto(Count(TimesheetStatus.SUBMITTED), Count(TimesheetStatus.VALIDATED), Count(TimesheetStatus.REJECTED), grouped.Sum(g => g.Count));

            var shown = request.Tab switch
            {
                QueueTab.SUBMITTED => sheets.Where(t => t.Status == TimesheetStatus.SUBMITTED),
                QueueTab.VALIDATED => sheets.Where(t => t.Status == TimesheetStatus.VALIDATED),
                QueueTab.REJECTED => sheets.Where(t => t.Status == TimesheetStatus.REJECTED),
                _ => sheets,
            };
            var rows = await (from t in shown
                              join u in db.Users on t.UserId equals u.Id
                              orderby t.WeekYear descending, t.WeekNumber descending, u.FirstName, u.LastName
                              select new
                              {
                                  t.Id,
                                  t.UserId,
                                  Name = u.FirstName + " " + u.LastName,
                                  t.WeekYear,
                                  t.WeekNumber,
                                  t.Status,
                                  t.SubmittedAt,
                                  t.SubmissionCount,
                                  t.Comment,
                                  Activities = t.Days.Select(d => d.ActivityId).ToList(),
                              }).ToListAsync(cancellationToken);

            var calendar = await CalendarAsync(db, scope.DivisionId, cancellationToken);
            var activities = await ActivitiesAsync(db, scope.DivisionId, cancellationToken);
            HashSet<Guid> ProjectsOf(IEnumerable<Guid> ids, bool withSystem) =>
                ids.Where(activities.ContainsKey).Select(a => activities[a]).Where(a => withSystem || !a.IsSystem).Select(a => a.ProjectId).ToHashSet();

            // Fiches précédentes des mêmes personnes : ce qu'elles déclarent d'habitude.
            var earlier = new List<(Guid UserId, int Key, List<Guid> Activities)>();
            if (rows.Count > 0)
            {
                var oldest = rows.Select(r => new IsoWeek(r.WeekYear, r.WeekNumber)).Min().Shift(-UsualWeeks);
                var users = rows.Select(r => r.UserId).Distinct().ToList();
                var from = Key(oldest.Year, oldest.Week);
                earlier = (await db.Timesheets.AsNoTracking()
                        .Where(t => t.DivisionId == scope.DivisionId && users.Contains(t.UserId) && t.Status != TimesheetStatus.DRAFT && t.WeekYear * 100 + t.WeekNumber >= from)
                        .Select(t => new { t.UserId, Key = t.WeekYear * 100 + t.WeekNumber, Activities = t.Days.Select(d => d.ActivityId).ToList() })
                        .ToListAsync(cancellationToken))
                    .Select(x => (x.UserId, x.Key, x.Activities)).ToList();
            }

            var result = rows.Select(r =>
            {
                var week = new IsoWeek(r.WeekYear, r.WeekNumber);
                var key = Key(week.Year, week.Week);
                var before = earlier.Where(e => e.UserId == r.UserId && e.Key < key && e.Key >= Key(week.Shift(-UsualWeeks).Year, week.Shift(-UsualWeeks).Week)).ToList();
                var usual = ProjectsOf(before.SelectMany(e => e.Activities), withSystem: false);
                var unusual = before.Count > 0 && ProjectsOf(r.Activities, withSystem: false).Any(p => !usual.Contains(p));
                return new QueueRowDto(
                    r.Id, r.Name, week.Year, week.Week, week.Monday, r.Status.ToString(),
                    r.Activities.Count, calendar.Expected(week), ProjectsOf(r.Activities, withSystem: true).Count,
                    r.SubmittedAt, r.SubmissionCount,
                    HasComment: !string.IsNullOrWhiteSpace(r.Comment),
                    HasAbsence: r.Activities.Any(a => activities.TryGetValue(a, out var x) && x.IsSystem),
                    UnusualProject: unusual);
            }).ToList();

            return new QueueDto(new WeekRef(current.Year, current.Week), people, counts, result);
        }
    }

    // ------------------------------------------------------------------------------------
    // Détail (écran 08)
    // ------------------------------------------------------------------------------------

    public sealed record ReviewQuery(Guid Id) : IRequest<ReviewDto>;

    public sealed class ReviewHandler(TimeSheetDbContext db, IViewerAccessor viewers, IEntryContext entry) : IRequestHandler<ReviewQuery, ReviewDto>
    {
        public async Task<ReviewDto> Handle(ReviewQuery request, CancellationToken cancellationToken)
        {
            var scope = (await viewers.RequireAsync(cancellationToken)).Require(Permission.VALIDATE_TEAM).Scope;
            var sheet = await Sheets(db, scope).AsNoTracking().Include(t => t.Days).Include(t => t.Events)
                            .FirstOrDefaultAsync(t => t.Id == request.Id, cancellationToken)
                        ?? throw new NotFoundException("Fiche introuvable.");
            var person = await db.Users.AsNoTracking().FirstAsync(u => u.Id == sheet.UserId, cancellationToken);

            var frame = await entry.FrameAsync(scope, sheet.Week, cancellationToken);
            var byDate = sheet.Days.ToDictionary(d => d.Date);
            var days = frame.Days.Select(d => new ReviewDayDto(d.Date, d.Expected, byDate.GetValueOrDefault(d.Date)?.ActivityId, byDate.GetValueOrDefault(d.Date)?.Flagged ?? false)).ToList();

            var activities = await ActivitiesAsync(db, scope.DivisionId, cancellationToken);
            var choices = sheet.Days.Select(d => d.ActivityId).Distinct()
                .Where(activities.ContainsKey)
                .Select(a => new DayChoiceDto(a, activities[a].Project, activities[a].Activity, activities[a].Code, false))
                .ToList();

            var events = sheet.Events.OrderByDescending(e => e.At).ToList();
            var actorIds = events.Select(e => e.ActorId).Distinct().ToList();
            var actors = await db.Users.AsNoTracking().Where(u => actorIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.FirstName + " " + u.LastName, cancellationToken);
            var history = events.Select(e => new ReviewEventDto(e.Type, actors.GetValueOrDefault(e.ActorId, ""), e.At)).ToList();

            PositionDto? position = null;
            if (sheet.Status == TimesheetStatus.SUBMITTED)
            {
                var pending = await PendingIdsAsync(db, scope, cancellationToken);
                var i = pending.IndexOf(sheet.Id);
                if (i >= 0) position = new PositionDto(i + 1, pending.Count, i > 0 ? pending[i - 1] : null, i < pending.Count - 1 ? pending[i + 1] : null);
            }

            return new ReviewDto(sheet.Id, person.FullName, person.Role.ToString(), IsIntern: false, sheet.WeekYear, sheet.WeekNumber, sheet.Status.ToString(),
                sheet.SubmittedAt, sheet.SubmissionCount, sheet.Comment, days, choices, history, position);
        }
    }

    // ------------------------------------------------------------------------------------
    // Décisions
    // ------------------------------------------------------------------------------------

    /// <summary>
    /// Valide ou rejette des fiches en attente. <c>Single</c> : depuis le détail (une fiche déjà
    /// traitée est refusée, la fiche suivante est renvoyée) ; sinon groupée (une fiche déjà
    /// traitée ou hors portée est ignorée et comptée à part). Journées signalées : rejet d'une
    /// seule fiche seulement.
    /// </summary>
    public sealed record DecideCommand(IReadOnlyList<Guid> Ids, bool Validate, string? Reason, IReadOnlyList<DateOnly>? Flagged, bool Single) : IRequest<DecisionResult>;

    public const int MaxSelection = 200;
    public const int MaxReason = 2000;

    public sealed class DecideHandler(TimeSheetDbContext db, IViewerAccessor viewers, IEntryContext entry, IAuditWriter audit, IMailSender mail, IConfiguration configuration, TimeProvider clock, Attendance.Features.IAttendanceService attendance)
        : IRequestHandler<DecideCommand, DecisionResult>
    {
        public async Task<DecisionResult> Handle(DecideCommand request, CancellationToken cancellationToken)
        {
            var viewer = (await viewers.RequireAsync(cancellationToken)).Require(Permission.VALIDATE_TEAM);
            var scope = viewer.Scope;
            var ids = request.Ids.Distinct().ToList();
            if (ids.Count is 0 or > MaxSelection || (request.Single && ids.Count != 1)) throw new RuleException("selection");
            var reason = request.Reason?.Trim() ?? "";
            if (!request.Validate && reason.Length == 0) throw new RuleException("reasonMissing");
            if (reason.Length > MaxReason) throw new RuleException("reason");
            var flagged = request.Flagged?.Distinct().ToList() ?? [];
            if (flagged.Count > 0 && (request.Validate || !request.Single)) throw new RuleException("flagsNotAllowed");

            List<Guid>? pendingBefore = null;
            if (request.Single)
            {
                if (!await Sheets(db, scope).AnyAsync(t => t.Id == ids[0], cancellationToken)) throw new NotFoundException("Fiche introuvable.");
                pendingBefore = await PendingIdsAsync(db, scope, cancellationToken);
            }

            var now = clock.GetUtcNow();
            var decided = new List<Timesheet>();
            foreach (var id in ids)
            {
                if (!await Sheets(db, scope).AnyAsync(t => t.Id == id && t.Status == TimesheetStatus.SUBMITTED, cancellationToken)) continue;

                await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
                // Garde : une seule décision par soumission, même si deux validateurs cliquent ensemble.
                // La mise à jour verrouille la ligne ; la seconde transaction relit le statut et ne trouve plus rien.
                var claimed = await db.Timesheets.Where(t => t.Id == id && t.Status == TimesheetStatus.SUBMITTED)
                    .ExecuteUpdateAsync(s => s.SetProperty(t => t.SubmissionCount, t => t.SubmissionCount), cancellationToken);
                if (claimed == 0) continue;

                var sheet = await db.Timesheets.Include(t => t.Days).FirstAsync(t => t.Id == id, cancellationToken);
                if (request.Validate) sheet.Validate(scope.UserId, now);
                else
                {
                    // Seule une journée saisie se signale.
                    var entered = sheet.Days.Select(d => d.Date).ToHashSet();
                    if (flagged.Any(d => !entered.Contains(d))) throw new RuleException("invalidDay");
                    sheet.Reject(scope.UserId, now, reason, flagged);
                }
                await db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);
                decided.Add(sheet);
            }

            if (request.Single && decided.Count == 0) throw new RuleException("alreadyDecided");
            await NotifyAsync(viewer, decided, request.Validate, reason, cancellationToken);

            Guid? next = null;
            if (pendingBefore is not null)
            {
                var i = pendingBefore.IndexOf(ids[0]);
                next = pendingBefore.Skip(i + 1).Concat(pendingBefore).Where(p => p != ids[0]).Cast<Guid?>().FirstOrDefault();
            }
            return new DecisionResult(decided.Count, ids.Count - decided.Count, next);
        }

        /// <summary>Journal d'audit, puis e-mail au collaborateur. Un échec d'envoi n'annule rien.</summary>
        private async Task NotifyAsync(Viewer viewer, List<Timesheet> decided, bool validated, string reason, CancellationToken cancellationToken)
        {
            if (decided.Count == 0) return;
            var userIds = decided.Select(s => s.UserId).ToList();
            var people = await db.Users.AsNoTracking().Where(u => userIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, cancellationToken);
            var appUrl = (configuration["APP_URL"] ?? "http://localhost:5173").TrimEnd('/');
            foreach (var sheet in decided)
            {
                var person = people[sheet.UserId];
                var week = sheet.Week;
                await audit.AppendAsync(validated ? "TIMESHEET_VALIDATED" : "TIMESHEET_REJECTED", viewer.FullName, $"Semaine {week.Week} · {person.FullName}", AuditResult.SUCCESS, viewer.UserId, sheet.DivisionId, cancellationToken: cancellationToken);

                // Mois entièrement validé : la fiche de présence du stagiaire est générée (§9.7).
                if (validated) await attendance.GenerateIfReadyAsync(sheet.DivisionId, sheet.UserId, week, clock.GetUtcNow(), cancellationToken);

                // Préférence de l'écran 14 : la personne peut couper ces e-mails.
                if (!person.Wants(validated ? Users.NotificationKind.Validated : Users.NotificationKind.Rejected)) continue;
                var frame = await entry.FrameAsync(viewer.Scope, week, cancellationToken);
                var range = FrenchFormat.Range(frame.Days[0].Date, frame.Days[^1].Date);
                var url = $"{appUrl}/saisie/{week.Year}/{week.Week}";
                var message = validated
                    ? MailTemplates.Validated(person.Email, person.FirstName, viewer.FullName, week.Week, range, FrenchFormat.Days(sheet.Days.Count), url)
                    : MailTemplates.Rejected(person.Email, person.FirstName, viewer.FullName, week.Week, range, reason, url);
                await mail.SendAsync(message, cancellationToken);
            }
        }
    }

    // ------------------------------------------------------------------------------------
    // Relances (tâche planifiée, toutes divisions, chacune avec ses propres règles)
    // ------------------------------------------------------------------------------------

    /// <summary>
    /// Relance le validateur d'une fiche soumise depuis N jours ouvrés sans décision (N réglé par
    /// division, 3 par défaut), une fois par soumission. Renvoie le nombre de relances envoyées.
    /// </summary>
    public sealed record RemindersCommand : IRequest<int>;

    public sealed class RemindersHandler(TimeSheetDbContext db, IEntryContext entry, IAuditWriter audit, IMailSender mail, IConfiguration configuration, TimeProvider clock)
        : IRequestHandler<RemindersCommand, int>
    {
        public async Task<int> Handle(RemindersCommand request, CancellationToken cancellationToken)
        {
            var now = clock.GetUtcNow();
            var today = WeekRules.DoualaDay(now);
            var appUrl = (configuration["APP_URL"] ?? "http://localhost:5173").TrimEnd('/');
            var sheets = await db.Timesheets.Include(t => t.Events)
                .Where(t => t.Status == TimesheetStatus.SUBMITTED && t.SubmittedAt != null)
                .OrderBy(t => t.SubmittedAt)
                .ToListAsync(cancellationToken);

            var calendars = new Dictionary<Guid, DivisionCalendar>();
            var sent = 0;
            foreach (var sheet in sheets)
            {
                if (!calendars.TryGetValue(sheet.DivisionId, out var calendar))
                    calendars[sheet.DivisionId] = calendar = await CalendarAsync(db, sheet.DivisionId, cancellationToken);
                var due = ValidationRules.ReminderDue(WeekRules.DoualaDay(sheet.SubmittedAt!.Value), today, calendar.Settings.ReminderAfterWorkingDays,
                    calendar.Settings.WorkingDays, calendar.Holidays, sheet.RemindedSinceSubmission);
                if (!due) continue;

                var validator = await entry.ValidatorOfAsync(sheet.DivisionId, sheet.UserId, cancellationToken);
                if (validator is null) continue;
                var name = await db.Users.AsNoTracking().Where(u => u.Id == sheet.UserId).Select(u => u.FirstName + " " + u.LastName).FirstAsync(cancellationToken);
                var days = calendar.Days(sheet.Week);
                var ok = await mail.SendAsync(MailTemplates.Reminder(validator.Email, validator.FirstName, name, sheet.WeekNumber,
                    FrenchFormat.Range(days[0], days[^1]), FrenchFormat.Date(WeekRules.DoualaDay(sheet.SubmittedAt.Value)), $"{appUrl}/validation/{sheet.Id}"), cancellationToken);
                if (!ok) continue;

                sheet.RecordReminder(validator.Id, now);
                await db.SaveChangesAsync(cancellationToken);
                await audit.AppendAsync("VALIDATION_REMINDER_SENT", "TimeSheet", $"Semaine {sheet.WeekNumber} · {name}", AuditResult.SUCCESS, divisionId: sheet.DivisionId, cancellationToken: cancellationToken);
                sent++;
            }
            return sent;
        }
    }
}
