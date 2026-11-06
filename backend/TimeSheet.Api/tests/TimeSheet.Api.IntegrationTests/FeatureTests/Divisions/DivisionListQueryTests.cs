namespace TimeSheet.Api.IntegrationTests.FeatureTests.Divisions;

using TimeSheet.Api.Domain.Divisions.Dtos;
using TimeSheet.Api.SharedTestHelpers.Fakes.Division;
using TimeSheet.Api.Domain.Divisions.Features;
using Domain;
using System.Threading.Tasks;

public class DivisionListQueryTests : TestBase
{
    
    [Fact]
    public async Task can_get_division_list()
    {
        // Arrange
        var testingServiceScope = new TestingServiceScope();
        var divisionOne = new FakeDivisionBuilder().Build();
        var divisionTwo = new FakeDivisionBuilder().Build();
        var queryParameters = new DivisionParametersDto();

        await testingServiceScope.InsertAsync(divisionOne, divisionTwo);

        // Act
        var query = new GetDivisionList.Query(queryParameters);
        var divisions = await testingServiceScope.SendAsync(query);

        // Assert
        divisions.Count.Should().BeGreaterThanOrEqualTo(2);
    }
}