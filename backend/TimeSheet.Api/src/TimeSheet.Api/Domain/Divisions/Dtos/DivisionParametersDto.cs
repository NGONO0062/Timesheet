namespace TimeSheet.Api.Domain.Divisions.Dtos;

using TimeSheet.Api.Resources;

public sealed class DivisionParametersDto : BasePaginationParameters
{
    public string? Filters { get; set; }
    public string? SortOrder { get; set; }
}
