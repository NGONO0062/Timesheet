namespace TimeSheet.Api.Controllers.v1;

using System.Security.Cryptography;
using System.Text;
using Asp.Versioning;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TimeSheet.Api.Domain.Timesheets.Features;

/// <summary>
/// Tâches planifiées (reprises de app/api/taches) : appelées par le planificateur de l'hébergement
/// avec « Authorization: Bearer $TASKS_SECRET ». Sans secret d'au moins 32 caractères, tout est refusé.
/// </summary>
[ApiController]
[AllowAnonymous]
[Route("api/v{v:apiVersion}/taches")]
[ApiVersion("1.0")]
public sealed class TasksController(IMediator mediator, IConfiguration configuration) : ControllerBase
{
    /// <summary>
    /// Relance du validateur (PROMPT.md §9.3), chaque jour ouvré :
    /// <c>curl -X POST -H "Authorization: Bearer $TASKS_SECRET" https://…/api/v1/taches/relances</c>
    /// </summary>
    [HttpPost("relances")]
    public async Task<IActionResult> Reminders(CancellationToken cancellationToken)
    {
        if (!Authorized()) return Unauthorized();
        return Ok(new { relances = await mediator.Send(new Validation.RemindersCommand(), cancellationToken) });
    }

    /// <summary>
    /// Rappel de saisie (préférence de l'écran 14), le vendredi à 12:00 :
    /// <c>curl -X POST -H "Authorization: Bearer $TASKS_SECRET" https://…/api/v1/taches/rappels-saisie</c>
    /// </summary>
    [HttpPost("rappels-saisie")]
    public async Task<IActionResult> FillReminders(CancellationToken cancellationToken)
    {
        if (!Authorized()) return Unauthorized();
        return Ok(new { rappels = await mediator.Send(new FillReminders.Command(), cancellationToken) });
    }

    /// <summary>Comparaison en temps constant, sur les empreintes : même longueur quelle que soit l'entrée.</summary>
    private bool Authorized()
    {
        var secret = configuration["TASKS_SECRET"] ?? "";
        if (secret.Length < 32) return false;
        var header = Request.Headers.Authorization.ToString();
        var given = header.StartsWith("Bearer ", StringComparison.Ordinal) ? header["Bearer ".Length..] : "";
        return CryptographicOperations.FixedTimeEquals(SHA256.HashData(Encoding.UTF8.GetBytes(given)), SHA256.HashData(Encoding.UTF8.GetBytes(secret)));
    }
}
