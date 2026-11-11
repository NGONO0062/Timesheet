namespace TimeSheet.Api.Domain.Timesheets.Features;

using MediatR;
using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Databases;
using TimeSheet.Api.Domain.Access;
using TimeSheet.Api.Exceptions;
using TimeSheet.Api.Services.Access;
using TimeSheet.Api.Services.Audit;

public sealed record WeekRef(int Year, int Week);

/// <summary>Jour de la semaine. <c>Previous</c> : choix du même jour de la semaine à reprendre (voir <c>WeekDto.CopyFrom</c>).</summary>
public sealed record WeekDayDto(DateOnly Date, int Expected, string? Holiday, bool IsFuture, Guid? Value, bool Flagged, Guid? Previous = null);

public sealed record DecisionDto(string By, DateTimeOffset At, string? Reason);

public sealed record RecentWeekDto(int Year, int Week, string Status);

/// <summary>Événement de l'historique (écran 05) : soumise, rejetée, validée ; « par vous » pour la personne.</summary>
public sealed record HistoryDto(string Type, string By, bool ByYou, DateTimeOffset At);

/// <summary>Semaine de saisie (écrans 03, 04, 05), telle que l'interface l'affiche.</summary>
public sealed record WeekDto(
    int Year,
    int Week,
    WeekRef Current,
    bool AllowFutureWeeks,
    IReadOnlyList<WeekDayDto> Days,
    IReadOnlyList<DayChoiceDto> Choices,
    string Status,
    bool Editable,
    string? Comment,
    DateTimeOffset? SavedAt,
    DateTimeOffset Deadline,
    DateTimeOffset? SubmittedAt,
    int SubmissionCount,
    string? Validator,
    DecisionDto? Decision,
    IReadOnlyList<RecentWeekDto> Recent,
    IReadOnlyList<HistoryDto> History,
    // Dernière semaine saisie, dont les choix peuvent être repris jour par jour ; null s'il n'y a rien à reprendre.
    WeekRef? CopyFrom = null);

public sealed record DayInput(DateOnly Date, Guid? Key);

public sealed record SaveResult(DateTimeOffset? SavedAt, string Status);

/// <summary>Saisie hebdomadaire par jour (docs/design-v2.md) : lecture, brouillon, soumission.</summary>
public static class WeekEntry
{
    public sealed record Query(int Year, int Week) : IRequest<WeekDto>;

    /// <summary>Semaine courante sur l'horloge de l'application (lien « Saisie hebdomadaire »).</summary>
    public sealed record CurrentQuery : IRequest<WeekRef>;

    public sealed class CurrentHandler(IViewerAccessor viewers, TimeProvider clock) : IRequestHandler<CurrentQuery, WeekRef>
    {
        public async Task<WeekRef> Handle(CurrentQuery request, CancellationToken cancellationToken)
        {
            (await viewers.RequireAsync(cancellationToken)).Require(Permission.ENTER_TIME);
            var current = WeekRules.CurrentWeek(clock.GetUtcNow());
            return new WeekRef(current.Year, current.Week);
        }
    }

    /// <summary>Brouillon (sauvegarde automatique) ou soumission ; le serveur revérifie tout.</summary>
    public sealed record Command(int Year, int Week, IReadOnlyList<DayInput> Days, string? Comment, bool Submit) : IRequest<SaveResult>;

    public sealed class Handler(TimeSheetDbContext db, IViewerAccessor viewers, IEntryContext entry, IAuditWriter audit, TimeProvider clock) : IRequestHandler<Query, WeekDto>, IRequestHandler<Command, SaveResult>
    {
        public async Task<WeekDto> Handle(Query request, CancellationToken cancellationToken)
        {
            var scope = (await viewers.RequireAsync(cancellationToken)).Require(Permission.ENTER_TIME).Scope;
            var week = WeekRequest.Parse(request.Year, request.Week);
            // La semaine demandée et les quatre dernières (« Semaines récentes ») : cadres lus en une fois.
            var currentWeek = WeekRules.CurrentWeek(clock.GetUtcNow());
            var recentWeeks = Enumerable.Range(0, 4).Select(i => currentWeek.Shift(-i)).ToList();
            var frames = await entry.FramesAsync(scope, [week, .. recentWeeks], cancellationToken);
            var frame = frames[week];
            var sheet = await db.Timesheets.AsNoTracking().Include(t => t.Days).Include(t => t.Events)
                .FirstOrDefaultAsync(t => t.UserId == scope.UserId && t.WeekYear == week.Year && t.WeekNumber == week.Week, cancellationToken);
            var used = sheet?.Days.ToDictionary(d => d.Date) ?? [];

            // Historique, du plus récent au plus ancien ; la création du brouillon n'y figure pas.
            var events = sheet?.Events.Where(e => e.Type != "CREATED").OrderByDescending(e => e.At).ToList() ?? [];
            var actorIds = events.Select(e => e.ActorId).Distinct().ToList();
            var actors = await db.Users.AsNoTracking().Where(u => actorIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.FirstName + " " + u.LastName, cancellationToken);
            var history = events.Select(e => new HistoryDto(e.Type, actors.GetValueOrDefault(e.ActorId, ""), e.ActorId == scope.UserId, e.At)).ToList();
            var choices = (await entry.ChoicesAsync(scope, week, cancellationToken))
                .Where(c => !c.Closed || used.Values.Any(d => d.ActivityId == c.Key))
                .ToList();

            DecisionDto? decision = null;
            if (sheet?.DecidedById is { } deciderId && sheet.DecidedAt is { } decidedAt)
            {
                var by = await db.Users.AsNoTracking().Where(u => u.Id == deciderId).Select(u => u.FirstName + " " + u.LastName).FirstAsync(cancellationToken);
                decision = new DecisionDto(by, decidedAt, sheet.RejectionReason);
            }

            var oldestYear = recentWeeks[^1].Year;
            var recentSheets = await db.Timesheets.AsNoTracking()
                .Where(t => t.UserId == scope.UserId && t.WeekYear >= oldestYear)
                .Select(t => new { t.WeekYear, t.WeekNumber, t.Status })
                .ToListAsync(cancellationToken);
            var recent = new List<RecentWeekDto>();
            foreach (var w in recentWeeks)
            {
                var stored = recentSheets.FirstOrDefault(s => s.WeekYear == w.Year && s.WeekNumber == w.Week)?.Status;
                recent.Add(new RecentWeekDto(w.Year, w.Week, WeekRules.Display(stored, frames[w].Deadline, frame.Now).ToString()));
            }

            var editable = frame.IsOpen && (sheet is null || WeekRules.IsEditable(sheet.Status, frame.Settings.LockAfterValidation));

            // « Reprendre la semaine n » : la dernière semaine saisie avant celle-ci (quatre fiches
            // au plus sont regardées) dont un choix au moins est encore proposé, hors absence.
            IReadOnlyList<Guid?> previous = [];
            WeekRef? copyFrom = null;
            if (editable)
            {
                var copyable = choices.Where(c => !c.Closed && !c.Absence).Select(c => c.Key).ToHashSet();
                var earlier = await db.Timesheets.AsNoTracking().Include(t => t.Days)
                    .Where(t => t.UserId == scope.UserId && (t.WeekYear < week.Year || (t.WeekYear == week.Year && t.WeekNumber < week.Week)) && t.Days.Any())
                    .OrderByDescending(t => t.WeekYear).ThenByDescending(t => t.WeekNumber)
                    .Take(4)
                    .ToListAsync(cancellationToken);
                var days = frame.Days.Select(d => d.Date).ToList();
                foreach (var source in earlier)
                {
                    var copy = WeekRules.CopyFrom(days, source.Days.Select(d => (d.Date, d.ActivityId)), copyable);
                    if (copy.All(k => k is null)) continue;
                    previous = copy;
                    copyFrom = new WeekRef(source.WeekYear, source.WeekNumber);
                    break;
                }
            }
            Guid? PreviousOf(int index, FrameDay day) => day.Expected > 0 && index < previous.Count ? previous[index] : null;

            return new WeekDto(
                week.Year,
                week.Week,
                new WeekRef(frame.Current.Year, frame.Current.Week),
                frame.Settings.AllowFutureWeeks,
                frame.Days.Select((d, i) => new WeekDayDto(d.Date, d.Expected, d.Holiday, d.IsFuture, used.GetValueOrDefault(d.Date)?.ActivityId, used.GetValueOrDefault(d.Date)?.Flagged ?? false, PreviousOf(i, d))).ToList(),
                choices,
                WeekRules.Display(sheet?.Status, frame.Deadline, frame.Now).ToString(),
                editable,
                sheet?.Comment,
                sheet?.UpdatedAt,
                frame.Deadline,
                sheet?.SubmittedAt,
                sheet?.SubmissionCount ?? 0,
                await entry.ValidatorNameAsync(scope, cancellationToken),
                decision,
                recent,
                history,
                copyFrom);
        }

        public async Task<SaveResult> Handle(Command request, CancellationToken cancellationToken)
        {
            var viewer = (await viewers.RequireAsync(cancellationToken)).Require(Permission.ENTER_TIME);
            var scope = viewer.Scope;
            var week = WeekRequest.Parse(request.Year, request.Week);
            var frame = await entry.FrameAsync(scope, week, cancellationToken);
            if (!frame.IsOpen) throw new RuleException("futureWeek");
            if ((request.Comment?.Length ?? 0) > 2000) throw new RuleException("comment");

            var sheet = await db.Timesheets.Include(t => t.Days)
                .FirstOrDefaultAsync(t => t.UserId == scope.UserId && t.WeekYear == week.Year && t.WeekNumber == week.Week, cancellationToken);
            if (sheet is not null && !WeekRules.IsEditable(sheet.Status, frame.Settings.LockAfterValidation)) throw new RuleException("notEditable");

            // Jours : chaque date une seule fois, un jour ouvré non férié de la semaine.
            var expected = frame.Days.Where(d => d.Expected > 0).Select(d => d.Date).ToHashSet();
            var input = request.Days ?? [];
            if (input.Select(d => d.Date).Distinct().Count() != input.Count || input.Any(d => !expected.Contains(d.Date))) throw new RuleException("invalidDay");

            // Choix : ouvert à la personne, ou déjà enregistré ce jour-là (projet fermé depuis).
            var choices = await entry.ChoicesAsync(scope, week, cancellationToken);
            var open = choices.Where(c => !c.Closed).Select(c => c.Key).ToHashSet();
            var previous = sheet?.Days.ToDictionary(d => d.Date, d => d.ActivityId) ?? [];
            var days = new Dictionary<DateOnly, Guid>();
            foreach (var day in input.Where(d => d.Key is not null))
            {
                var key = day.Key!.Value;
                if (!open.Contains(key) && previous.GetValueOrDefault(day.Date) != key) throw new RuleException("invalidChoice");
                days[day.Date] = key;
            }

            // Rien saisi et pas encore de fiche : on ne crée rien.
            if (sheet is null && days.Count == 0 && string.IsNullOrWhiteSpace(request.Comment) && !request.Submit)
                return new SaveResult(null, WeekRules.Display(null, frame.Deadline, frame.Now).ToString());

            if (sheet is null)
            {
                sheet = Timesheet.Create(scope.DivisionId, scope.UserId, week, frame.Now);
                db.Timesheets.Add(sheet);
            }
            sheet.SaveDraft(days, request.Comment, frame.Now);

            if (request.Submit)
            {
                if (await entry.ValidatorNameAsync(scope, cancellationToken) is null) throw new RuleException("noValidator");
                if (!expected.All(days.ContainsKey)) throw new RuleException("incomplete");
                sheet.Submit(scope.UserId, frame.Now);
            }
            await db.SaveChangesAsync(cancellationToken);
            if (request.Submit)
                await audit.AppendAsync("TIMESHEET_SUBMITTED", viewer.FullName, $"Semaine {week.Week}", AuditResult.SUCCESS, viewer.UserId, scope.DivisionId, cancellationToken: cancellationToken);

            return new SaveResult(sheet.UpdatedAt, WeekRules.Display(sheet.Status, frame.Deadline, frame.Now).ToString());
        }
    }
}
