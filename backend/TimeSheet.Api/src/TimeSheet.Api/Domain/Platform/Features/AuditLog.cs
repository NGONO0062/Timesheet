namespace TimeSheet.Api.Domain.Platform.Features;

using System.Globalization;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Databases;
using TimeSheet.Api.Domain.Access;
using TimeSheet.Api.Domain.Reporting.Features;
using TimeSheet.Api.Domain.Timesheets;
using TimeSheet.Api.Exceptions;
using TimeSheet.Api.Services.Access;
using TimeSheet.Api.Services.Export;
using TimeSheet.Api.Services.Mail;

/// <summary>Ligne du journal. Échec de connexion : personne n'a prouvé son identité, l'acteur est inconnu (null).</summary>
public sealed record AuditRowDto(Guid Id, DateTimeOffset At, string? Actor, string? ActorRole, string? Division, string Action, string ActionLabel, string ObjectLabel, string Result);

public sealed record DivisionOptionDto(Guid Id, string Name);

/// <summary>Journal filtré : dates ré-affichées, erreurs de date (« date », « order »), page de 20 lignes.</summary>
public sealed record AuditPageDto(
    string From,
    string To,
    IReadOnlyDictionary<string, string> Errors,
    IReadOnlyList<AuditRowDto> Rows,
    int Total,
    int Page,
    int Count,
    int FromIndex,
    int ToIndex,
    IReadOnlyList<DivisionOptionDto> Divisions);

/// <summary>
/// Journal d'audit (PROMPT.md §9.10), en lecture seule pour l'admin plateforme : toutes les
/// divisions, filtres de la planche 13, exports CSV, Excel et PDF avec les mêmes filtres.
/// </summary>
public static class AuditLog
{
    private static IQueryable<Audit.AuditEntry> Where(TimeSheetDbContext db, AuditFilters f)
    {
        var q = db.AuditLog.AsNoTracking().Where(a => a.At >= f.From && a.At < f.To);
        if (f.DivisionId is { } d) q = q.Where(a => a.DivisionId == d);
        if (f.Category is { } c)
        {
            var actions = PlatformRules.Categories[c];
            q = q.Where(a => actions.Contains(a.Action));
        }
        if (f.Q.Length > 0)
        {
            var pattern = $"%{f.Q.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_")}%";
            q = q.Where(a => EF.Functions.ILike(a.ActorLabel, pattern) || EF.Functions.ILike(a.ObjectLabel, pattern));
        }
        return q.OrderByDescending(a => a.At).ThenByDescending(a => a.Id);
    }

    private static async Task<List<AuditRowDto>> RowsAsync(TimeSheetDbContext db, List<Audit.AuditEntry> entries, CancellationToken cancellationToken)
    {
        var actorIds = entries.Where(e => e.ActorId is not null).Select(e => e.ActorId!.Value).Distinct().ToList();
        var roles = await db.Users.AsNoTracking().Where(u => actorIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.Role, cancellationToken);
        var divisionIds = entries.Where(e => e.DivisionId is not null).Select(e => e.DivisionId!.Value).Distinct().ToList();
        var divisions = await db.Divisions.AsNoTracking().Where(d => divisionIds.Contains(d.Id)).ToDictionaryAsync(d => d.Id, d => d.Name, cancellationToken);
        return entries.Select(e =>
        {
            var unknown = e.Action == "LOGIN_FAILURE";
            var role = !unknown && e.ActorId is { } a && roles.TryGetValue(a, out var r) ? r.ToString() : null;
            return new AuditRowDto(e.Id, e.At, unknown ? null : e.ActorLabel, role, e.DivisionId is { } d ? divisions.GetValueOrDefault(d) : null,
                e.Action, PlatformRules.ActionLabel(e.Action), e.ObjectLabel, e.Result.ToString());
        }).ToList();
    }

    private static DateOnly Today(TimeProvider clock) => WeekRules.DoualaDay(clock.GetUtcNow());

    public sealed record Query(AuditParams Params) : IRequest<AuditPageDto>;

    public sealed class Handler(TimeSheetDbContext db, IViewerAccessor viewers, TimeProvider clock) : IRequestHandler<Query, AuditPageDto>
    {
        public async Task<AuditPageDto> Handle(Query request, CancellationToken cancellationToken)
        {
            (await viewers.RequireAsync(cancellationToken)).RequirePlatformAdmin();
            var (f, errors) = PlatformRules.ParseFilters(request.Params, Today(clock));
            var query = Where(db, f);
            var total = await query.CountAsync(cancellationToken);
            var count = Math.Max(1, (int)Math.Ceiling(total / (double)PlatformRules.AuditPageSize));
            var page = Math.Min(f.Page, count);
            var entries = await query.Skip((page - 1) * PlatformRules.AuditPageSize).Take(PlatformRules.AuditPageSize).ToListAsync(cancellationToken);
            var options = await db.Divisions.AsNoTracking().OrderBy(d => d.Name).Select(d => new DivisionOptionDto(d.Id, d.Name)).ToListAsync(cancellationToken);
            return new AuditPageDto(f.FromText, f.ToText, errors, await RowsAsync(db, entries, cancellationToken), total, page, count,
                total == 0 ? 0 : (page - 1) * PlatformRules.AuditPageSize + 1, Math.Min(total, page * PlatformRules.AuditPageSize), options);
        }
    }

    // ---------------------------------------------------------------------------------
    // Exports
    // ---------------------------------------------------------------------------------

    private static string RoleLabel(string? role) => role is null ? "" : ReportExport.RoleLabel(Enum.Parse<Role>(role));

    /// <summary>« 20 mars 2026, 17:48:02 », heure de Douala.</summary>
    public static string DateTime(DateTimeOffset at)
    {
        var local = at.ToUniversalTime() + WeekRules.DoualaOffset;
        return $"{FrenchFormat.Date(DateOnly.FromDateTime(local.DateTime))}, {local.ToString("HH:mm:ss", CultureInfo.InvariantCulture)}";
    }

    private static string ResultLabel(string result) => result == nameof(AuditResult.FAILURE) ? "Échec" : "Réussi";

    private static readonly string[] Head = ["Date et heure", "Acteur", "Rôle", "Division", "Action", "Objet", "Résultat"];

    private static string[] Cells(AuditRowDto r) =>
        [DateTime(r.At), r.Actor ?? "Compte non identifié", RoleLabel(r.ActorRole), r.Division ?? "—", r.ActionLabel, r.ObjectLabel, ResultLabel(r.Result)];

    public static List<IReadOnlyList<object?>> Table(IReadOnlyList<AuditRowDto> rows) =>
        [Head, .. rows.Select(r => (IReadOnlyList<object?>)Cells(r))];

    /// <summary>Document du PDF (A4 paysage), mis en page comme une proforma.</summary>
    public static string Html(IReadOnlyList<AuditRowDto> rows, string period, string issuedBy, string number, string date)
    {
        static string E(string s) => DocumentHtml.Escape(s);
        var body = string.Concat(rows.Select(r => "<tr>" + string.Concat(Cells(r).Select(c => $"<td>{E(c)}</td>")) + "</tr>"));
        var failures = rows.Count(r => r.Result == nameof(AuditResult.FAILURE));
        const string Style = "body{margin:0;font-family:\"Helvetica Neue\",Helvetica,Arial,sans-serif;font-size:10px;line-height:13px;color:#000000}.muted{color:#595959}"
                             + "table.detail{width:100%;margin-top:20px;border-collapse:collapse}.detail th,.detail td{padding:5px;border-bottom:2px solid #dddddd;text-align:left;vertical-align:top}"
                             + ".detail thead th{border-bottom:2px solid #000000;background:#fafafa}";
        return $"<!doctype html><html lang=\"fr\"><head><meta charset=\"utf-8\"><title>Journal d'audit</title><style>{Style}</style></head><body>"
               + DocumentHtml.Head([DocumentHtml.Issuer, "Administration de la plateforme"], "Journal d'audit", [("N°", number), ("Date", date), ("Période", period)], size: 10)
               + "<div style=\"margin-top:20px\">" + DocumentHtml.Parties([
                   ("Périmètre", $"<b>Administration de la plateforme</b><br><span class=\"muted\">{E(period)}</span>"),
                   ("Établi par", $"<b>{E(issuedBy)}</b>"),
               ]) + "</div>"
               + $"<table class=\"detail\"><thead><tr>{string.Concat(Head.Select(h => $"<th>{E(h)}</th>"))}</tr></thead><tbody>{body}</tbody></table>"
               + DocumentHtml.Summary([("Réussi", (rows.Count - failures).ToString(CultureInfo.InvariantCulture)), ("Échec", failures.ToString(CultureInfo.InvariantCulture)), ("Événements", rows.Count.ToString(CultureInfo.InvariantCulture))])
               + "</body></html>";
    }

    public sealed record ExportQuery(AuditParams Params, string Format) : IRequest<ExportFile>;

    /// <summary>Toutes les lignes filtrées, dans la limite de 10 000.</summary>
    public sealed class ExportHandler(TimeSheetDbContext db, IViewerAccessor viewers, TimeProvider clock, IPdfPrinter pdf) : IRequestHandler<ExportQuery, ExportFile>
    {
        public async Task<ExportFile> Handle(ExportQuery request, CancellationToken cancellationToken)
        {
            var viewer = (await viewers.RequireAsync(cancellationToken)).RequirePlatformAdmin();
            if (request.Format is not ("csv" or "xlsx" or "pdf")) throw new RuleException("format");
            var now = clock.GetUtcNow();
            var (f, _) = PlatformRules.ParseFilters(request.Params, Today(clock));
            var rows = await RowsAsync(db, await Where(db, f).Take(PlatformRules.ExportLimit).ToListAsync(cancellationToken), cancellationToken);
            var name = PlatformRules.FileName(f);
            switch (request.Format)
            {
                case "csv":
                    return new ExportFile(TableExport.Csv(Table(rows)), "text/csv; charset=utf-8", $"{name}.csv");
                case "xlsx":
                    return new ExportFile(TableExport.Xlsx("Journal d'audit", Table(rows)), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"{name}.xlsx");
                default:
                    var number = DocumentHtml.Number("JRN", now);
                    var html = Html(rows, $"Du {f.FromText} au {f.ToText}", $"{viewer.FullName} ({ReportExport.RoleLabel(viewer.Role)})", number, FrenchFormat.ShortDate(WeekRules.DoualaDay(now)));
                    return new ExportFile(await pdf.PrintAsync(html, landscape: true, footer: DocumentHtml.PdfFooter($"{DocumentHtml.Footer} · {number}")), "application/pdf", $"{name}.pdf");
            }
        }
    }
}
