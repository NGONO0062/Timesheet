namespace TimeSheet.Api.Domain.Divisions.Dtos;

using Destructurama.Attributed;

public sealed record DivisionDto
{
    public Guid Id { get; set; }
    public string Name { get; set; }
    public string Slug { get; set; }
}
