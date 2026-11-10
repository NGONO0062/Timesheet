namespace TimeSheet.Api.Domain.Attendance.Features;

using MediatR;
using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Databases;
using TimeSheet.Api.Domain.Access;
using TimeSheet.Api.Exceptions;
using TimeSheet.Api.Services.Access;
using TimeSheet.Api.Services.Export;

public sealed record MonthDto(int Year, int Month, string Status);

/// <summary>Fiche à contre-signer, ou signée dont l'envoi aux RH attend.</summary>
public sealed record SupervisedRowDto(Guid Id, string Name, int Year, int Month, string Status, DateTimeOffset? InternSignedAt);

/// <summary>File du superviseur : <c>Interns</c> = 0 quand il ne supervise aucun stagiaire (pas d'onglet).</summary>
public sealed record SupervisedListDto(int Interns, int ToSign, IReadOnlyList<SupervisedRowDto> Rows);

/// <summary>Fiche de présence (écran 06) : stagiaire et superviseur. Le travail est fait par <see cref="IAttendanceService"/>.</summary>
public static class AttendanceFeatures
{
    public sealed record MyMonthsQuery : IRequest<IReadOnlyList<MonthDto>>;

    public sealed class MyMonthsHandler(TimeSheetDbContext db, IViewerAccessor viewers) : IRequestHandler<MyMonthsQuery, IReadOnlyList<MonthDto>>
    {
        public async Task<IReadOnlyList<MonthDto>> Handle(MyMonthsQuery request, CancellationToken cancellationToken)
        {
            var scope = (await viewers.RequireAsync(cancellationToken)).Require(Permission.ENTER_TIME).Scope;
            return (await db.AttendanceSheets.AsNoTracking()
                    .Where(s => s.DivisionId == scope.DivisionId && s.UserId == scope.UserId)
                    .OrderByDescending(s => s.Year).ThenByDescending(s => s.Month)
                    .ToListAsync(cancellationToken))
                .Select(s => new MonthDto(s.Year, s.Month, s.Status.ToString())).ToList();
        }
    }

    public sealed record MySheetQuery(int Year, int Month) : IRequest<AttendanceDto>;

    public sealed class MySheetHandler(TimeSheetDbContext db, IViewerAccessor viewers, IAttendanceService service) : IRequestHandler<MySheetQuery, AttendanceDto>
    {
        public async Task<AttendanceDto> Handle(MySheetQuery request, CancellationToken cancellationToken)
        {
            var scope = (await viewers.RequireAsync(cancellationToken)).Require(Permission.ENTER_TIME).Scope;
            var sheet = await db.AttendanceSheets.AsNoTracking().Include(s => s.Signatures)
                            .FirstOrDefaultAsync(s => s.DivisionId == scope.DivisionId && s.UserId == scope.UserId && s.Year == request.Year && s.Month == request.Month, cancellationToken)
                        ?? throw new NotFoundException("Pas de fiche pour ce mois.");
            return await service.DtoAsync(sheet, supervisorView: false, cancellationToken);
        }
    }

    public sealed record SupervisedListQuery : IRequest<SupervisedListDto>;

    public sealed class SupervisedListHandler(TimeSheetDbContext db, IViewerAccessor viewers, IAttendanceService service) : IRequestHandler<SupervisedListQuery, SupervisedListDto>
    {
        public async Task<SupervisedListDto> Handle(SupervisedListQuery request, CancellationToken cancellationToken)
        {
            var scope = (await viewers.RequireAsync(cancellationToken)).Require(Permission.VALIDATE_TEAM).Scope;
            var people = db.Users.Where(u => u.DivisionId == scope.DivisionId && u.Id != scope.UserId);
            if (scope.Role != Role.OWNER) people = people.Where(u => u.ManagerId == scope.UserId);
            var ids = people.Select(u => u.Id);
            var interns = await db.Internships.CountAsync(i => ids.Contains(i.UserId), cancellationToken);
            var sheets = await service.Supervised(scope).AsNoTracking().Include(s => s.Signatures)
                .Where(s => s.Status == AttendanceStatus.SIGNED_BY_INTERN || s.Status == AttendanceStatus.SIGNED_BY_SUPERVISOR)
                .OrderBy(s => s.Year).ThenBy(s => s.Month)
                .ToListAsync(cancellationToken);
            var userIds = sheets.Select(s => s.UserId).Distinct().ToList();
            var names = await db.Users.AsNoTracking().Where(u => userIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.FirstName + " " + u.LastName, cancellationToken);
            var rows = sheets.Select(s => new SupervisedRowDto(s.Id, names[s.UserId], s.Year, s.Month, s.Status.ToString(), s.InternSignature?.SignedAt)).ToList();
            return new SupervisedListDto(interns, rows.Count(r => r.Status == nameof(AttendanceStatus.SIGNED_BY_INTERN)), rows);
        }
    }

    public sealed record SupervisedSheetQuery(Guid Id) : IRequest<AttendanceDto>;

    public sealed class SupervisedSheetHandler(IViewerAccessor viewers, IAttendanceService service) : IRequestHandler<SupervisedSheetQuery, AttendanceDto>
    {
        public async Task<AttendanceDto> Handle(SupervisedSheetQuery request, CancellationToken cancellationToken)
        {
            var scope = (await viewers.RequireAsync(cancellationToken)).Require(Permission.VALIDATE_TEAM).Scope;
            // Une fiche pas encore signée par le stagiaire n'existe pas pour le superviseur.
            var sheet = await service.Supervised(scope).AsNoTracking().Include(s => s.Signatures)
                            .FirstOrDefaultAsync(s => s.Id == request.Id && s.Status != AttendanceStatus.GENERATED, cancellationToken)
                        ?? throw new NotFoundException("Fiche introuvable.");
            return await service.DtoAsync(sheet, supervisorView: true, cancellationToken);
        }
    }

    public sealed record PdfQuery(Guid Id) : IRequest<ExportFile>;

    public sealed class PdfHandler(IViewerAccessor viewers, IAttendanceService service) : IRequestHandler<PdfQuery, ExportFile>
    {
        public async Task<ExportFile> Handle(PdfQuery request, CancellationToken cancellationToken) =>
            await service.PdfAsync(await viewers.RequireAsync(cancellationToken), request.Id, cancellationToken) ?? throw new NotFoundException("Fiche introuvable.");
    }

    /// <summary>Signature : du stagiaire (<c>Supervisor</c> faux) ou du superviseur.</summary>
    public sealed record SignCommand(Guid Id, SignInput Input, SignerContext Context, bool Supervisor) : IRequest<SignResult>;

    public sealed class SignHandler(IViewerAccessor viewers, IAttendanceService service) : IRequestHandler<SignCommand, SignResult>
    {
        public async Task<SignResult> Handle(SignCommand request, CancellationToken cancellationToken)
        {
            var viewer = await viewers.RequireAsync(cancellationToken);
            return request.Supervisor
                ? await service.SignAsSupervisorAsync(viewer, request.Id, request.Input, request.Context, cancellationToken)
                : await service.SignAsInternAsync(viewer, request.Id, request.Input, request.Context, cancellationToken);
        }
    }

    public sealed record RejectCommand(Guid Id, string? Reason) : IRequest<string>;

    public sealed class RejectHandler(IViewerAccessor viewers, IAttendanceService service) : IRequestHandler<RejectCommand, string>
    {
        public async Task<string> Handle(RejectCommand request, CancellationToken cancellationToken) =>
            await service.RejectAsync(await viewers.RequireAsync(cancellationToken), request.Id, request.Reason, cancellationToken);
    }

    public sealed record SendCommand(Guid Id) : IRequest<string>;

    public sealed class SendHandler(IViewerAccessor viewers, IAttendanceService service) : IRequestHandler<SendCommand, string>
    {
        public async Task<string> Handle(SendCommand request, CancellationToken cancellationToken) =>
            await service.SendToHrAsync(await viewers.RequireAsync(cancellationToken), request.Id, cancellationToken);
    }
}
