namespace TimeSheet.Api.SharedTestHelpers.Fakes.Division;

using AutoBogus;
using TimeSheet.Api.Domain.Divisions;
using TimeSheet.Api.Domain.Divisions.Dtos;

public sealed class FakeDivisionForUpdateDto : AutoFaker<DivisionForUpdateDto>
{
    public FakeDivisionForUpdateDto()
    {
    }
}