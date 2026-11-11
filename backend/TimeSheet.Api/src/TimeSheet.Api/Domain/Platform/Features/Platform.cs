namespace TimeSheet.Api.Domain.Platform.Features;

using MediatR;
using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Databases;
using TimeSheet.Api.Domain.Access;
using TimeSheet.Api.Domain.Admin;
using TimeSheet.Api.Domain.Admin.Features;
using TimeSheet.Api.Domain.Divisions;
using TimeSheet.Api.Domain.Users;
using TimeSheet.Api.Domain.Users.Features;
using TimeSheet.Api.Exceptions;
using TimeSheet.Api.Services.Access;
using TimeSheet.Api.Services.Audit;

public sealed record DivisionRowDto(Guid Id, string Name, string Slug, bool Pilot, string? Admin, int Users, string Status, int Step, DateTimeOffset CreatedAt);

public sealed record DivisionDetailDto(Guid Id, string Name, string Slug, string Direction, string Status, int Step, DateTimeOffset CreatedAt, int Users, IReadOnlyList<string> Admins);

public sealed record StatusChangedDto(string Name, string Previous);

public sealed record OnboardingAdminDto(string FullName, string Email, string Config);

/// <summary>Onboarding en cours : la saisie de chaque étape enregistrée, et l'étape atteinte.</summary>
public sealed record OnboardingDto(
    Guid Id,
    int Step,
    IdentityInput Identity,
    OnboardingAdminDto? Admin,
    string? Config,
    IReadOnlyDictionary<string, string[]> Matrix,
    WorkflowDto Workflow,
    RulesDto Rules,
    string PilotName);

public sealed record StepSaved(Guid Id, int Step);

public sealed record DivisionCreated(string Name, string Email);

/// <summary>
/// Administration plateforme (PROMPT.md §9.10, écran 13, reprise de lib/data/platform.ts) :
/// divisions et onboarding. Réservée à l'admin plateforme, qui gère les divisions mais ne
/// voit ni les fiches de temps ni les données métier d'une division.
/// </summary>
public static class Platform
{
    private static readonly string[] StepTitles = ["Identité", "Administrateur", "Rôles et workflow", "Règles de saisie", "Récapitulatif"];

    internal static string StepLabel(int n, string division) => $"Étape {n} · {StepTitles[n - 1]} · {division}";

    // ---------------------------------------------------------------------------------
    // Divisions
    // ---------------------------------------------------------------------------------

    public sealed record ListQuery : IRequest<IReadOnlyList<DivisionRowDto>>;

    public sealed class ListHandler(TimeSheetDbContext db, IViewerAccessor viewers) : IRequestHandler<ListQuery, IReadOnlyList<DivisionRowDto>>
    {
        public async Task<IReadOnlyList<DivisionRowDto>> Handle(ListQuery request, CancellationToken cancellationToken)
        {
            (await viewers.RequireAsync(cancellationToken)).RequirePlatformAdmin();
            var divisions = await db.Divisions.AsNoTracking().OrderBy(d => d.CreatedOn).ThenBy(d => d.Name).ToListAsync(cancellationToken);
            var counts = await db.Users.AsNoTracking().Where(u => u.DivisionId != null).GroupBy(u => u.DivisionId!.Value).Select(g => new { g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.Key, x => x.Count, cancellationToken);
            var admins = (await db.Users.AsNoTracking().Where(u => u.Role == Role.DIVISION_ADMIN && u.Active).OrderBy(u => u.CreatedOn).ToListAsync(cancellationToken))
                .GroupBy(u => u.DivisionId!.Value).ToDictionary(g => g.Key, g => g.First().FullName);
            return divisions.Select(d => new DivisionRowDto(
                d.Id, d.Name, d.Slug, d.Slug == PlatformRules.PilotSlug,
                // En onboarding, l'administrateur n'est désigné qu'à la fin.
                d.Status == DivisionStatus.ONBOARDING ? null : admins.GetValueOrDefault(d.Id),
                counts.GetValueOrDefault(d.Id), d.Status.ToString(), d.OnboardingStep, d.CreatedOn)).ToList();
        }
    }

    public sealed record DetailQuery(Guid Id) : IRequest<DivisionDetailDto>;

    public sealed class DetailHandler(TimeSheetDbContext db, IViewerAccessor viewers) : IRequestHandler<DetailQuery, DivisionDetailDto>
    {
        public async Task<DivisionDetailDto> Handle(DetailQuery request, CancellationToken cancellationToken)
        {
            (await viewers.RequireAsync(cancellationToken)).RequirePlatformAdmin();
            var d = await db.Divisions.AsNoTracking().FirstOrDefaultAsync(x => x.Id == request.Id, cancellationToken) ?? throw new NotFoundException("Division introuvable.");
            var users = await db.Users.CountAsync(u => u.DivisionId == d.Id, cancellationToken);
            var admins = await db.Users.AsNoTracking().Where(u => u.DivisionId == d.Id && u.Role == Role.DIVISION_ADMIN && u.Active).OrderBy(u => u.CreatedOn)
                .Select(u => u.FirstName + " " + u.LastName + " · " + u.Email).ToListAsync(cancellationToken);
            return new DivisionDetailDto(d.Id, d.Name, d.Slug, d.Direction, d.Status.ToString(), d.OnboardingStep, d.CreatedOn, users, admins);
        }
    }

    public sealed record StatusCommand(Guid Id, string? Status) : IRequest<StatusChangedDto>;

    /// <summary>Suspension ou réactivation, tout de suite ; renvoie l'ancien état pour « Annuler ».</summary>
    public sealed class StatusHandler(TimeSheetDbContext db, IViewerAccessor viewers, IAuditWriter audit) : IRequestHandler<StatusCommand, StatusChangedDto>
    {
        public async Task<StatusChangedDto> Handle(StatusCommand request, CancellationToken cancellationToken)
        {
            var viewer = (await viewers.RequireAsync(cancellationToken)).RequirePlatformAdmin();
            var next = request.Status switch
            {
                "ACTIVE" => DivisionStatus.ACTIVE,
                "SUSPENDED" => DivisionStatus.SUSPENDED,
                _ => throw new RuleException("status"),
            };
            var d = await db.Divisions.FirstOrDefaultAsync(x => x.Id == request.Id, cancellationToken) ?? throw new RuleException("notFound");
            if (d.Status == DivisionStatus.ONBOARDING) throw new RuleException("onboarding");
            var previous = d.Status;
            d.SetStatus(next);
            await db.SaveChangesAsync(cancellationToken);
            if (previous != next)
                await audit.AppendAsync(next == DivisionStatus.SUSPENDED ? "DIVISION_SUSPENDED" : "DIVISION_ACTIVATED", viewer.FullName, d.Name, AuditResult.SUCCESS, viewer.UserId, d.Id, cancellationToken: cancellationToken);
            return new StatusChangedDto(d.Name, previous.ToString());
        }
    }

    // ---------------------------------------------------------------------------------
    // Onboarding en cinq étapes : la progression est enregistrée à chaque étape
    // ---------------------------------------------------------------------------------

    private static async Task<Division> OnboardingAsync(TimeSheetDbContext db, Guid id, CancellationToken cancellationToken) =>
        await db.Divisions.Include(d => d.Permissions).FirstOrDefaultAsync(d => d.Id == id && d.Status == DivisionStatus.ONBOARDING, cancellationToken)
        ?? throw new NotFoundException("Onboarding introuvable.");

    /// <summary>Administrateur désigné à l'étape 2 : compte sans mot de passe, invité à la fin.</summary>
    private static Task<User?> PendingAdminAsync(TimeSheetDbContext db, Guid divisionId, CancellationToken cancellationToken) =>
        db.Users.Where(u => u.DivisionId == divisionId && u.Role == Role.DIVISION_ADMIN).OrderBy(u => u.CreatedOn).FirstOrDefaultAsync(cancellationToken);

    private static async Task<int> AdvanceAsync(TimeSheetDbContext db, IAuditWriter audit, Viewer viewer, Division d, int done, CancellationToken cancellationToken)
    {
        d.AdvanceTo(done + 1);
        await db.SaveChangesAsync(cancellationToken);
        await audit.AppendAsync("DIVISION_UPDATED", viewer.FullName, StepLabel(done, d.Name), AuditResult.SUCCESS, viewer.UserId, d.Id, cancellationToken: cancellationToken);
        return d.OnboardingStep;
    }

    public sealed record OnboardingQuery(Guid Id) : IRequest<OnboardingDto>;

    public sealed class OnboardingHandler(TimeSheetDbContext db, IViewerAccessor viewers) : IRequestHandler<OnboardingQuery, OnboardingDto>
    {
        public async Task<OnboardingDto> Handle(OnboardingQuery request, CancellationToken cancellationToken)
        {
            (await viewers.RequireAsync(cancellationToken)).RequirePlatformAdmin();
            var d = await OnboardingAsync(db, request.Id, cancellationToken);
            var admin = await PendingAdminAsync(db, d.Id, cancellationToken);
            var settings = await db.DivisionSettings.AsNoTracking().FirstOrDefaultAsync(s => s.DivisionId == d.Id, cancellationToken) ?? DivisionSettings.Defaults(d.Id);
            var pilot = await db.Divisions.AsNoTracking().Where(x => x.Slug == PlatformRules.PilotSlug).Select(x => x.Name).FirstOrDefaultAsync(cancellationToken) ?? "";
            return new OnboardingDto(
                d.Id, d.OnboardingStep, new IdentityInput(d.Name, d.Slug, d.Direction),
                admin is null ? null : new OnboardingAdminDto(admin.FullName, admin.Email, d.ConfigSource ?? "COPY"),
                d.ConfigSource,
                AdminRules.MatrixOf(d.Overrides).ToDictionary(x => x.Key.ToString(), x => x.Value.Select(p => p.ToString()).ToArray()),
                Administration.WorkflowOf(settings), Administration.RulesOf(settings), pilot);
        }
    }

    public sealed record IdentityCommand(Guid? Id, IdentityInput Input) : IRequest<StepSaved>;

    /// <summary>Étape 1 : la division naît en onboarding (étape 2) ; identifiant unique.</summary>
    public sealed class IdentityHandler(TimeSheetDbContext db, IViewerAccessor viewers, IAuditWriter audit) : IRequestHandler<IdentityCommand, StepSaved>
    {
        public async Task<StepSaved> Handle(IdentityCommand request, CancellationToken cancellationToken)
        {
            var viewer = (await viewers.RequireAsync(cancellationToken)).RequirePlatformAdmin();
            var i = request.Input;
            var fields = PlatformRules.CheckIdentity(i);
            if (fields.Count > 0) throw new RuleException("invalid", fields);
            var slug = i.Slug!.Trim();
            if (await db.Divisions.AnyAsync(d => d.Slug == slug && d.Id != request.Id, cancellationToken)) throw new RuleException("invalid", ["slugTaken"]);
            if (request.Id is not { } id)
            {
                var created = Division.Create(i.Name!, slug, i.Direction!);
                db.Divisions.Add(created);
                db.DivisionSettings.Add(DivisionSettings.Defaults(created.Id));
                return new StepSaved(created.Id, await AdvanceAsync(db, audit, viewer, created, 1, cancellationToken));
            }
            var d = await OnboardingAsync(db, id, cancellationToken);
            d.SetIdentity(i.Name!, slug, i.Direction!);
            return new StepSaved(d.Id, await AdvanceAsync(db, audit, viewer, d, 1, cancellationToken));
        }
    }

    public sealed record AdminCommand(Guid Id, OnboardingAdminInput Input) : IRequest<StepSaved>;

    /// <summary>Étape 2 : administrateur (invité à la fin) et configuration de départ.</summary>
    public sealed class AdminHandler(TimeSheetDbContext db, IViewerAccessor viewers, IAuditWriter audit) : IRequestHandler<AdminCommand, StepSaved>
    {
        public async Task<StepSaved> Handle(AdminCommand request, CancellationToken cancellationToken)
        {
            var viewer = (await viewers.RequireAsync(cancellationToken)).RequirePlatformAdmin();
            var input = request.Input;
            var fields = PlatformRules.CheckAdmin(input);
            if (fields.Count > 0) throw new RuleException("invalid", fields);
            var d = await OnboardingAsync(db, request.Id, cancellationToken);
            var (first, last) = PlatformRules.SplitName(input.FullName)!.Value;
            var email = User.NormalizeEmail(input.Email!);
            var current = await PendingAdminAsync(db, d.Id, cancellationToken);
            if (await db.Users.AnyAsync(u => u.Email == email && u.Id != (current == null ? Guid.Empty : current.Id), cancellationToken)) throw new RuleException("invalid", ["emailTaken"]);
            if (current is null) db.Users.Add(User.Create(d.Id, email, first, last, Role.DIVISION_ADMIN));
            else
            {
                current.Rename(first, last);
                current.ChangeEmail(email);
            }
            if (d.ConfigSource != input.Config) await ApplyConfigAsync(d, input.Config!, cancellationToken);
            return new StepSaved(d.Id, await AdvanceAsync(db, audit, viewer, d, 2, cancellationToken));
        }

        /// <summary>Configuration de départ : celle de la division pilote (rôles, workflow, règles, jamais les données), ou vierge.</summary>
        private async Task ApplyConfigAsync(Division d, string config, CancellationToken cancellationToken)
        {
            var settings = await Administration.SettingsAsync(db, d.Id, cancellationToken);
            var pilot = config == "COPY" ? await db.Divisions.AsNoTracking().Include(x => x.Permissions).FirstOrDefaultAsync(x => x.Slug == PlatformRules.PilotSlug, cancellationToken) : null;
            if (pilot is not null)
            {
                var source = await db.DivisionSettings.AsNoTracking().FirstOrDefaultAsync(s => s.DivisionId == pilot.Id, cancellationToken) ?? DivisionSettings.Defaults(pilot.Id);
                settings.CopyFrom(source);
                d.ReplaceMatrix(pilot.Overrides);
            }
            else
            {
                settings.CopyFrom(DivisionSettings.Defaults(d.Id));
                d.ReplaceMatrix([]);
            }
            d.SetConfigSource(config);
        }
    }

    public sealed record RolesCommand(Guid Id, IReadOnlyDictionary<string, string[]>? Matrix, WorkflowInput Workflow) : IRequest<StepSaved>;

    /// <summary>Étape 3 : rôles et permissions, workflow.</summary>
    public sealed class RolesHandler(TimeSheetDbContext db, IViewerAccessor viewers, IAuditWriter audit) : IRequestHandler<RolesCommand, StepSaved>
    {
        public async Task<StepSaved> Handle(RolesCommand request, CancellationToken cancellationToken)
        {
            var viewer = (await viewers.RequireAsync(cancellationToken)).RequirePlatformAdmin();
            var fields = AdminRules.CheckWorkflow(request.Workflow);
            if (fields.Count > 0) throw new RuleException("invalid", fields);
            var matrix = AdminRules.ParseMatrix(request.Matrix);
            var d = await OnboardingAsync(db, request.Id, cancellationToken);
            d.ReplaceMatrix(AdminRules.OverridesFor(matrix));
            var w = request.Workflow;
            (await Administration.SettingsAsync(db, d.Id, cancellationToken)).WithWorkflow(w.ReminderAfterWorkingDays, w.DelegateToOwner);
            return new StepSaved(d.Id, await AdvanceAsync(db, audit, viewer, d, 3, cancellationToken));
        }
    }

    public sealed record RulesCommand(Guid Id, RulesInput Input) : IRequest<StepSaved>;

    /// <summary>Étape 4 : règles de saisie.</summary>
    public sealed class RulesHandler(TimeSheetDbContext db, IViewerAccessor viewers, IAuditWriter audit) : IRequestHandler<RulesCommand, StepSaved>
    {
        public async Task<StepSaved> Handle(RulesCommand request, CancellationToken cancellationToken)
        {
            var viewer = (await viewers.RequireAsync(cancellationToken)).RequirePlatformAdmin();
            var r = request.Input;
            var fields = AdminRules.CheckRules(r);
            if (fields.Count > 0) throw new RuleException("invalid", fields);
            var d = await OnboardingAsync(db, request.Id, cancellationToken);
            var days = AdminRules.Weekdays.Where(x => r.WorkingDays!.Contains(x)).Select(AdminRules.ToDay).ToArray();
            (await Administration.SettingsAsync(db, d.Id, cancellationToken))
                .WithRules(days, AdminRules.ToDay(r.DeadlineDay!), r.DeadlineTime!, AdminRules.ParseThreshold(r.FillAlertThreshold)!.Value, r.AllowFutureWeeks, r.LockAfterValidation);
            return new StepSaved(d.Id, await AdvanceAsync(db, audit, viewer, d, 4, cancellationToken));
        }
    }

    public sealed record FinishCommand(Guid Id) : IRequest<DivisionCreated>;

    /// <summary>Étape 5 : la division devient active et l'invitation de l'administrateur part.</summary>
    public sealed class FinishHandler(TimeSheetDbContext db, IViewerAccessor viewers, IAuditWriter audit, IInvitations invitations) : IRequestHandler<FinishCommand, DivisionCreated>
    {
        public async Task<DivisionCreated> Handle(FinishCommand request, CancellationToken cancellationToken)
        {
            var viewer = (await viewers.RequireAsync(cancellationToken)).RequirePlatformAdmin();
            var d = await OnboardingAsync(db, request.Id, cancellationToken);
            var admin = await PendingAdminAsync(db, d.Id, cancellationToken) ?? throw new RuleException("incomplete", detail: "2");
            if (d.OnboardingStep < PlatformRules.Steps) throw new RuleException("incomplete", detail: d.OnboardingStep.ToString(System.Globalization.CultureInfo.InvariantCulture));
            d.SetStatus(DivisionStatus.ACTIVE);
            await db.SaveChangesAsync(cancellationToken);
            await invitations.SendAsync(admin, viewer.FullName, cancellationToken);
            await audit.AppendAsync("DIVISION_CREATED", viewer.FullName, d.Name, AuditResult.SUCCESS, viewer.UserId, d.Id, new { admin = admin.Email }, cancellationToken);
            await audit.AppendAsync("USER_INVITED", viewer.FullName, $"{admin.FullName} · {admin.Email}", AuditResult.SUCCESS, viewer.UserId, d.Id, new { role = "DIVISION_ADMIN" }, cancellationToken);
            return new DivisionCreated(d.Name, admin.Email);
        }
    }
}
