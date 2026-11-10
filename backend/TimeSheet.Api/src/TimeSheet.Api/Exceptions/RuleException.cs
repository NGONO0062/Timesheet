namespace TimeSheet.Api.Exceptions;

/// <summary>
/// Règle métier refusée. Le code (« futureWeek », « notEditable », « incomplete »…) est
/// renvoyé tel quel (422) ; l'interface l'affiche avec ses propres textes. <c>Fields</c> :
/// champs en erreur d'un formulaire (« invalid »), <c>Detail</c> : valeur utile au message
/// (le nom d'une activité, par exemple).
/// </summary>
public sealed class RuleException(string code, IReadOnlyList<string>? fields = null, string? detail = null) : Exception($"Règle refusée : {code}")
{
    public string Code { get; } = code;
    public IReadOnlyList<string> Fields { get; } = fields ?? [];
    public string? Detail { get; } = detail;
}
