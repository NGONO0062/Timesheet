namespace TimeSheet.Api.Domain.Divisions.Dtos;

using Destructurama.Attributed;

public sealed record DivisionForUpdateDto
{
    public string Name { get; set; }
    public string Slug { get; set; }
}
