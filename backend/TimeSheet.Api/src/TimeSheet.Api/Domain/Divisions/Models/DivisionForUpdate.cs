namespace TimeSheet.Api.Domain.Divisions.Models;

using Destructurama.Attributed;

public sealed record DivisionForUpdate
{
    public string Name { get; set; }
    public string Slug { get; set; }
}
