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
    bool UnusualProject,
    bool Actionable,
    string? ApprovedBy);

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
    int Year,
    int Week,
    string Status,
    DateTimeOffset? SubmittedAt,
    int SubmissionCount,
    string? Comment,
    IReadOnlyList<ReviewDayDto> Days,
    IReadOnlyList<DayChoiceDto> Choices,
    IReadOnlyList<ReviewEventDto> History,
    PositionDto? Position,
    bool CanDecide,
    string? ApprovedBy,
    DateTimeOffset? ApprovedAt);

/// <summary>
/// Résultat d'une décision : fiches traitées, fiches déjà traitées entre-temps, fiche en attente
/// suivante ; <c>Forwarded</c> : parmi les fiches validées, celles qui passent à l'owner (N+2).
/// </summary>
public sealed record DecisionResult(int Done, int Skipped, Guid? Next, int Forwarded = 0);

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

    /// <summary>
    /// Circuit vu par le validateur : la division demande-t-elle l'owner (N+2), le validateur est-il
    /// owner, l'owner est-il le validateur attendu d'une personne (ses rattachés, ou toute personne
    /// dont le manager manque : sans cela, une fiche soumise avant la désactivation de son manager
    /// n'aurait plus personne pour décider), et quels owners actifs peuvent recevoir une fiche.
    /// </summary>
    internal sealed record Circuit(bool OwnerValidation, bool ViewerIsOwner, IReadOnlySet<Guid> OwnerValidated, IReadOnlySet<Guid> Owners)
    {
        public bool Actionable(Guid userId, bool approved) =>
            ValidationRules.Actionable(ViewerIsOwner, OwnerValidation, approved, OwnerValidated.Contains(userId));

        /// <summary>Un owner actif, autre que la personne, peut-il recevoir sa fiche ?</summary>
        public bool OwnerAvailableFor(Guid userId) => Owners.Any(o => o != userId);
    }

    internal static async Task<Circuit> CircuitAsync(TimeSheetDbContext db, DivisionScope scope, CancellationToken cancellationToken)
    {
        var settings = await db.DivisionSettings.AsNoTracking().FirstOrDefaultAsync(s => s.DivisionId == scope.DivisionId, cancellationToken) ?? DivisionSettings.Defaults(scope.DivisionId);
        var users = await db.Users.AsNoTracking().Where(u => u.DivisionId == scope.DivisionId)
            .Select(u => new { u.Id, u.ManagerId, u.Role, u.Active }).ToListAsync(cancellationToken);
        var byId = users.ToDictionary(u => u.Id);
        var owners = users.Where(u => u.Active && u.Role == Role.OWNER).Select(u => u.Id).ToHashSet();
        var ownerValidated = users.Where(u =>
                u.ManagerId is not { } m || !byId.TryGetValue(m, out var manager) || !manager.Active || manager.Role == Role.OWNER)
            .Select(u => u.Id).ToHashSet();
        return new Circuit(settings.OwnerValidation, scope.Role == Role.OWNER, ownerValidated, owners);
    }

    /// <summary>Fiches en attente sur lesquelles le validateur peut agir.</summary>
    internal static async Task<HashSet<Guid>> ActionableIdsAsync(TimeSheetDbContext db, DivisionScope scope, Circuit circuit, CancellationToken cancellationToken) =>
        (await Sheets(db, scope).AsNoTracking().Where(t => t.Status == TimesheetStatus.SUBMITTED)
            .Select(t => new { t.Id, t.UserId, Approved = t.ApprovedAt != null }).ToListAsync(cancellationToken))
        .Where(t => circuit.Actionable(t.UserId, t.Approved)).Select(t => t.Id).ToHashSet();

    /// <summary>Fiches en attente du validateur, dans l'ordre de la file : semaine la plus récente d'abord, puis par nom.</summary>
    internal static async Task<List<Guid>> PendingIdsAsync(TimeSheetDbContext db, DivisionScope scope, CancellationToken cancellationToken)
    {
        var actionable = await ActionableIdsAsync(db, scope, await CircuitAsync(db, scope, cancellationToken), cancellationToken);
        return await (from t in Sheets(db, scope).Where(t => actionable.Contains(t.Id))
                      join u in db.Users on t.UserId equals u.Id
                      orderby t.WeekYear descending, t.WeekNumber descending, u.FirstName, u.LastName
                      select t.Id).ToListAsync(cancellationToken);
    }

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

            // « En attente » : les fiches sur lesquelles le validateur peut agir. Une fiche qui attend
            // l'autre étape du circuit reste visible sous « Toutes ».
            var circuit = await CircuitAsync(db, scope, cancellationToken);
            var actionable = await ActionableIdsAsync(db, scope, circuit, cancellationToken);
            var grouped = await sheets.GroupBy(t => t.Status).Select(g => new { g.Key, Count = g.Count() }).ToListAsync(cancellationToken);
            int Count(TimesheetStatus s) => grouped.FirstOrDefault(g => g.Key == s)?.Count ?? 0;
            var pendingCount = await sheets.CountAsync(t => actionable.Contains(t.Id), cancellationToken);
            var counts = new QueueCountsDto(pendingCount, Count(TimesheetStatus.VALIDATED), Count(TimesheetStatus.REJECTED), grouped.Sum(g => g.Count));

            var shown = request.Tab switch
            {
                QueueTab.SUBMITTED => sheets.Where(t => actionable.Contains(t.Id)),
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
                                  t.ApprovedById,
                                  Activities = t.Days.Select(d => d.ActivityId).ToList(),
                              }).ToListAsync(cancellationToken);
            var approverIds = rows.Where(r => r.ApprovedById != null).Select(r => r.ApprovedById!.Value).Distinct().ToList();
            var approvers = await db.Users.AsNoTracking().Where(u => approverIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.FirstName + " " + u.LastName, cancellationToken);

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
                    UnusualProject: unusual,
                    Actionable: actionable.Contains(r.Id),
                    ApprovedBy: r.Status == TimesheetStatus.SUBMITTED && r.ApprovedById is { } a ? approvers.GetValueOrDefault(a) : null);
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
            var canDecide = false;
            if (sheet.Status == TimesheetStatus.SUBMITTED)
            {
                var pending = await PendingIdsAsync(db, scope, cancellationToken);
                var i = pending.IndexOf(sheet.Id);
                canDecide = i >= 0;
                if (canDecide) position = new PositionDto(i + 1, pending.Count, i > 0 ? pending[i - 1] : null, i < pending.Count - 1 ? pending[i + 1] : null);
            }
            string? approvedBy = null;
            if (sheet.Status == TimesheetStatus.SUBMITTED && sheet.ApprovedById is { } approverId)
                approvedBy = actors.GetValueOrDefault(approverId) ?? await db.Users.AsNoTracking().Where(u => u.Id == approverId).Select(u => u.FirstName + " " + u.LastName).FirstOrDefaultAsync(cancellationToken);

            return new ReviewDto(sheet.Id, person.FullName, person.Role.ToString(), sheet.WeekYear, sheet.WeekNumber, sheet.Status.ToString(),
                sheet.SubmittedAt, sheet.SubmissionCount, sheet.Comment, days, choices, history, position,
                canDecide, approvedBy, approvedBy is null ? null : sheet.ApprovedAt);
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

    public sealed class DecideHandler(TimeSheetDbContext db, IViewerAccessor viewers, IEntryContext entry, IAuditWriter audit, IMailSender mail, IConfiguration configuration, TimeProvider clock)
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

            var circuit = await CircuitAsync(db, scope, cancellationToken);
            List<Guid>? pendingBefore = null;
            if (request.Single)
            {
                var target = await Sheets(db, scope).AsNoTracking().Where(t => t.Id == ids[0])
                                 .Select(t => new { t.UserId, t.Status, Approved = t.ApprovedAt != null }).FirstOrDefaultAsync(cancellationToken)
                             ?? throw new NotFoundException("Fiche introuvable.");
                // Fiche qui attend l'autre étape du circuit : elle n'est pas (ou plus) à ce validateur.
                if (target.Status == TimesheetStatus.SUBMITTED && !circuit.Actionable(target.UserId, target.Approved)) throw new RuleException("otherStep");
                pendingBefore = await PendingIdsAsync(db, scope, cancellationToken);
            }

            var now = clock.GetUtcNow();
            var decided = new List<Timesheet>();
            var forwarded = new List<Timesheet>();
            foreach (var id in ids)
            {
                var current = await Sheets(db, scope).AsNoTracking().Where(t => t.Id == id && t.Status == TimesheetStatus.SUBMITTED)
                    .Select(t => new { t.UserId, Approved = t.ApprovedAt != null }).FirstOrDefaultAsync(cancellationToken);
                if (current is null || !circuit.Actionable(current.UserId, current.Approved)) continue;

                await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
                // Garde : une seule décision par étape, même si deux validateurs cliquent ensemble.
                // La mise à jour verrouille la ligne ; la seconde transaction relit l'état et ne trouve plus rien.
                var claimed = await db.Timesheets
                    .Where(t => t.Id == id && t.Status == TimesheetStatus.SUBMITTED && (t.ApprovedAt != null) == current.Approved)
                    .ExecuteUpdateAsync(s => s.SetProperty(t => t.SubmissionCount, t => t.SubmissionCount), cancellationToken);
                if (claimed == 0) continue;

                var sheet = await db.Timesheets.Include(t => t.Days).FirstAsync(t => t.Id == id, cancellationToken);
                var forward = request.Validate && !current.Approved
                              && ValidationRules.ForwardToOwner(circuit.OwnerValidation, circuit.ViewerIsOwner, circuit.OwnerAvailableFor(sheet.UserId));
                if (forward)
                {
                    sheet.Approve(scope.UserId, now);
                    forwarded.Add(sheet);
                }
                else if (request.Validate) sheet.Validate(scope.UserId, now);
                else
                {
                    // Seule une journée saisie se signale.
                    var entered = sheet.Days.Select(d => d.Date).ToHashSet();
                    if (flagged.Any(d => !entered.Contains(d))) throw new RuleException("invalidDay");
                    sheet.Reject(scope.UserId, now, reason, flagged);
                }
                await db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);
                if (!forward) decided.Add(sheet);
            }

            if (request.Single && decided.Count + forwarded.Count == 0) throw new RuleException("alreadyDecided");
            // Validation N+1 transmise à l'owner : le journal seulement ; le collaborateur est prévenu à la décision finale.
            foreach (var sheet in forwarded)
            {
                var name = await db.Users.AsNoTracking().Where(u => u.Id == sheet.UserId).Select(u => u.FirstName + " " + u.LastName).FirstAsync(cancellationToken);
                await audit.AppendAsync("TIMESHEET_APPROVED", viewer.FullName, $"Semaine {sheet.WeekNumber} · {name}", AuditResult.SUCCESS, viewer.UserId, sheet.DivisionId, cancellationToken: cancellationToken);
            }
            await NotifyAsync(viewer, decided, request.Validate, reason, cancellationToken);

            Guid? next = null;
            if (pendingBefore is not null)
            {
                var i = pendingBefore.IndexOf(ids[0]);
                next = pendingBefore.Skip(i + 1).Concat(pendingBefore).Where(p => p != ids[0]).Cast<Guid?>().FirstOrDefault();
            }
            var done = decided.Count + forwarded.Count;
            return new DecisionResult(done, ids.Count - done, next, forwarded.Count);
        }

        /// <summary>Journal d'audit, puis e-mail au collaborateur. Un échec d'envoi n'annule rien.</summary>
        private async Task NotifyAsync(Viewer viewer, List<Timesheet> decided, bool validated, string reason, CancellationToken cancellationToken)
        {
            if (decided.Count == 0) return;
            var userIds = decided.Select(s => s.UserId).ToList();
            var people = await db.Users.AsNoTracking().Where(u => userIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, cancellationToken);
            var appUrl = (configuration["APP_URL"] ?? "http://localhost:5173").TrimEnd('/');
            // Décision groupée : les cadres des semaines décidées sont lus en une fois.
            var frames = await entry.FramesAsync(viewer.Scope, decided.Select(s => s.Week).Distinct().ToList(), cancellationToken);
            foreach (var sheet in decided)
            {
                var person = people[sheet.UserId];
                var week = sheet.Week;
                await audit.AppendAsync(validated ? "TIMESHEET_VALIDATED" : "TIMESHEET_REJECTED", viewer.FullName, $"Semaine {week.Week} · {person.FullName}", AuditResult.SUCCESS, viewer.UserId, sheet.DivisionId, cancellationToken: cancellationToken);

                // Préférence de l'écran 14 : la personne peut couper ces e-mails.
                if (!person.Wants(validated ? Users.NotificationKind.Validated : Users.NotificationKind.Rejected)) continue;
                var frame = frames[week];
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
    /// Relance le validateur d'une fiche qui attend depuis N jours ouvrés (N réglé par division,
    /// 3 par défaut), une fois par étape : le manager depuis la soumission, les owners depuis la
    /// validation du manager. Renvoie le nombre de relances envoyées.
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
                .OrderBy(t => t.ApprovedAt ?? t.SubmittedAt)
                .ToListAsync(cancellationToken);

            var calendars = new Dictionary<Guid, DivisionCalendar>();
            var sent = 0;
            foreach (var sheet in sheets)
            {
                if (!calendars.TryGetValue(sheet.DivisionId, out var calendar))
                    calendars[sheet.DivisionId] = calendar = await CalendarAsync(db, sheet.DivisionId, cancellationToken);
                var due = ValidationRules.ReminderDue(WeekRules.DoualaDay(sheet.StageStartedAt!.Value), today, calendar.Settings.ReminderAfterWorkingDays,
                    calendar.Settings.WorkingDays, calendar.Holidays, sheet.RemindedThisStage);
                if (!due) continue;

                // Étape owner : chaque owner actif de la division, sauf la personne elle-même.
                List<ValidatorInfo> validators = sheet.ApprovedAt is null
                    ? (await entry.ValidatorOfAsync(sheet.DivisionId, sheet.UserId, cancellationToken)) is { } v ? [v] : []
                    : await db.Users.AsNoTracking()
                        .Where(u => u.DivisionId == sheet.DivisionId && u.Active && u.Role == Role.OWNER && u.Id != sheet.UserId)
                        .OrderBy(u => u.FirstName).ThenBy(u => u.LastName)
                        .Select(u => new ValidatorInfo(u.Id, u.Email, u.FirstName, u.FirstName + " " + u.LastName))
                        .ToListAsync(cancellationToken);
                if (validators.Count == 0) continue;
                var name = await db.Users.AsNoTracking().Where(u => u.Id == sheet.UserId).Select(u => u.FirstName + " " + u.LastName).FirstAsync(cancellationToken);
                var days = calendar.Days(sheet.Week);
                var ok = false;
                foreach (var validator in validators)
                    ok |= await mail.SendAsync(MailTemplates.Reminder(validator.Email, validator.FirstName, name, sheet.WeekNumber,
                        FrenchFormat.Range(days[0], days[^1]), FrenchFormat.Date(WeekRules.DoualaDay(sheet.SubmittedAt!.Value)), $"{appUrl}/validation/{sheet.Id}"), cancellationToken);
                if (!ok) continue;

                sheet.RecordReminder(validators[0].Id, now);
                await db.SaveChangesAsync(cancellationToken);
                await audit.AppendAsync("VALIDATION_REMINDER_SENT", "TimeSheet", $"Semaine {sheet.WeekNumber} · {name}", AuditResult.SUCCESS, divisionId: sheet.DivisionId, cancellationToken: cancellationToken);
                sent++;
            }
            return sent;
        }
    }
}
