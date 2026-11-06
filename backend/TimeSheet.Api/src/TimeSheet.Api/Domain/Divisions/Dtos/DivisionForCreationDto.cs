namespace TimeSheet.Api.Domain.Divisions.Dtos;

using Destructurama.Attributed;

public sealed record DivisionForCreationDto
{
    public string Name { get; set; }
    public string Slug { get; set; }
}
