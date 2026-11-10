namespace TimeSheet.Api.Domain.Attendance.Features;

using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Databases;
using TimeSheet.Api.Domain.Access;
using TimeSheet.Api.Domain.Divisions;
using TimeSheet.Api.Domain.Timesheets;
using TimeSheet.Api.Exceptions;
using TimeSheet.Api.Services;
using TimeSheet.Api.Services.Access;
using TimeSheet.Api.Services.Audit;
using TimeSheet.Api.Services.Export;
using TimeSheet.Api.Services.Mail;
using TimeSheet.Api.Services.Security;
using TimeSheet.Api.Services.Storage;

public sealed record SignatureDto(string Name, string Role, string Method, string? Drawing, DateTimeOffset SignedAt, string Sha256);

/// <summary>
/// Écran 06 (stagiaire ou superviseur) : la fiche, son document (le même HTML que le PDF), le
/// circuit, les signatures et l'envoi aux RH. <c>CanSign</c> : la signature attendue est celle
/// de la personne connectée.
/// </summary>
public sealed record AttendanceDto(
    Guid Id,
    int Year,
    int Month,
    string Status,
    DateTimeOffset GeneratedAt,
    string FileName,
    string Html,
    int UsedWeeks,
    string InternName,
    string Arrival,
    string Departure,
    string SupervisorName,
    SignatureDto? InternSignature,
    SignatureDto? SupervisorSignature,
    string? RejectionReason,
    DateTimeOffset? RejectedAt,
    DateTimeOffset? SentAt,
    string? SentTo,
    string? HrEmail,
    bool HrAutoSend,
    string Observation,
    bool CanSign);

/// <summary>Signature demandée : « DRAWN » (tracé) ou « PASSWORD » ; observation du superviseur, imprimée.</summary>
public sealed record SignInput(string? Method, string? Drawing, string? Password, string? Observation);

/// <summary>Poste de la signature (traçabilité).</summary>
public sealed record SignerContext(string? Ip, string? UserAgent);

public sealed record SignResult(string Status, string? Supervisor, string? SentTo, bool SendFailed);

public interface IAttendanceService : ITimeSheetApiScopedService
{
    Task GenerateIfReadyAsync(Guid divisionId, Guid userId, IsoWeek week, DateTimeOffset now, CancellationToken cancellationToken);
    IQueryable<AttendanceSheet> Supervised(DivisionScope scope);
    Task<AttendanceDto> DtoAsync(AttendanceSheet sheet, bool supervisorView, CancellationToken cancellationToken);
    Task<ExportFile?> PdfAsync(Viewer viewer, Guid id, CancellationToken cancellationToken);
    Task<SignResult> SignAsInternAsync(Viewer viewer, Guid id, SignInput input, SignerContext context, CancellationToken cancellationToken);
    Task<SignResult> SignAsSupervisorAsync(Viewer viewer, Guid id, SignInput input, SignerContext context, CancellationToken cancellationToken);
    Task<string> RejectAsync(Viewer viewer, Guid id, string? reason, CancellationToken cancellationToken);
    Task<string> SendToHrAsync(Viewer viewer, Guid id, CancellationToken cancellationToken);
}

/// <summary>
/// Fiche de présence RH (PROMPT.md §9.7, §9.8, reprise de lib/data/attendance.ts). Portée : le
/// stagiaire sur ses fiches ; son manager (toute la division pour l'owner) pour la contre-signature.
/// </summary>
public sealed class AttendanceService(
    TimeSheetDbContext db,
    IPdfPrinter pdf,
    IFileStore store,
    IMailSender mail,
    IAuditWriter audit,
    IConfiguration configuration,
    TimeProvider clock) : IAttendanceService
{
    /// <summary>Mode mot de passe : 5 échecs en 15 minutes (heure réelle) bloquent la signature par mot de passe.</summary>
    private const int PasswordAttempts = 5;
    private static readonly TimeSpan PasswordWindow = TimeSpan.FromMinutes(15);
    private const string FailureAction = "ATTENDANCE_SIGNATURE_FAILURE";

    private string AppUrl(string path) => $"{(configuration["APP_URL"] ?? "http://localhost:5173").TrimEnd('/')}{path}";

    private static string Sha256(byte[] bytes) => Convert.ToHexStringLower(SHA256.HashData(bytes));

    private static string StoredPath(AttendanceSheet s) => $"fiches-presence/{s.DivisionId}/{s.Id}.pdf";

    private static string Label(AttendanceSheet s, string name) => $"{AttendanceRules.MonthLabel(s.Year, s.Month)} · {name}";

    private static string MonthLower(AttendanceSheet s) => AttendanceRules.MonthLabel(s.Year, s.Month).ToLowerInvariant();

    // ------------------------------------------------------------------------------------
    // Génération (après chaque validation de fiche de temps)
    // ------------------------------------------------------------------------------------

    /// <summary>
    /// Génère la fiche de présence d'un stagiaire pour chaque mois touché par la semaine validée,
    /// si toutes les semaines du mois (dans la période de stage) sont validées. Idempotent.
    /// </summary>
    public async Task GenerateIfReadyAsync(Guid divisionId, Guid userId, IsoWeek week, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var internship = await db.Internships.AsNoTracking().FirstOrDefaultAsync(i => i.UserId == userId, cancellationToken);
        if (internship is null) return;
        var user = await db.Users.AsNoTracking().FirstAsync(u => u.Id == userId && u.DivisionId == divisionId, cancellationToken);
        foreach (var (year, month) in AttendanceRules.MonthsOfWeek(week))
        {
            if (await db.AttendanceSheets.AnyAsync(s => s.UserId == userId && s.Year == year && s.Month == month, cancellationToken)) continue;
            var weeks = AttendanceRules.WeeksOfMonth(year, month, internship.StartDate, internship.EndDate);
            if (weeks.Count == 0) continue;
            var keys = weeks.Select(w => w.Year * 100 + w.Week).ToList();
            var validated = await db.Timesheets.CountAsync(t => t.DivisionId == divisionId && t.UserId == userId && t.Status == TimesheetStatus.VALIDATED && keys.Contains(t.WeekYear * 100 + t.WeekNumber), cancellationToken);
            if (validated < weeks.Count) continue;

            var sheet = AttendanceSheet.Generate(divisionId, userId, year, month, now);
            db.AttendanceSheets.Add(sheet);
            await db.SaveChangesAsync(cancellationToken);
            await audit.AppendAsync("ATTENDANCE_GENERATED", "TimeSheet", Label(sheet, user.FullName), AuditResult.SUCCESS, divisionId: divisionId, metadata: new { sheetId = sheet.Id }, cancellationToken: cancellationToken);
            await mail.SendAsync(MailTemplates.AttendanceToSign(user.Email, user.FirstName, MonthLower(sheet), AppUrl($"/fiche-presence/{year}/{month}")), cancellationToken);
        }
    }

    // ------------------------------------------------------------------------------------
    // Contenu, PDF
    // ------------------------------------------------------------------------------------

    public IQueryable<AttendanceSheet> Supervised(DivisionScope scope)
    {
        var sheets = db.AttendanceSheets.Where(s => s.DivisionId == scope.DivisionId && s.UserId != scope.UserId);
        if (scope.Role == Role.OWNER) return sheets;
        var team = db.Users.Where(u => u.DivisionId == scope.DivisionId && u.ManagerId == scope.UserId).Select(u => u.Id);
        return sheets.Where(s => team.Contains(s.UserId));
    }

    private sealed record Parts(SheetModel Model, SheetMeta Meta, string FileName, string InternName, string Arrival, string Departure, Guid? ManagerId);

    private async Task<Parts> PartsAsync(AttendanceSheet sheet, string? observation, CancellationToken cancellationToken)
    {
        var user = await db.Users.AsNoTracking().FirstAsync(u => u.Id == sheet.UserId, cancellationToken);
        var internship = await db.Internships.AsNoTracking().FirstOrDefaultAsync(i => i.UserId == sheet.UserId, cancellationToken)
                         ?? throw new NotFoundException("Fiche de présence sans stage.");
        var division = await db.Divisions.AsNoTracking().Where(d => d.Id == sheet.DivisionId).Select(d => d.Name).FirstAsync(cancellationToken);
        var monthStart = new DateOnly(sheet.Year, sheet.Month, 1);
        var monthEnd = monthStart.AddMonths(1);
        var days = await (from d in db.TimesheetDays
                          join t in db.Timesheets on d.TimesheetId equals t.Id
                          join a in db.Activities on d.ActivityId equals a.Id
                          join p in db.Projects on a.ProjectId equals p.Id
                          where t.DivisionId == sheet.DivisionId && t.UserId == sheet.UserId && t.Status == TimesheetStatus.VALIDATED && d.Date >= monthStart && d.Date < monthEnd
                          select new DayEntry(d.Date, p.IsSystem)).ToListAsync(cancellationToken);
        var model = AttendanceRules.Build(sheet.Year, sheet.Month, user.FirstName, user.LastName, internship, user.UsualArrival, user.UsualDeparture, days, observation);
        var meta = new SheetMeta(division, AttendanceRules.Number(sheet.Year, sheet.Month, user.LastName),
            FrenchFormat.ShortDate(WeekRules.DoualaDay(sheet.GeneratedAt)), MonthLower(sheet));
        return new Parts(model, meta, AttendanceRules.FileName(sheet.Year, sheet.Month, user.LastName), user.FullName, user.UsualArrival, user.UsualDeparture, user.ManagerId);
    }

    private async Task<PrintedSignature?> PrintedAsync(Signature? s, CancellationToken cancellationToken)
    {
        if (s is null) return null;
        var name = await db.Users.AsNoTracking().Where(u => u.Id == s.SignerId).Select(u => u.FirstName + " " + u.LastName).FirstAsync(cancellationToken);
        return new PrintedSignature(name, s.Method == SignatureMethod.DRAWN ? s.Drawing : null, $"signé le {FrenchFormat.Date(WeekRules.DoualaDay(s.SignedAt))}");
    }

    private Task<byte[]> RenderAsync(Parts parts, PrintedSignature? signature) =>
        pdf.PrintAsync(SheetHtml.Document(parts.Model, parts.Meta, signature, parts.FileName), landscape: true, fullBleed: true);

    private async Task<SignatureDto?> SignatureDtoAsync(Signature? s, CancellationToken cancellationToken)
    {
        if (s is null) return null;
        var name = await db.Users.AsNoTracking().Where(u => u.Id == s.SignerId).Select(u => u.FirstName + " " + u.LastName).FirstAsync(cancellationToken);
        return new SignatureDto(name, s.SignerRole.ToString(), s.Method.ToString(), s.Drawing, s.SignedAt, s.DocumentSha256);
    }

    public async Task<AttendanceDto> DtoAsync(AttendanceSheet sheet, bool supervisorView, CancellationToken cancellationToken)
    {
        var parts = await PartsAsync(sheet, sheet.Observation, cancellationToken);
        var settings = await db.DivisionSettings.AsNoTracking().FirstOrDefaultAsync(s => s.DivisionId == sheet.DivisionId, cancellationToken) ?? DivisionSettings.Defaults(sheet.DivisionId);
        var supervisor = parts.ManagerId is { } m ? await db.Users.AsNoTracking().Where(u => u.Id == m).Select(u => u.FirstName + " " + u.LastName).FirstOrDefaultAsync(cancellationToken) : null;
        var html = SheetHtml.Document(parts.Model, parts.Meta, await PrintedAsync(sheet.SupervisorSignature, cancellationToken), parts.FileName);
        return new AttendanceDto(
            sheet.Id, sheet.Year, sheet.Month, sheet.Status.ToString(), sheet.GeneratedAt, parts.FileName, html,
            parts.Model.Blocks.Count(b => b.Used), parts.InternName, parts.Arrival, parts.Departure,
            supervisor ?? "",
            await SignatureDtoAsync(sheet.InternSignature, cancellationToken),
            await SignatureDtoAsync(sheet.SupervisorSignature, cancellationToken),
            sheet.RejectionReason, sheet.RejectedAt, sheet.SentAt, sheet.SentTo, settings.HrEmail, settings.HrAutoSend, sheet.Observation ?? "",
            supervisorView ? sheet.Status == AttendanceStatus.SIGNED_BY_INTERN : sheet.Status == AttendanceStatus.GENERATED);
    }

    /// <summary>PDF pour le téléchargement : le stagiaire, ou son superviseur. Le PDF signé stocké s'il existe.</summary>
    public async Task<ExportFile?> PdfAsync(Viewer viewer, Guid id, CancellationToken cancellationToken)
    {
        var scope = viewer.Scope;
        var sheet = await db.AttendanceSheets.AsNoTracking().Include(s => s.Signatures).FirstOrDefaultAsync(s => s.Id == id && s.DivisionId == scope.DivisionId && s.UserId == scope.UserId, cancellationToken);
        if (sheet is null && viewer.Has(Permission.VALIDATE_TEAM))
            sheet = await Supervised(scope).AsNoTracking().Include(s => s.Signatures).FirstOrDefaultAsync(s => s.Id == id, cancellationToken);
        if (sheet is null) return null;
        var parts = await PartsAsync(sheet, sheet.Observation, cancellationToken);
        var bytes = sheet.PdfPath is { } path ? await store.ReadAsync(path, cancellationToken) : null;
        bytes ??= await RenderAsync(parts, await PrintedAsync(sheet.SupervisorSignature, cancellationToken));
        return new ExportFile(bytes, "application/pdf", parts.FileName);
    }

    // ------------------------------------------------------------------------------------
    // Signatures, renvoi, envoi
    // ------------------------------------------------------------------------------------

    private static SignatureMethod ParseMethod(string? method) => method switch
    {
        "DRAWN" => SignatureMethod.DRAWN,
        "PASSWORD" => SignatureMethod.PASSWORD,
        _ => throw new RuleException("method"),
    };

    /// <summary>Tracé valide, ou mot de passe vérifié de nouveau côté serveur avec limitation des tentatives.</summary>
    private async Task<SignatureMethod> CheckSignerAsync(Viewer viewer, SignInput input, string label, SignerContext context, CancellationToken cancellationToken)
    {
        var method = ParseMethod(input.Method);
        if (method == SignatureMethod.DRAWN)
        {
            if (!AttendanceRules.IsDrawing(input.Drawing)) throw new RuleException("drawing");
            return method;
        }
        // Fenêtre de sécurité en heure réelle : l'horloge de démonstration repart à chaque démarrage.
        var since = TimeProvider.System.GetUtcNow() - PasswordWindow;
        var failures = await db.AuditLog.CountAsync(a => a.Action == FailureAction && a.ActorId == viewer.UserId && a.RecordedAt >= since, cancellationToken);
        if (failures >= PasswordAttempts) throw new RuleException("throttled");
        var hash = await db.Users.AsNoTracking().Where(u => u.Id == viewer.UserId).Select(u => u.PasswordHash).FirstAsync(cancellationToken);
        if (string.IsNullOrEmpty(input.Password) || hash is null || !PasswordHasher.Verify(input.Password, hash))
        {
            await audit.AppendAsync(FailureAction, viewer.FullName, label, AuditResult.FAILURE, viewer.UserId, viewer.Scope.DivisionId, new { ip = context.Ip }, cancellationToken);
            throw new RuleException(failures + 1 >= PasswordAttempts ? "throttled" : "wrongPassword");
        }
        return method;
    }

    /// <summary>Signature du stagiaire : certifie la fiche, n'est pas imprimée (§9.7). Le superviseur est prévenu.</summary>
    public async Task<SignResult> SignAsInternAsync(Viewer viewer, Guid id, SignInput input, SignerContext context, CancellationToken cancellationToken)
    {
        var scope = viewer.Require(Permission.ENTER_TIME).Scope;
        var sheet = await db.AttendanceSheets.Include(s => s.Signatures).FirstOrDefaultAsync(s => s.Id == id && s.DivisionId == scope.DivisionId && s.UserId == scope.UserId, cancellationToken)
                    ?? throw new NotFoundException("Fiche introuvable.");
        if (sheet.Status != AttendanceStatus.GENERATED) throw new RuleException("stale");
        var parts = await PartsAsync(sheet, sheet.Observation, cancellationToken);
        var label = Label(sheet, parts.InternName);
        var method = await CheckSignerAsync(viewer, input, label, context, cancellationToken);

        var digest = Sha256(await RenderAsync(parts, null));
        sheet.SignAsIntern(viewer.UserId, method, method == SignatureMethod.DRAWN ? input.Drawing!.Trim() : null, digest, clock.GetUtcNow(), context.Ip, context.UserAgent);
        await db.SaveChangesAsync(cancellationToken);
        await audit.AppendAsync("ATTENDANCE_SIGNED", viewer.FullName, label, AuditResult.SUCCESS, viewer.UserId, scope.DivisionId, new { role = "STAFF", method = method.ToString(), sha256 = digest }, cancellationToken);

        var manager = parts.ManagerId is { } m ? await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == m && u.Active, cancellationToken) : null;
        if (manager is not null)
            await mail.SendAsync(MailTemplates.AttendanceSupervisor(manager.Email, manager.FirstName, parts.InternName, MonthLower(sheet), AppUrl($"/validation/presence/{sheet.Id}")), cancellationToken);
        return new SignResult(sheet.Status.ToString(), manager?.FullName, null, false);
    }

    /// <summary>Signature du superviseur : imprimée sur le PDF, stocké avec son empreinte, puis envoi aux RH si le réglage le prévoit.</summary>
    public async Task<SignResult> SignAsSupervisorAsync(Viewer viewer, Guid id, SignInput input, SignerContext context, CancellationToken cancellationToken)
    {
        var scope = viewer.Require(Permission.VALIDATE_TEAM).Scope;
        var sheet = await Supervised(scope).Include(s => s.Signatures).FirstOrDefaultAsync(s => s.Id == id, cancellationToken)
                    ?? throw new NotFoundException("Fiche introuvable.");
        if (sheet.Status != AttendanceStatus.SIGNED_BY_INTERN) throw new RuleException("stale");
        var observation = input.Observation?.Trim() is { Length: > 0 } o ? (o.Length > 500 ? o[..500] : o) : null;
        var parts = await PartsAsync(sheet, observation, cancellationToken);
        var label = Label(sheet, parts.InternName);
        var method = await CheckSignerAsync(viewer, input, label, context, cancellationToken);

        var now = clock.GetUtcNow();
        var drawing = method == SignatureMethod.DRAWN ? input.Drawing!.Trim() : null;
        var bytes = await RenderAsync(parts, new PrintedSignature(viewer.FullName, drawing, $"signé le {FrenchFormat.Date(WeekRules.DoualaDay(now))}"));
        var digest = Sha256(bytes);
        var path = StoredPath(sheet);
        await store.WriteAsync(path, bytes, cancellationToken);
        sheet.SignAsSupervisor(viewer.UserId, viewer.Role, method, drawing, observation, path, digest, now, context.Ip, context.UserAgent);
        await db.SaveChangesAsync(cancellationToken);
        await audit.AppendAsync("ATTENDANCE_SIGNED", viewer.FullName, label, AuditResult.SUCCESS, viewer.UserId, scope.DivisionId, new { role = viewer.Role.ToString(), method = method.ToString(), sha256 = digest }, cancellationToken);

        var settings = await db.DivisionSettings.AsNoTracking().FirstOrDefaultAsync(s => s.DivisionId == scope.DivisionId, cancellationToken);
        if (settings is { HrAutoSend: true, HrEmail.Length: > 0 })
        {
            try
            {
                var to = await DeliverAsync(viewer, sheet, cancellationToken);
                return new SignResult(sheet.Status.ToString(), null, to, false);
            }
            catch (RuleException)
            {
                return new SignResult(sheet.Status.ToString(), null, null, true);
            }
        }
        return new SignResult(sheet.Status.ToString(), null, null, false);
    }

    /// <summary>Renvoi au stagiaire avec un motif : sa signature est annulée (jamais supprimée).</summary>
    public async Task<string> RejectAsync(Viewer viewer, Guid id, string? reason, CancellationToken cancellationToken)
    {
        var scope = viewer.Require(Permission.VALIDATE_TEAM).Scope;
        var motif = reason?.Trim() ?? "";
        if (motif.Length == 0) throw new RuleException("reason");
        if (motif.Length > 500) motif = motif[..500];
        var sheet = await Supervised(scope).Include(s => s.Signatures).FirstOrDefaultAsync(s => s.Id == id, cancellationToken)
                    ?? throw new NotFoundException("Fiche introuvable.");
        if (sheet.Status != AttendanceStatus.SIGNED_BY_INTERN) throw new RuleException("stale");
        var intern = await db.Users.AsNoTracking().FirstAsync(u => u.Id == sheet.UserId, cancellationToken);
        sheet.Reject(motif, clock.GetUtcNow());
        await db.SaveChangesAsync(cancellationToken);
        await audit.AppendAsync("ATTENDANCE_REJECTED", viewer.FullName, Label(sheet, intern.FullName), AuditResult.SUCCESS, viewer.UserId, scope.DivisionId, new { reason = motif }, cancellationToken);
        await mail.SendAsync(MailTemplates.AttendanceRejected(intern.Email, intern.FirstName, viewer.FullName, MonthLower(sheet), motif, AppUrl($"/fiche-presence/{sheet.Year}/{sheet.Month}")), cancellationToken);
        return intern.FullName;
    }

    /// <summary>Envoi manuel aux RH (envoi automatique désactivé, ou nouvel essai).</summary>
    public async Task<string> SendToHrAsync(Viewer viewer, Guid id, CancellationToken cancellationToken)
    {
        var scope = viewer.Require(Permission.VALIDATE_TEAM).Scope;
        var sheet = await Supervised(scope).Include(s => s.Signatures).FirstOrDefaultAsync(s => s.Id == id, cancellationToken)
                    ?? throw new NotFoundException("Fiche introuvable.");
        return await DeliverAsync(viewer, sheet, cancellationToken);
    }

    private async Task<string> DeliverAsync(Viewer viewer, AttendanceSheet sheet, CancellationToken cancellationToken)
    {
        if (sheet.Status != AttendanceStatus.SIGNED_BY_SUPERVISOR) throw new RuleException("stale");
        var to = (await db.DivisionSettings.AsNoTracking().Where(s => s.DivisionId == sheet.DivisionId).Select(s => s.HrEmail).FirstOrDefaultAsync(cancellationToken))?.Trim();
        if (string.IsNullOrEmpty(to)) throw new RuleException("hrEmail");
        var bytes = sheet.PdfPath is { } path ? await store.ReadAsync(path, cancellationToken) : null;
        if (bytes is null) throw new RuleException("sendFailed");
        var parts = await PartsAsync(sheet, sheet.Observation, cancellationToken);
        var supervisor = await PrintedAsync(sheet.SupervisorSignature, cancellationToken);
        var ok = await mail.SendAsync(MailTemplates.AttendanceHr(to, parts.InternName, MonthLower(sheet), supervisor?.Name ?? "", parts.FileName, bytes), cancellationToken);
        await audit.AppendAsync("ATTENDANCE_SENT", viewer.FullName, Label(sheet, parts.InternName), ok ? AuditResult.SUCCESS : AuditResult.FAILURE, viewer.UserId, sheet.DivisionId, new { to }, cancellationToken);
        if (!ok) throw new RuleException("sendFailed");
        sheet.MarkSent(to, clock.GetUtcNow());
        await db.SaveChangesAsync(cancellationToken);
        return to;
    }
}
