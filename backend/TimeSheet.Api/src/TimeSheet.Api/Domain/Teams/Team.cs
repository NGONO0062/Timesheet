namespace TimeSheet.Api.Domain.Teams;

/// <summary>Équipe d'une division, animée par un manager (vue consolidée, écran 11).</summary>
public class Team : BaseEntity
{
    public Guid DivisionId { get; private set; }
    public string Name { get; private set; } = "";
    public Guid? ManagerId { get; private set; }

    public static Team Create(Guid divisionId, string name, Guid? managerId) => new() { DivisionId = divisionId, Name = name.Trim(), ManagerId = managerId };

    protected Team() { } // EF
}
