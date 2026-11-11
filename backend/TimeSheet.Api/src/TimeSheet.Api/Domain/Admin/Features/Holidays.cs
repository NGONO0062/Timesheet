namespace TimeSheet.Api.Domain.Admin.Features;

using MediatR;
using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Databases;
using TimeSheet.Api.Domain.Access;
using TimeSheet.Api.Domain.Divisions;
using TimeSheet.Api.Domain.Timesheets;
using TimeSheet.Api.Exceptions;
using TimeSheet.Api.Services.Access;
using TimeSheet.Api.Services.Audit;
using TimeSheet.Api.Services.Mail;

public sealed record HolidayRow(Guid Id, DateOnly Date, string Label);

/// <summary>Jours fériés de la division, par date ; <c>Years</c> : années proposées à l'écran.</summary>
public sealed record HolidaysDto(int CurrentYear, IReadOnlyList<int> Years, IReadOnlyList<HolidayRow> Rows);

/// <summary>Jour férié ajouté. <c>EnteredDays</c> : journées déjà saisies ce jour-là dans la division.</summary>
public sealed record HolidayAdded(Guid Id, DateOnly Date, string Label, int EnteredDays);

/// <summary>
/// Jours fériés de la division (écran 12). Un jour férié n'attend aucune saisie : il sort des
/// jours à saisir de sa semaine (<c>IEntryContext</c>), des taux de remplissage et des relances.
/// Permission « Gérer les utilisateurs, workflows et règles ».
/// </summary>
public static class Holidays
{
    private static string Label(DateOnly date, string label) => $"{FrenchFormat.Date(date)} · {label}";

    public sealed record Query : IRequest<HolidaysDto>;

    public sealed class Handler(TimeSheetDbContext db, IViewerAccessor viewers, TimeProvider clock) : IRequestHandler<Query, HolidaysDto>
    {
        public async Task<HolidaysDto> Handle(Query request, CancellationToken cancellationToken)
        {
            var scope = (await viewers.RequireAsync(cancellationToken)).Require(Permission.ADMINISTER_DIVISION).Scope;
            var rows = await db.Holidays.AsNoTracking()
                .Where(h => h.DivisionId == scope.DivisionId)
                .OrderBy(h => h.Date)
                .Select(h => new HolidayRow(h.Id, h.Date, h.Label))
                .ToListAsync(cancellationToken);
            var currentYear = WeekRules.DoualaDay(clock.GetUtcNow()).Year;
            return new HolidaysDto(currentYear, HolidayRules.Years(rows.Select(r => r.Date), currentYear), rows);
        }
    }

    public sealed record AddCommand(HolidayInput Input) : IRequest<HolidayAdded>;

    public sealed class AddHandler(TimeSheetDbContext db, IViewerAccessor viewers, IAuditWriter audit) : IRequestHandler<AddCommand, HolidayAdded>
    {
        public async Task<HolidayAdded> Handle(AddCommand request, CancellationToken cancellationToken)
        {
            var viewer = (await viewers.RequireAsync(cancellationToken)).Require(Permission.ADMINISTER_DIVISION);
            var divisionId = viewer.Scope.DivisionId;
            var fields = HolidayRules.Check(request.Input);
            if (fields.Count > 0) throw new RuleException("invalid", fields);
            var date = HolidayRules.ParseDate(request.Input.Date)!.Value;
            var label = HolidayRules.CleanLabel(request.Input.Label)!;
            // Un seul jour férié par date dans la division.
            if (await db.Holidays.AnyAsync(h => h.DivisionId == divisionId && h.Date == date, cancellationToken)) throw new RuleException("invalid", ["holidayTaken"]);

            var holiday = Holiday.Create(divisionId, date, label);
            db.Holidays.Add(holiday);
            await db.SaveChangesAsync(cancellationToken);
            // Les journées déjà saisies ce jour-là ne sont pas touchées : l'administrateur en est prévenu.
            var entered = await db.Timesheets.AsNoTracking().Where(t => t.DivisionId == divisionId).SelectMany(t => t.Days).CountAsync(d => d.Date == date, cancellationToken);
            await audit.AppendAsync("HOLIDAY_ADDED", viewer.FullName, Label(date, label), AuditResult.SUCCESS, viewer.UserId, divisionId,
                new { date = AdminRules.FormatFrDate(date), label, enteredDays = entered }, cancellationToken);
            return new HolidayAdded(holiday.Id, date, label, entered);
        }
    }

    public sealed record RemoveCommand(Guid Id) : IRequest<HolidayRow>;

    public sealed class RemoveHandler(TimeSheetDbContext db, IViewerAccessor viewers, IAuditWriter audit) : IRequestHandler<RemoveCommand, HolidayRow>
    {
        public async Task<HolidayRow> Handle(RemoveCommand request, CancellationToken cancellationToken)
        {
            var viewer = (await viewers.RequireAsync(cancellationToken)).Require(Permission.ADMINISTER_DIVISION);
            var divisionId = viewer.Scope.DivisionId;
            var holiday = await db.Holidays.FirstOrDefaultAsync(h => h.Id == request.Id && h.DivisionId == divisionId, cancellationToken) ?? throw new RuleException("holidayNotFound");
            db.Holidays.Remove(holiday);
            await db.SaveChangesAsync(cancellationToken);
            await audit.AppendAsync("HOLIDAY_REMOVED", viewer.FullName, Label(holiday.Date, holiday.Label), AuditResult.SUCCESS, viewer.UserId, divisionId,
                new { date = AdminRules.FormatFrDate(holiday.Date), label = holiday.Label }, cancellationToken);
            return new HolidayRow(holiday.Id, holiday.Date, holiday.Label);
        }
    }
}
