namespace TimeSheet.Api.Controllers.v1;

using Asp.Versioning;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TimeSheet.Api.Domain.Users.Features;

public sealed record ResetRequestInput(string? Email);

public sealed record NewPasswordInput(string? Next, string? Confirm);

/// <summary>
/// Pages publiques (PROMPT.md §19) : mot de passe oublié, invitation et réinitialisation. La
/// réponse ne dit jamais si une adresse est connue.
/// </summary>
[ApiController]
[AllowAnonymous]
[Route("api/v{v:apiVersion}/compte")]
[ApiVersion("1.0")]
public sealed class AccountController(IMediator mediator) : ControllerBase
{
    [HttpPost("mot-de-passe-oublie")]
    [Consumes("application/json")]
    public async Task<IActionResult> Forgot([FromBody] ResetRequestInput body, CancellationToken cancellationToken)
    {
        await mediator.Send(new Accounts.ResetCommand(body.Email), cancellationToken);
        return NoContent();
    }

    /// <summary>« invitation » ou « reinitialisation » : compte du lien s'il est encore valable, sinon 404.</summary>
    [HttpGet("liens/{kind}/{token}")]
    public async Task<ActionResult<LinkAccount>> Peek(string kind, string token, CancellationToken cancellationToken)
    {
        if (Accounts.ParseKind(kind) is not { } k) return NotFound();
        return await mediator.Send(new Accounts.PeekQuery(k, token), cancellationToken);
    }

    [HttpPost("liens/{kind}/{token}")]
    [Consumes("application/json")]
    public async Task<IActionResult> SetPassword(string kind, string token, [FromBody] NewPasswordInput body, CancellationToken cancellationToken)
    {
        if (Accounts.ParseKind(kind) is not { } k) return NotFound();
        await mediator.Send(new Accounts.SetPasswordCommand(k, token, body.Next, body.Confirm), cancellationToken);
        return NoContent();
    }
}
