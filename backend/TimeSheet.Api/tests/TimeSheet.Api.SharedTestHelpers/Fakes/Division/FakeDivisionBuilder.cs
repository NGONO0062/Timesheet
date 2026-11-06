namespace TimeSheet.Api.SharedTestHelpers.Fakes.Division;

using TimeSheet.Api.Domain.Divisions;
using TimeSheet.Api.Domain.Divisions.Models;

public class FakeDivisionBuilder
{
    private DivisionForCreation _creationData = new FakeDivisionForCreation().Generate();

    public FakeDivisionBuilder WithModel(DivisionForCreation model)
    {
        _creationData = model;
        return this;
    }
    
    public FakeDivisionBuilder WithName(string name)
    {
        _creationData.Name = name;
        return this;
    }
    
    public FakeDivisionBuilder WithSlug(string slug)
    {
        _creationData.Slug = slug;
        return this;
    }
    
    public Division Build()
    {
        var result = Division.Create(_creationData);
        return result;
    }
}