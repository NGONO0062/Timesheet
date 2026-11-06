namespace TimeSheet.Api.Domain.Divisions.DomainEvents;

public sealed class DivisionUpdated : DomainEvent
{
    public Guid Id { get; set; } 
}
            