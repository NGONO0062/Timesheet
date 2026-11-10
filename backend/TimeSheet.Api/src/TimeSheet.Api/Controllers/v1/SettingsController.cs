namespace TimeSheet.Api.Controllers.v1;

using Asp.Versioning;
using MediatR;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Mvc;
using TimeSheet.Api.Domain.Users.Features;

public sealed record HoursInput(string? Arrival, string? Departure);

public sealed record NotificationInput(bool Enabled);

public sealed record PreferencesInput(string? Locale, string? DefaultSignatureMode);

/// <summary>Écran 14 (jalon 6) : le compte de l'utilisateur connecté seulement, tous rôles.</summary>
[ApiController]
[Route("api/v{v:apiVersion}/parametres")]
[ApiVersion("1.0")]
public sealed class SettingsController(IMediator mediator) : ControllerBase
{
    [HttpGet]
    public Task<SettingsDto> Get(CancellationToken cancellationToken) => mediator.Send(new MySettings.Query(), cancellationToken);

    [HttpPut("horaires")]
    [Consumes("application/json")]
    public async Task<IActionResult> Hours([FromBody] HoursInput body, CancellationToken cancellationToken)
    {
        await mediator.Send(new MySettings.HoursCommand(body.Arrival, body.Departure), cancellationToken);
        return NoContent();
    }

    /// <summary>Renvoie l'ancienne valeur, pour « Annuler ».</summary>
    [HttpPut("notifications/{kind}")]
    [Consumes("application/json")]
    public async Task<object> Notification(string kind, [FromBody] NotificationInput body, CancellationToken cancellationToken) =>
        new { previous = await mediator.Send(new MySettings.NotificationCommand(kind, body.Enabled), cancellationToken) };

    [HttpPut("preferences")]
    [Consumes("application/json")]
    public async Task<IActionResult> Preferences([FromBody] PreferencesInput body, CancellationToken cancellationToken)
    {
        await mediator.Send(new MySettings.PreferencesCommand(body.Locale, body.DefaultSignatureMode), cancellationToken);
        return NoContent();
    }

    /// <summary>Toutes les sessions du compte sont fermées, celle-ci comprise : retour à la connexion.</summary>
    [HttpPost("mot-de-passe")]
    [Consumes("application/json")]
    public async Task<IActionResult> Password([FromBody] PasswordInput body, CancellationToken cancellationToken)
    {
        await mediator.Send(new MySettings.PasswordCommand(body), cancellationToken);
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return NoContent();
    }
}
