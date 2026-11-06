namespace TimeSheet.Api.SharedTestHelpers.Fakes.Division;

using AutoBogus;
using TimeSheet.Api.Domain.Divisions;
using TimeSheet.Api.Domain.Divisions.Models;

public sealed class FakeDivisionForCreation : AutoFaker<DivisionForCreation>
{
    public FakeDivisionForCreation()
    {
    }
}