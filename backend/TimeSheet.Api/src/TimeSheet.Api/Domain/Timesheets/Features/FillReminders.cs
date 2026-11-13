namespace TimeSheet.Api.Domain.Timesheets.Features;

using System.Globalization;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Databases;
using TimeSheet.Api.Domain.Access;
using TimeSheet.Api.Domain.Divisions;
using TimeSheet.Api.Services.Audit;
using TimeSheet.Api.Services.Mail;

/// <summary>
/// Rappel de saisie du vendredi à 12:00 (PROMPT.md §9.11, préférence de l'écran 14, repris de
/// lib/data/reminders.ts) : chaque personne qui saisit ses temps et dont la semaine en cours
/// est incomplète et non soumise reçoit un e-mail avant l'échéance. Une fois par personne et
/// par semaine. Appelé par le planificateur (POST /api/v1/taches/rappels-saisie).
/// </summary>
public static class FillReminders
{
    public const string Action = "FILL_REMINDER_SENT";

    /// <summary>Semaine incomplète : moins de jours saisis qu'attendu, et pas encore soumise ni validée.</summary>
    public static bool Needed(TimesheetStatus? status, int done, int expected) =>
        status is null or TimesheetStatus.DRAFT or TimesheetStatus.REJECTED && (expected > 0 && done < expected);

    public sealed record Command : IRequest<int>;

    public sealed class Handler(TimeSheetDbContext db, IAuditWriter audit, IMailSender mail, IConfiguration configuration, TimeProvider clock) : IRequestHandler<Command, int>
    {
        public async Task<int> Handle(Command request, CancellationToken cancellationToken)
        {
            var now = clock.GetUtcNow();
            var week = WeekRules.CurrentWeek(now);
            var appUrl = (configuration["APP_URL"] ?? "http://localhost:5173").TrimEnd('/');
            var divisions = await db.Divisions.AsNoTracking().Include(d => d.Permissions).Where(d => d.Status == DivisionStatus.ACTIVE).ToListAsync(cancellationToken);
            var sent = 0;
            foreach (var division in divisions)
            {
                var settings = await db.DivisionSettings.AsNoTracking().FirstOrDefaultAsync(s => s.DivisionId == division.Id, cancellationToken) ?? DivisionSettings.Defaults(division.Id);
                var deadline = WeekRules.Deadline(week, settings.DeadlineDay, settings.DeadlineTime);
                // Échéance passée : la relance relève de la vue consolidée, pas de ce rappel.
                if (deadline <= now) continue;
                var holidays = (await db.Holidays.AsNoTracking().Where(h => h.DivisionId == division.Id).Select(h => h.Date).ToListAsync(cancellationToken)).ToHashSet();
                var days = WeekRules.WorkingDays(week, settings.WorkingDays).Where(d => !holidays.Contains(d)).ToList();
                if (days.Count == 0) continue;
                var people = await db.Users.AsNoTracking()
                    .Where(u => u.DivisionId == division.Id && u.Active && u.PasswordHash != null && u.NotifyFillReminder)
                    .ToListAsync(cancellationToken);
                people = people.Where(u => PermissionRules.Effective(u.Role, division.Overrides).Contains(Permission.ENTER_TIME)).ToList();
                var ids = people.Select(u => u.Id).ToList();
                var sheets = await db.Timesheets.AsNoTracking().Include(t => t.Days)
                    .Where(t => t.DivisionId == division.Id && ids.Contains(t.UserId) && t.WeekYear == week.Year && t.WeekNumber == week.Week)
                    .ToDictionaryAsync(t => t.UserId, cancellationToken);
                var labels = people.ToDictionary(u => u.Id, u => $"Semaine {week.Week} de {week.Year} · {u.FullName}");
                var values = labels.Values.ToList();
                var already = (await db.AuditLog.AsNoTracking()
                        .Where(a => a.DivisionId == division.Id && a.Action == Action && a.ActorId == null && a.Result == AuditResult.SUCCESS && values.Contains(a.ObjectLabel))
                        .Select(a => a.ObjectLabel).ToListAsync(cancellationToken)).ToHashSet();
                var deadlineDay = WeekRules.DoualaDay(deadline);
                var deadlineText = $"{FrenchFormat.Date(deadlineDay)} à {(deadline.ToUniversalTime() + WeekRules.DoualaOffset).ToString("HH:mm", CultureInfo.InvariantCulture)}";
                foreach (var person in people)
                {
                    if (already.Contains(labels[person.Id])) continue;
                    var sheet = sheets.GetValueOrDefault(person.Id);
                    var done = sheet?.Days.Count(d => days.Contains(d.Date)) ?? 0;
                    if (!Needed(sheet?.Status, done, days.Count)) continue;
                    var ok = await mail.SendAsync(MailTemplates.FillUpcoming(person.Email, person.FirstName, week.Week, FrenchFormat.Range(days[0], days[^1]),
                        FrenchFormat.Days(done), FrenchFormat.Days(days.Count), deadlineText, $"{appUrl}/saisie/{week.Year}/{week.Week}"), cancellationToken);
                    await audit.AppendAsync(Action, "TimeSheet", labels[person.Id], ok ? AuditResult.SUCCESS : AuditResult.FAILURE, null, division.Id, new { automatic = true }, cancellationToken);
                    if (ok) sent++;
                }
            }
            return sent;
        }
    }
}
