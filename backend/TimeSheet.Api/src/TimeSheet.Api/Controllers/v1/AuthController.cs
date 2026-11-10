namespace TimeSheet.Api.Controllers.v1;

using System.Security.Claims;
using Asp.Versioning;
using MediatR;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TimeSheet.Api.Domain.Access;
using TimeSheet.Api.Domain.Access.Features;
using TimeSheet.Api.Services.Access;
using TimeSheet.Api.Services.Audit;
using TimeSheet.Api.Services.Security;

/// <summary>Utilisateur connecté, tel que l'interface le voit.</summary>
public sealed record ViewerDto(Guid UserId, string FirstName, string LastName, string Email, string Role, Guid? DivisionId, string? DivisionName, string[] Permissions, bool IsIntern, string DefaultSignatureMode)
{
    public static ViewerDto From(Viewer v) =>
        new(v.UserId, v.FirstName, v.LastName, v.Email, v.Role.ToString(), v.DivisionId, v.DivisionName, v.Permissions.Select(p => p.ToString()).Order().ToArray(), v.IsIntern, v.DefaultSignatureMode);
}

public sealed record SignInRequest(string? Email, string? Password);

public sealed record DemoSignInRequest(string? Email);

/// <summary>« identifiants » ou « tentatives » : l'écran ne dit jamais lequel des deux champs est faux.</summary>
public sealed record SignInError(string Error);

[ApiController]
[Route("api/v{v:apiVersion}/auth")]
[ApiVersion("1.0")]
public sealed class AuthController(IMediator mediator, IViewerAccessor viewers, IAuditWriter audit, IConfiguration configuration, IWebHostEnvironment env) : ControllerBase
{
    private bool DemoAllowed => DemoProfiles.Allowed(env.IsProduction(), configuration["DEMO_PROFILES"], configuration["APP_URL"]);

    /// <summary>Connexion par e-mail et mot de passe.</summary>
    [AllowAnonymous]
    [HttpPost("connexion")]
    [Consumes("application/json")]
    public async Task<IActionResult> SignIn([FromBody] SignInRequest body, CancellationToken cancellationToken)
    {
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "inconnue";
        var result = await mediator.Send(new SignIn.Command(body.Email ?? "", body.Password ?? "", ip), cancellationToken);
        return await Complete(result, cancellationToken);
    }

    /// <summary>Prototype uniquement : entrer avec un profil de démonstration.</summary>
    [AllowAnonymous]
    [HttpPost("connexion-demo")]
    [Consumes("application/json")]
    public async Task<IActionResult> SignInAsDemo([FromBody] DemoSignInRequest body, CancellationToken cancellationToken)
    {
        if (!DemoAllowed) return NotFound();
        var result = await mediator.Send(new SignIn.DemoCommand(body.Email ?? ""), cancellationToken);
        return await Complete(result, cancellationToken);
    }

    /// <summary>Profils proposés sur l'écran de connexion ; liste vide hors démonstration.</summary>
    [AllowAnonymous]
    [HttpGet("profils-demo")]
    public IActionResult DemoAccounts() => Ok(DemoAllowed ? DemoProfiles.Accounts : []);

    /// <summary>Utilisateur connecté ; 401 sans session valide.</summary>
    [HttpGet("moi")]
    public async Task<ActionResult<ViewerDto>> Me(CancellationToken cancellationToken) => ViewerDto.From(await viewers.RequireAsync(cancellationToken));

    [HttpPost("deconnexion")]
    public async Task<IActionResult> SignOut(CancellationToken cancellationToken)
    {
        var viewer = await viewers.RequireAsync(cancellationToken);
        await audit.AppendAsync("LOGOUT", viewer.FullName, viewer.Email, AuditResult.SUCCESS, viewer.UserId, viewer.DivisionId, cancellationToken: cancellationToken);
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return NoContent();
    }

    private async Task<IActionResult> Complete(SignIn.Result result, CancellationToken cancellationToken)
    {
        if (result.Outcome != Domain.Access.Features.SignIn.Outcome.Success)
            return Unauthorized(new SignInError(result.Outcome == Domain.Access.Features.SignIn.Outcome.TooManyAttempts ? "tentatives" : "identifiants"));

        var identity = new ClaimsIdentity(
            [new Claim(ClaimTypes.NameIdentifier, result.UserId.ToString()), new Claim(ViewerAccessor.SessionVersionClaim, result.SessionVersion.ToString())],
            CookieAuthenticationDefaults.AuthenticationScheme);
        var principal = new ClaimsPrincipal(identity);
        await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, principal);
        var viewer = await viewers.FindAsync(principal, cancellationToken);
        return viewer is null ? Unauthorized(new SignInError("identifiants")) : Ok(ViewerDto.From(viewer));
    }
}
