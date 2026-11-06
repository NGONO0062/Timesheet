namespace TimeSheet.Api.Domain.Divisions.DomainEvents;

public sealed class DivisionCreated : DomainEvent
{
    public Division Division { get; set; } 
}
            