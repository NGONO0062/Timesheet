namespace TimeSheet.Api.UnitTests.Domain.Divisions;

using TimeSheet.Api.SharedTestHelpers.Fakes.Division;
using TimeSheet.Api.Domain.Divisions;
using TimeSheet.Api.Domain.Divisions.DomainEvents;
using Bogus;
using FluentAssertions.Extensions;
using ValidationException = TimeSheet.Api.Exceptions.ValidationException;

public class UpdateDivisionTests
{
    private readonly Faker _faker;

    public UpdateDivisionTests()
    {
        _faker = new Faker();
    }
    
    [Fact]
    public void can_update_division()
    {
        // Arrange
        var division = new FakeDivisionBuilder().Build();
        var updatedDivision = new FakeDivisionForUpdate().Generate();
        
        // Act
        division.Update(updatedDivision);

        // Assert
        division.Name.Should().Be(updatedDivision.Name);
        division.Slug.Should().Be(updatedDivision.Slug);
    }
    
    [Fact]
    public void queue_domain_event_on_update()
    {
        // Arrange
        var division = new FakeDivisionBuilder().Build();
        var updatedDivision = new FakeDivisionForUpdate().Generate();
        division.DomainEvents.Clear();
        
        // Act
        division.Update(updatedDivision);

        // Assert
        division.DomainEvents.Count.Should().Be(1);
        division.DomainEvents.FirstOrDefault().Should().BeOfType(typeof(DivisionUpdated));
    }
}