namespace TimeSheet.Api.Controllers.v1;

using Asp.Versioning;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using TimeSheet.Api.Domain.Admin;
using TimeSheet.Api.Domain.Admin.Features;

public sealed record RoleInput(string? Role);

public sealed record ActiveInput(bool Active);

public sealed record MatrixInput(Dictionary<string, string[]>? Matrix);

/// <summary>Écran 12 (jalon 6). Permission « Gérer les utilisateurs, workflows et règles ».</summary>
[ApiController]
[Route("api/v{v:apiVersion}/administration")]
[ApiVersion("1.0")]
public sealed class AdministrationController(IMediator mediator) : ControllerBase
{
    [HttpGet]
    public Task<AdminDto> Get(CancellationToken cancellationToken) => mediator.Send(new Administration.Query(), cancellationToken);

    [HttpGet("utilisateurs")]
    public Task<UsersPageDto> Users([FromQuery] string? recherche, [FromQuery] int page = 1, CancellationToken cancellationToken = default) =>
        mediator.Send(new Administration.UsersQuery(recherche, page), cancellationToken);

    /// <summary>Invitation : compte sans mot de passe, lien d'une semaine par e-mail.</summary>
    [HttpPost("utilisateurs")]
    [Consumes("application/json")]
    public Task<UserSaved> Invite([FromBody] UserInput body, CancellationToken cancellationToken) => mediator.Send(new Administration.SaveCommand(null, body), cancellationToken);

    [HttpPut("utilisateurs/{id:guid}")]
    [Consumes("application/json")]
    public Task<UserSaved> Update(Guid id, [FromBody] UserInput body, CancellationToken cancellationToken) => mediator.Send(new Administration.SaveCommand(id, body), cancellationToken);

    [HttpPut("utilisateurs/{id:guid}/role")]
    [Consumes("application/json")]
    public Task<RoleChanged> Role(Guid id, [FromBody] RoleInput body, CancellationToken cancellationToken) => mediator.Send(new Administration.RoleCommand(id, body.Role), cancellationToken);

    [HttpPut("utilisateurs/{id:guid}/compte")]
    [Consumes("application/json")]
    public async Task<object> Account(Guid id, [FromBody] ActiveInput body, CancellationToken cancellationToken) =>
        new { name = await mediator.Send(new Administration.ActiveCommand(id, body.Active), cancellationToken) };

    [HttpPost("utilisateurs/{id:guid}/invitation")]
    public async Task<object> Resend(Guid id, CancellationToken cancellationToken) =>
        new { email = await mediator.Send(new Administration.ResendCommand(id), cancellationToken) };

    [HttpPut("permissions")]
    [Consumes("application/json")]
    public async Task<IActionResult> Permissions([FromBody] MatrixInput body, CancellationToken cancellationToken)
    {
        await mediator.Send(new Administration.MatrixCommand(body.Matrix), cancellationToken);
        return NoContent();
    }

    [HttpPut("workflow")]
    [Consumes("application/json")]
    public async Task<IActionResult> Workflow([FromBody] WorkflowInput body, CancellationToken cancellationToken)
    {
        await mediator.Send(new Administration.WorkflowCommand(body), cancellationToken);
        return NoContent();
    }

    [HttpPut("regles")]
    [Consumes("application/json")]
    public async Task<IActionResult> Rules([FromBody] RulesInput body, CancellationToken cancellationToken)
    {
        await mediator.Send(new Administration.RulesCommand(body), cancellationToken);
        return NoContent();
    }

    /// <summary>Jours fériés de la division : un jour férié n'attend aucune saisie.</summary>
    [HttpGet("jours-feries")]
    public Task<HolidaysDto> Holidays(CancellationToken cancellationToken) => mediator.Send(new Holidays.Query(), cancellationToken);

    [HttpPost("jours-feries")]
    [Consumes("application/json")]
    public Task<HolidayAdded> AddHoliday([FromBody] HolidayInput body, CancellationToken cancellationToken) => mediator.Send(new Holidays.AddCommand(body), cancellationToken);

    [HttpDelete("jours-feries/{id:guid}")]
    public Task<HolidayRow> RemoveHoliday(Guid id, CancellationToken cancellationToken) => mediator.Send(new Holidays.RemoveCommand(id), cancellationToken);
}
