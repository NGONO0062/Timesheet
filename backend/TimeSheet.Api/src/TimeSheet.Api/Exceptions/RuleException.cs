namespace TimeSheet.Api.Exceptions;

/// <summary>
/// Règle métier refusée. Le code (« futureWeek », « notEditable », « incomplete »…) est
/// renvoyé tel quel (422) ; l'interface l'affiche avec ses propres textes.
/// </summary>
public sealed class RuleException(string code) : Exception($"Règle refusée : {code}")
{
    public string Code { get; } = code;
}
