namespace TimeSheet.Api.Domain.Reporting.Features;

using MediatR;
using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Databases;
using TimeSheet.Api.Domain.Access;
using TimeSheet.Api.Domain.Divisions;
using TimeSheet.Api.Domain.Timesheets;
using TimeSheet.Api.Domain.Timesheets.Features;
using TimeSheet.Api.Services.Access;
using TimeSheet.Api.Services.Export;

/// <summary>Semaine du rapport : capacité d'une personne (jours ouvrés hors fériés), semaine encore ouverte.</summary>
public sealed record ReportWeekDto(int Year, int Week, DateOnly Monday, int Capacity, bool Open);

public sealed record ReportEntityDto(string Key, string Label, string Sub, int Count, IReadOnlyList<int> ByWeek, int Total, int Series);

/// <summary>Écran 10 : les chiffres ; l'interface les met en forme, les exports aussi.</summary>
public sealed record ReportDto(
    WeekRef Current,
    string Axis,
    WeekRef From,
    WeekRef To,
    Guid? PersonId,
    bool Whole,
    IReadOnlyList<ReportPerson> People,
    IReadOnlyList<ReportWeekDto> Weeks,
    ReportKpis Kpis,
    IReadOnlyList<ReportSeries> Series,
    IReadOnlyList<ReportEntityDto> Entities);

public sealed record ExportFile(byte[] Content, string ContentType, string FileName);

/// <summary>
/// Reporting (PROMPT.md §9.5, repris de lib/data/reporting.ts et app/(app)/reporting). Périmètre :
/// les rattachés directs d'un manager ; toute la division pour owner et admin. Seules les
/// personnes qui saisissent leurs temps comptent. Une personne hors du périmètre est ignorée.
/// </summary>
public static class Report
{
    public sealed record Filters(string? Axis, string? From, string? To, Guid? PersonId);

    private static bool WholeDivision(DivisionScope scope) => scope.Role is Role.OWNER or Role.DIVISION_ADMIN;

    /// <summary>Calcule le rapport ; commun à l'écran et aux exports (mêmes filtres, mêmes chiffres).</summary>
    internal static async Task<ReportDto> LoadAsync(TimeSheetDbContext db, DivisionScope scope, DateTimeOffset now, Filters filters, CancellationToken cancellationToken)
    {
        var current = WeekRules.CurrentWeek(now);
        var axis = ReportRules.ParseAxis(filters.Axis);
        var (from, to) = ReportRules.Period(filters.From, filters.To, current);
        var weeks = ReportRules.WeeksBetween(from, to);

        // Personnes du périmètre qui saisissent leurs temps (permissions effectives de la division).
        var division = await db.Divisions.AsNoTracking().Include(d => d.Permissions).FirstAsync(d => d.Id == scope.DivisionId, cancellationToken);
        var users = db.Users.AsNoTracking().Where(u => u.DivisionId == scope.DivisionId && u.Active && u.Role != Role.PLATFORM_ADMIN);
        if (!WholeDivision(scope)) users = users.Where(u => u.ManagerId == scope.UserId);
        var people = (await (from u in users
                             join t in db.Teams on u.TeamId equals t.Id into teams
                             from t in teams.DefaultIfEmpty()
                             orderby u.FirstName, u.LastName
                             select new { u.Id, Name = u.FirstName + " " + u.LastName, u.Role, Team = t == null ? null : t.Name }).ToListAsync(cancellationToken))
            .Where(u => PermissionRules.Effective(u.Role, division.Overrides).Contains(Permission.ENTER_TIME))
            .Select(u => new ReportPerson(u.Id, u.Name, u.Team))
            .ToList();
        var personId = people.Any(p => p.Id == filters.PersonId) ? filters.PersonId : null;
        var ids = people.Select(p => p.Id).ToList();
        var keys = weeks.Select(w => w.Year * 100 + w.Week).ToList();

        var entries = (await (from d in db.TimesheetDays
                              join t in db.Timesheets on d.TimesheetId equals t.Id
                              join a in db.Activities on d.ActivityId equals a.Id
                              join p in db.Projects on a.ProjectId equals p.Id
                              where t.DivisionId == scope.DivisionId && ids.Contains(t.UserId) && keys.Contains(t.WeekYear * 100 + t.WeekNumber)
                              select new { t.WeekYear, t.WeekNumber, t.UserId, ProjectId = p.Id, p.Code, p.Name, Activity = a.Name }).ToListAsync(cancellationToken))
            .Select(e => new ReportEntry(new IsoWeek(e.WeekYear, e.WeekNumber), e.UserId, e.ProjectId, e.Code, e.Name, e.Activity))
            .ToList();
        var projectIds = entries.Select(e => e.ProjectId).Distinct().ToList();
        var members = await db.ProjectMembers.AsNoTracking().Where(m => projectIds.Contains(m.ProjectId)).GroupBy(m => m.ProjectId)
            .Select(g => new { g.Key, Count = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.Count, cancellationToken);

        var settings = await db.DivisionSettings.AsNoTracking().FirstOrDefaultAsync(s => s.DivisionId == scope.DivisionId, cancellationToken) ?? DivisionSettings.Defaults(scope.DivisionId);
        var holidays = (await db.Holidays.AsNoTracking().Where(h => h.DivisionId == scope.DivisionId).Select(h => h.Date).ToListAsync(cancellationToken)).ToHashSet();
        var capacity = weeks.Select(w => WeekRules.WorkingDays(w, settings.WorkingDays).Count(d => !holidays.Contains(d))).ToList();
        var stored = (await db.Timesheets.AsNoTracking()
                .Where(t => t.DivisionId == scope.DivisionId && ids.Contains(t.UserId) && keys.Contains(t.WeekYear * 100 + t.WeekNumber))
                .Select(t => new { t.UserId, t.WeekYear, t.WeekNumber, t.Status }).ToListAsync(cancellationToken))
            .ToDictionary(t => (t.UserId, new IsoWeek(t.WeekYear, t.WeekNumber)), t => t.Status);

        var selected = personId is { } only ? people.Where(p => p.Id == only).ToList() : people;
        var states = selected.SelectMany(p => weeks.Select(w => new SheetState(p.Id, w,
                WeekRules.Display(stored.TryGetValue((p.Id, w), out var s) ? s : null, WeekRules.Deadline(w, settings.DeadlineDay, settings.DeadlineTime), now))))
            .ToList();
        var shown = personId is { } one ? entries.Where(e => e.PersonId == one).ToList() : entries;

        // Couleurs attribuées sur toute l'équipe, pour qu'un filtre ne les change pas.
        var series = ReportRules.AssignSeries(ReportRules.Group(axis, entries, weeks, people, members));
        int SeriesOf(string key) => (series.FirstOrDefault(s => s.Keys.Contains(key)) ?? series[^1]).Index;
        var entities = ReportRules.Group(axis, shown, weeks, people, members)
            .Select(e => new ReportEntityDto(e.Key, e.Label, e.Sub, e.Count, e.ByWeek, e.Total, SeriesOf(e.Key)))
            .ToList();

        return new ReportDto(
            new WeekRef(current.Year, current.Week),
            axis.ToString(),
            new WeekRef(from.Year, from.Week),
            new WeekRef(to.Year, to.Week),
            personId,
            WholeDivision(scope),
            people,
            weeks.Select((w, i) => new ReportWeekDto(w.Year, w.Week, w.Monday, capacity[i], w >= current)).ToList(),
            ReportRules.Kpis(shown.Count, states, selected.Count, capacity),
            series,
            entities);
    }

    public sealed record Query(Filters Filters) : IRequest<ReportDto>;

    public sealed class Handler(TimeSheetDbContext db, IViewerAccessor viewers, TimeProvider clock) : IRequestHandler<Query, ReportDto>
    {
        public async Task<ReportDto> Handle(Query request, CancellationToken cancellationToken)
        {
            var scope = (await viewers.RequireAsync(cancellationToken)).Require(Permission.VIEW_REPORTING).Scope;
            return await LoadAsync(db, scope, clock.GetUtcNow(), request.Filters, cancellationToken);
        }
    }

    /// <summary>Export CSV, Excel ou PDF, avec les filtres de l'écran.</summary>
    public sealed record ExportQuery(Filters Filters, string Format) : IRequest<ExportFile>;

    public sealed class ExportHandler(TimeSheetDbContext db, IViewerAccessor viewers, TimeProvider clock, IPdfPrinter pdf) : IRequestHandler<ExportQuery, ExportFile>
    {
        public async Task<ExportFile> Handle(ExportQuery request, CancellationToken cancellationToken)
        {
            var viewer = (await viewers.RequireAsync(cancellationToken)).Require(Permission.VIEW_REPORTING);
            if (request.Format is not ("csv" or "xlsx" or "pdf")) throw new Exceptions.RuleException("format");
            var now = clock.GetUtcNow();
            var report = await LoadAsync(db, viewer.Scope, now, request.Filters, cancellationToken);
            var name = $"Reporting_{report.From.Year}-S{report.From.Week}_{report.To.Year}-S{report.To.Week}";
            switch (request.Format)
            {
                case "csv":
                    return new ExportFile(TableExport.Csv(ReportExport.Rows(report)), "text/csv; charset=utf-8", $"{name}.csv");
                case "xlsx":
                    return new ExportFile(TableExport.Xlsx("Reporting", ReportExport.Rows(report)), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"{name}.xlsx");
                default:
                    var number = DocumentHtml.Number("RPT", now);
                    var html = ReportExport.Html(report, new ReportExport.Meta(
                        ReportExport.ScopeLabel(report),
                        viewer.DivisionName ?? "",
                        $"{viewer.FullName} ({ReportExport.RoleLabel(viewer.Role)})",
                        number,
                        Services.Mail.FrenchFormat.ShortDate(WeekRules.DoualaDay(now))));
                    var bytes = await pdf.PrintAsync(html, landscape: report.Weeks.Count > 6, footer: DocumentHtml.PdfFooter($"{DocumentHtml.Footer} · {number}"));
                    return new ExportFile(bytes, "application/pdf", $"{name}.pdf");
            }
        }
    }
}
