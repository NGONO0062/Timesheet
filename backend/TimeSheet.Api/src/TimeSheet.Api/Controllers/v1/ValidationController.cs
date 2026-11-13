namespace TimeSheet.Api.Controllers.v1;

using Asp.Versioning;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using TimeSheet.Api.Domain.Timesheets;
using TimeSheet.Api.Domain.Timesheets.Features;

/// <summary>Décision groupée depuis la file : « VALIDATE » ou « REJECT » (motif commun obligatoire).</summary>
public sealed record GroupDecisionInput(IReadOnlyList<Guid>? Ids, string? Decision, string? Reason);

/// <summary>Décision depuis le détail : le rejet peut signaler des journées saisies.</summary>
public sealed record DecisionInput(string? Decision, string? Reason, IReadOnlyList<DateOnly>? Flagged);

/// <summary>File de validation et détail d'une fiche (jalon 3). Permission « Valider les fiches de son équipe ».</summary>
[ApiController]
[Route("api/v{v:apiVersion}/validation")]
[ApiVersion("1.0")]
public sealed class ValidationController(IMediator mediator) : ControllerBase
{
    /// <summary>File : filtres Personne et Période, onglet (SUBMITTED par défaut), comptes de chaque onglet.</summary>
    [HttpGet]
    public Task<QueueDto> Queue([FromQuery] Guid? personne, [FromQuery] string? periode, [FromQuery] string? statut, CancellationToken cancellationToken)
    {
        var tab = Enum.TryParse<QueueTab>(statut, ignoreCase: false, out var t) && Enum.IsDefined(t) ? t : QueueTab.SUBMITTED;
        return mediator.Send(new Validation.QueueQuery(personne, periode, tab), cancellationToken);
    }

    [HttpGet("{id:guid}")]
    public Task<ReviewDto> Review(Guid id, CancellationToken cancellationToken) => mediator.Send(new Validation.ReviewQuery(id), cancellationToken);

    [HttpPost("decisions")]
    [Consumes("application/json")]
    public Task<DecisionResult> Group([FromBody] GroupDecisionInput body, CancellationToken cancellationToken) =>
        mediator.Send(new Validation.DecideCommand(body.Ids ?? [], IsValidate(body.Decision), body.Reason, null, Single: false), cancellationToken);

    [HttpPost("{id:guid}/decision")]
    [Consumes("application/json")]
    public Task<DecisionResult> Single(Guid id, [FromBody] DecisionInput body, CancellationToken cancellationToken) =>
        mediator.Send(new Validation.DecideCommand([id], IsValidate(body.Decision), body.Reason, body.Flagged, Single: true), cancellationToken);

    private static bool IsValidate(string? decision) => decision switch
    {
        "VALIDATE" => true,
        "REJECT" => false,
        _ => throw new Exceptions.RuleException("decision"),
    };
}
