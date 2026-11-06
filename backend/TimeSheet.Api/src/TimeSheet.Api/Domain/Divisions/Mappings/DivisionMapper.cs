namespace TimeSheet.Api.Domain.Divisions.Mappings;

using TimeSheet.Api.Domain.Divisions.Dtos;
using TimeSheet.Api.Domain.Divisions.Models;
using Riok.Mapperly.Abstractions;

[Mapper]
public static partial class DivisionMapper
{
    public static partial DivisionForCreation ToDivisionForCreation(this DivisionForCreationDto divisionForCreationDto);
    public static partial DivisionForUpdate ToDivisionForUpdate(this DivisionForUpdateDto divisionForUpdateDto);
    public static partial DivisionDto ToDivisionDto(this Division division);
    public static partial IQueryable<DivisionDto> ToDivisionDtoQueryable(this IQueryable<Division> division);
}