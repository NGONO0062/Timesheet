namespace TimeSheet.Api.Domain.Admin.Features;

using MediatR;
using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Databases;
using TimeSheet.Api.Domain.Access;
using TimeSheet.Api.Domain.Divisions;
using TimeSheet.Api.Domain.Users;
using TimeSheet.Api.Domain.Users.Features;
using TimeSheet.Api.Exceptions;
using TimeSheet.Api.Services.Access;
using TimeSheet.Api.Services.Audit;
using TimeSheet.Api.Services.Mail;

public sealed record ManagerOption(Guid Id, string Name);

public sealed record AdminUserRow(
    Guid Id,
    string FirstName,
    string LastName,
    string Name,
    string Email,
    string Role,
    Guid? ManagerId,
    string? Manager,
    bool Active,
    bool Invited,
    bool IsSelf);

public sealed record UsersPageDto(IReadOnlyList<AdminUserRow> Rows, int Total, int From, int To, int Page, int Count, string Query);

public sealed record WorkflowDto(bool OwnerValidation, int ReminderAfterWorkingDays, bool DelegateToOwner);

public sealed record RulesDto(string[] WorkingDays, string DeadlineDay, string DeadlineTime, string FillAlertThreshold, bool AllowFutureWeeks, bool LockAfterValidation);

/// <summary>Écran 12 sans la liste des utilisateurs : division, managers, matrice, workflow, règles.</summary>
public sealed record AdminDto(string DivisionName, IReadOnlyList<ManagerOption> Managers, IReadOnlyDictionary<string, string[]> Matrix, WorkflowDto Workflow, RulesDto Rules);

public sealed record RoleChanged(string Name, string Previous);

public sealed record UserSaved(string Name, string Email);

/// <summary>
/// Administration de division (PROMPT.md §9.9, écran 12, reprise de lib/data/admin.ts). Tout
/// exige ADMINISTER_DIVISION et reste dans la division de l'administrateur.
/// </summary>
public static class Administration
{
    private static string Label(User u) => $"{u.FullName} · {u.Email}";

    private static async Task<User> TargetAsync(TimeSheetDbContext db, DivisionScope scope, Guid id, CancellationToken cancellationToken) =>
        await db.Users.FirstOrDefaultAsync(u => u.Id == id && u.DivisionId == scope.DivisionId, cancellationToken) ?? throw new RuleException("notFound");

    private static Task<int> AdminsLeftAsync(TimeSheetDbContext db, DivisionScope scope, Guid exceptId, CancellationToken cancellationToken) =>
        db.Users.CountAsync(u => u.DivisionId == scope.DivisionId && u.Role == Role.DIVISION_ADMIN && u.Active && u.Id != exceptId, cancellationToken);

    /// <summary>Managers et owners actifs : ceux à qui l'on peut rattacher quelqu'un.</summary>
    internal static Task<List<ManagerOption>> ManagersAsync(TimeSheetDbContext db, Guid divisionId, CancellationToken cancellationToken) =>
        db.Users.AsNoTracking()
            .Where(u => u.DivisionId == divisionId && u.Active && (u.Role == Role.MANAGER || u.Role == Role.OWNER))
            .OrderBy(u => u.FirstName).ThenBy(u => u.LastName)
            .Select(u => new ManagerOption(u.Id, u.FirstName + " " + u.LastName))
            .ToListAsync(cancellationToken);

    internal static WorkflowDto WorkflowOf(DivisionSettings s) => new(s.OwnerValidation, s.ReminderAfterWorkingDays, s.DelegateToOwner);

    internal static RulesDto RulesOf(DivisionSettings s) => new(
        AdminRules.Weekdays.Where(d => s.WorkingDays.Contains(AdminRules.ToDay(d))).ToArray(),
        AdminRules.FromDay(s.DeadlineDay),
        s.DeadlineTime,
        s.FillAlertThreshold.ToString(System.Globalization.CultureInfo.InvariantCulture),
        s.AllowFutureWeeks,
        s.LockAfterValidation);

    internal static async Task<DivisionSettings> SettingsAsync(TimeSheetDbContext db, Guid divisionId, CancellationToken cancellationToken)
    {
        var settings = await db.DivisionSettings.FirstOrDefaultAsync(s => s.DivisionId == divisionId, cancellationToken);
        if (settings is not null) return settings;
        settings = DivisionSettings.Defaults(divisionId);
        db.DivisionSettings.Add(settings);
        return settings;
    }

    // ---------------------------------------------------------------------------------
    // Lecture
    // ---------------------------------------------------------------------------------

    public sealed record Query : IRequest<AdminDto>;

    public sealed class Handler(TimeSheetDbContext db, IViewerAccessor viewers) : IRequestHandler<Query, AdminDto>
    {
        public async Task<AdminDto> Handle(Query request, CancellationToken cancellationToken)
        {
            var scope = (await viewers.RequireAsync(cancellationToken)).Require(Permission.ADMINISTER_DIVISION).Scope;
            var division = await db.Divisions.AsNoTracking().Include(d => d.Permissions).FirstAsync(d => d.Id == scope.DivisionId, cancellationToken);
            var settings = await db.DivisionSettings.AsNoTracking().FirstOrDefaultAsync(s => s.DivisionId == scope.DivisionId, cancellationToken) ?? DivisionSettings.Defaults(scope.DivisionId);
            var matrix = AdminRules.MatrixOf(division.Overrides).ToDictionary(x => x.Key.ToString(), x => x.Value.Select(p => p.ToString()).ToArray());
            return new AdminDto(division.Name, await ManagersAsync(db, scope.DivisionId, cancellationToken), matrix, WorkflowOf(settings), RulesOf(settings));
        }
    }

    public sealed record UsersQuery(string? Search, int Page) : IRequest<UsersPageDto>;

    public sealed class UsersHandler(TimeSheetDbContext db, IViewerAccessor viewers) : IRequestHandler<UsersQuery, UsersPageDto>
    {
        public async Task<UsersPageDto> Handle(UsersQuery request, CancellationToken cancellationToken)
        {
            var scope = (await viewers.RequireAsync(cancellationToken)).Require(Permission.ADMINISTER_DIVISION).Scope;
            var q = (request.Search ?? "").Trim();
            if (q.Length > 100) q = q[..100];
            var users = db.Users.AsNoTracking().Where(u => u.DivisionId == scope.DivisionId);
            if (q.Length > 0)
            {
                var pattern = $"%{q.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_")}%";
                users = users.Where(u => EF.Functions.ILike(u.FirstName, pattern) || EF.Functions.ILike(u.LastName, pattern) || EF.Functions.ILike(u.Email, pattern)
                                         || EF.Functions.ILike(u.FirstName + " " + u.LastName, pattern));
            }
            var total = await users.CountAsync(cancellationToken);
            var page = AdminRules.PageOf(total, request.Page);
            // Ordre de la maquette 12 : admin, owner, managers, puis les autres ; désactivés en fin de liste.
            var rows = await users
                .OrderByDescending(u => u.Active)
                .ThenBy(u => u.Role == Role.DIVISION_ADMIN ? 0 : u.Role == Role.OWNER ? 1 : u.Role == Role.MANAGER ? 2 : 3)
                .ThenBy(u => u.LastName).ThenBy(u => u.FirstName)
                .Skip(page.Skip).Take(AdminRules.UsersPageSize)
                .ToListAsync(cancellationToken);
            var ids = rows.Select(u => u.Id).ToList();
            var managerIds = rows.Where(u => u.ManagerId is not null).Select(u => u.ManagerId!.Value).Distinct().ToList();
            var managers = await db.Users.AsNoTracking().Where(u => managerIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.FullName, cancellationToken);
            var invited = await db.PasswordTokens.AsNoTracking().Where(t => ids.Contains(t.UserId) && t.Kind == TokenKind.INVITATION && t.UsedAt == null)
                .Select(t => t.UserId).Distinct().ToListAsync(cancellationToken);
            return new UsersPageDto(
                rows.Select(u => new AdminUserRow(
                    u.Id, u.FirstName, u.LastName, u.FullName, u.Email, u.Role.ToString(), u.ManagerId,
                    u.ManagerId is { } m ? managers.GetValueOrDefault(m) : null,
                    u.Active,
                    u.PasswordHash is null && invited.Contains(u.Id),
                    u.Id == scope.UserId)).ToList(),
                total, page.From, page.To, page.Page, page.Count, q);
        }
    }

    // ---------------------------------------------------------------------------------
    // Rôle et compte, sur la ligne
    // ---------------------------------------------------------------------------------

    public sealed record RoleCommand(Guid Id, string? Role) : IRequest<RoleChanged>;

    public sealed class RoleHandler(TimeSheetDbContext db, IViewerAccessor viewers, IAuditWriter audit) : IRequestHandler<RoleCommand, RoleChanged>
    {
        public async Task<RoleChanged> Handle(RoleCommand request, CancellationToken cancellationToken)
        {
            var viewer = (await viewers.RequireAsync(cancellationToken)).Require(Permission.ADMINISTER_DIVISION);
            var scope = viewer.Scope;
            var role = AdminRules.ParseDivisionRole(request.Role) ?? throw new RuleException("role");
            var user = await TargetAsync(db, scope, request.Id, cancellationToken);
            if (user.Id == scope.UserId) throw new RuleException("self");
            if (user.Role == Role.DIVISION_ADMIN && role != Role.DIVISION_ADMIN && await AdminsLeftAsync(db, scope, user.Id, cancellationToken) == 0) throw new RuleException("lastAdmin");
            var previous = user.Role;
            user.ChangeRole(role);
            await db.SaveChangesAsync(cancellationToken);
            await audit.AppendAsync("USER_ROLE_CHANGED", viewer.FullName, Label(user), AuditResult.SUCCESS, viewer.UserId, scope.DivisionId, new { from = previous.ToString(), to = role.ToString() }, cancellationToken);
            return new RoleChanged(user.FullName, previous.ToString());
        }
    }

    public sealed record ActiveCommand(Guid Id, bool Active) : IRequest<string>;

    /// <summary>Activation ou désactivation : un compte désactivé ne se connecte plus, ses données restent.</summary>
    public sealed class ActiveHandler(TimeSheetDbContext db, IViewerAccessor viewers, IAuditWriter audit) : IRequestHandler<ActiveCommand, string>
    {
        public async Task<string> Handle(ActiveCommand request, CancellationToken cancellationToken)
        {
            var viewer = (await viewers.RequireAsync(cancellationToken)).Require(Permission.ADMINISTER_DIVISION);
            var scope = viewer.Scope;
            var user = await TargetAsync(db, scope, request.Id, cancellationToken);
            if (user.Id == scope.UserId) throw new RuleException("self");
            if (!request.Active && user.Role == Role.DIVISION_ADMIN && await AdminsLeftAsync(db, scope, user.Id, cancellationToken) == 0) throw new RuleException("lastAdmin");
            user.SetActive(request.Active);
            await db.SaveChangesAsync(cancellationToken);
            await audit.AppendAsync(request.Active ? "USER_ACTIVATED" : "USER_DEACTIVATED", viewer.FullName, Label(user), AuditResult.SUCCESS, viewer.UserId, scope.DivisionId, cancellationToken: cancellationToken);
            return user.FullName;
        }
    }

    // ---------------------------------------------------------------------------------
    // Invitation et modification (fenêtre)
    // ---------------------------------------------------------------------------------

    /// <summary>Manager valide de la division ; renvoie l'équipe qu'il anime (la personne la rejoint).</summary>
    private static async Task<Guid?> CheckManagerAsync(TimeSheetDbContext db, DivisionScope scope, Guid? managerId, Guid? selfId, CancellationToken cancellationToken)
    {
        if (managerId is not { } id) return null;
        if (id == selfId) throw new RuleException("invalid", ["manager"]);
        var ok = await db.Users.AnyAsync(u => u.Id == id && u.DivisionId == scope.DivisionId && u.Active && (u.Role == Role.MANAGER || u.Role == Role.OWNER), cancellationToken);
        if (!ok) throw new RuleException("invalid", ["manager"]);
        return await db.Teams.Where(t => t.DivisionId == scope.DivisionId && t.ManagerId == id).Select(t => (Guid?)t.Id).FirstOrDefaultAsync(cancellationToken);
    }

    public sealed record SaveCommand(Guid? Id, UserInput Input) : IRequest<UserSaved>;

    public sealed class SaveHandler(TimeSheetDbContext db, IViewerAccessor viewers, IAuditWriter audit, IInvitations invitations) : IRequestHandler<SaveCommand, UserSaved>
    {
        public async Task<UserSaved> Handle(SaveCommand request, CancellationToken cancellationToken)
        {
            var viewer = (await viewers.RequireAsync(cancellationToken)).Require(Permission.ADMINISTER_DIVISION);
            var scope = viewer.Scope;
            var input = request.Input;
            var managers = (await ManagersAsync(db, scope.DivisionId, cancellationToken)).Select(m => m.Id).ToList();
            var fields = AdminRules.CheckUser(input, managers, checkEmail: request.Id is null);
            if (fields.Count > 0) throw new RuleException("invalid", fields);
            var role = AdminRules.ParseDivisionRole(input.Role)!.Value;

            if (request.Id is not { } id)
            {
                var email = User.NormalizeEmail(input.Email!);
                if (await db.Users.AnyAsync(u => u.Email == email, cancellationToken)) throw new RuleException("invalid", ["emailTaken"]);
                var team = await CheckManagerAsync(db, scope, input.ManagerId, null, cancellationToken);
                var created = User.Create(scope.DivisionId, email, input.FirstName!, input.LastName!, role);
                created.AssignManager(input.ManagerId);
                created.AssignTeam(team);
                db.Users.Add(created);
                await db.SaveChangesAsync(cancellationToken);
                await invitations.SendAsync(created, viewer.FullName, cancellationToken);
                await audit.AppendAsync("USER_INVITED", viewer.FullName, Label(created), AuditResult.SUCCESS, viewer.UserId, scope.DivisionId,
                    new { role = role.ToString() }, cancellationToken);
                return new UserSaved(created.FullName, created.Email);
            }

            var user = await TargetAsync(db, scope, id, cancellationToken);
            var teamId = await CheckManagerAsync(db, scope, input.ManagerId, id, cancellationToken);
            if (role != user.Role)
            {
                if (user.Id == scope.UserId) throw new RuleException("self");
                if (user.Role == Role.DIVISION_ADMIN && await AdminsLeftAsync(db, scope, id, cancellationToken) == 0) throw new RuleException("lastAdmin");
            }
            user.Rename(input.FirstName!, input.LastName!);
            user.ChangeRole(role);
            // Le manager change : la personne rejoint son équipe. Sinon, l'équipe reste.
            if (input.ManagerId != user.ManagerId) user.AssignTeam(teamId);
            user.AssignManager(input.ManagerId);
            await db.SaveChangesAsync(cancellationToken);
            await audit.AppendAsync("USER_UPDATED", viewer.FullName, Label(user), AuditResult.SUCCESS, viewer.UserId, scope.DivisionId,
                new { role = role.ToString(), managerId = input.ManagerId }, cancellationToken);
            return new UserSaved(user.FullName, user.Email);
        }
    }

    public sealed record ResendCommand(Guid Id) : IRequest<string>;

    /// <summary>Nouvel envoi de l'invitation d'un compte qui n'a pas encore choisi son mot de passe.</summary>
    public sealed class ResendHandler(TimeSheetDbContext db, IViewerAccessor viewers, IAuditWriter audit, IInvitations invitations) : IRequestHandler<ResendCommand, string>
    {
        public async Task<string> Handle(ResendCommand request, CancellationToken cancellationToken)
        {
            var viewer = (await viewers.RequireAsync(cancellationToken)).Require(Permission.ADMINISTER_DIVISION);
            var user = await TargetAsync(db, viewer.Scope, request.Id, cancellationToken);
            if (user.PasswordHash is not null || !user.Active) throw new RuleException("notFound");
            await invitations.SendAsync(user, viewer.FullName, cancellationToken);
            await audit.AppendAsync("USER_INVITED", viewer.FullName, Label(user), AuditResult.SUCCESS, viewer.UserId, viewer.Scope.DivisionId, new { resent = true }, cancellationToken);
            return user.Email;
        }
    }

    // ---------------------------------------------------------------------------------
    // Permissions, workflow, règles de saisie
    // ---------------------------------------------------------------------------------

    public sealed record MatrixCommand(IReadOnlyDictionary<string, string[]>? Matrix) : IRequest<Unit>;

    public sealed class MatrixHandler(TimeSheetDbContext db, IViewerAccessor viewers, IAuditWriter audit) : IRequestHandler<MatrixCommand, Unit>
    {
        public async Task<Unit> Handle(MatrixCommand request, CancellationToken cancellationToken)
        {
            var viewer = (await viewers.RequireAsync(cancellationToken)).Require(Permission.ADMINISTER_DIVISION);
            var overrides = AdminRules.OverridesFor(AdminRules.ParseMatrix(request.Matrix));
            var division = await db.Divisions.Include(d => d.Permissions).FirstAsync(d => d.Id == viewer.Scope.DivisionId, cancellationToken);
            division.ReplaceMatrix(overrides);
            await db.SaveChangesAsync(cancellationToken);
            await audit.AppendAsync("PERMISSIONS_CHANGED", viewer.FullName, "Rôles et permissions", AuditResult.SUCCESS, viewer.UserId, viewer.Scope.DivisionId,
                new { overrides = overrides.Select(o => $"{o.Role}:{o.Permission}:{(o.Granted ? "+" : "-")}").ToArray() }, cancellationToken);
            return Unit.Value;
        }
    }

    public sealed record WorkflowCommand(WorkflowInput Input) : IRequest<Unit>;

    public sealed class WorkflowHandler(TimeSheetDbContext db, IViewerAccessor viewers, IAuditWriter audit) : IRequestHandler<WorkflowCommand, Unit>
    {
        public async Task<Unit> Handle(WorkflowCommand request, CancellationToken cancellationToken)
        {
            var viewer = (await viewers.RequireAsync(cancellationToken)).Require(Permission.ADMINISTER_DIVISION);
            var w = request.Input;
            var fields = AdminRules.CheckWorkflow(w);
            if (fields.Count > 0) throw new RuleException("invalid", fields);
            var settings = await SettingsAsync(db, viewer.Scope.DivisionId, cancellationToken);
            settings.WithWorkflow(w.ReminderAfterWorkingDays, w.DelegateToOwner);
            await db.SaveChangesAsync(cancellationToken);
            await audit.AppendAsync("WORKFLOW_CHANGED", viewer.FullName, "Workflows", AuditResult.SUCCESS, viewer.UserId, viewer.Scope.DivisionId,
                new { reminderAfterWorkingDays = w.ReminderAfterWorkingDays, delegateToOwner = w.DelegateToOwner }, cancellationToken);
            return Unit.Value;
        }
    }

    public sealed record RulesCommand(RulesInput Input) : IRequest<Unit>;

    /// <summary>Règles enregistrées ; l'objet du journal dit ce qui a changé (« Seuil d'alerte de remplissage : 80 % »).</summary>
    public sealed class RulesHandler(TimeSheetDbContext db, IViewerAccessor viewers, IAuditWriter audit) : IRequestHandler<RulesCommand, Unit>
    {
        public async Task<Unit> Handle(RulesCommand request, CancellationToken cancellationToken)
        {
            var viewer = (await viewers.RequireAsync(cancellationToken)).Require(Permission.ADMINISTER_DIVISION);
            var r = request.Input;
            var fields = AdminRules.CheckRules(r);
            if (fields.Count > 0) throw new RuleException("invalid", fields);
            var settings = await SettingsAsync(db, viewer.Scope.DivisionId, cancellationToken);
            var before = RulesOf(settings);
            var days = AdminRules.Weekdays.Where(d => r.WorkingDays!.Contains(d)).Select(AdminRules.ToDay).ToArray();
            settings.WithRules(days, AdminRules.ToDay(r.DeadlineDay!), r.DeadlineTime!, AdminRules.ParseThreshold(r.FillAlertThreshold)!.Value, r.AllowFutureWeeks, r.LockAfterValidation);
            await db.SaveChangesAsync(cancellationToken);
            var changes = AdminRules.DescribeRules(
                new RulesInput(before.WorkingDays, before.DeadlineDay, before.DeadlineTime, before.FillAlertThreshold, before.AllowFutureWeeks, before.LockAfterValidation), r);
            await audit.AppendAsync("RULES_CHANGED", viewer.FullName, changes.Count > 0 ? string.Join(" ; ", changes) : "Règles de saisie", AuditResult.SUCCESS, viewer.UserId, viewer.Scope.DivisionId,
                new { workingDays = r.WorkingDays, deadlineDay = r.DeadlineDay, deadlineTime = r.DeadlineTime, fillAlertThreshold = r.FillAlertThreshold, r.AllowFutureWeeks, r.LockAfterValidation }, cancellationToken);
            return Unit.Value;
        }
    }
}
