namespace TimeSheet.Api.IntegrationTests.FeatureTests.Divisions;

using TimeSheet.Api.SharedTestHelpers.Fakes.Division;
using TimeSheet.Api.Domain.Divisions.Features;
using Domain;
using FluentAssertions.Extensions;
using Microsoft.EntityFrameworkCore;
using System.Threading.Tasks;

public class DivisionQueryTests : TestBase
{
    [Fact]
    public async Task can_get_existing_division_with_accurate_props()
    {
        // Arrange
        var testingServiceScope = new TestingServiceScope();
        var divisionOne = new FakeDivisionBuilder().Build();
        await testingServiceScope.InsertAsync(divisionOne);

        // Act
        var query = new GetDivision.Query(divisionOne.Id);
        var division = await testingServiceScope.SendAsync(query);

        // Assert
        division.Name.Should().Be(divisionOne.Name);
        division.Slug.Should().Be(divisionOne.Slug);
    }

    [Fact]
    public async Task get_division_throws_notfound_exception_when_record_does_not_exist()
    {
        // Arrange
        var testingServiceScope = new TestingServiceScope();
        var badId = Guid.NewGuid();

        // Act
        var query = new GetDivision.Query(badId);
        Func<Task> act = () => testingServiceScope.SendAsync(query);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>();
    }
}