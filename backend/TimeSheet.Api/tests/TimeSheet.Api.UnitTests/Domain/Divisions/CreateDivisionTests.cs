namespace TimeSheet.Api.UnitTests.Domain.Divisions;

using TimeSheet.Api.SharedTestHelpers.Fakes.Division;
using TimeSheet.Api.Domain.Divisions;
using TimeSheet.Api.Domain.Divisions.DomainEvents;
using Bogus;
using FluentAssertions.Extensions;
using ValidationException = TimeSheet.Api.Exceptions.ValidationException;

public class CreateDivisionTests
{
    private readonly Faker _faker;

    public CreateDivisionTests()
    {
        _faker = new Faker();
    }
    
    [Fact]
    public void can_create_valid_division()
    {
        // Arrange
        var divisionToCreate = new FakeDivisionForCreation().Generate();
        
        // Act
        var division = Division.Create(divisionToCreate);

        // Assert
        division.Name.Should().Be(divisionToCreate.Name);
        division.Slug.Should().Be(divisionToCreate.Slug);
    }

    [Fact]
    public void queue_domain_event_on_create()
    {
        // Arrange
        var divisionToCreate = new FakeDivisionForCreation().Generate();
        
        // Act
        var division = Division.Create(divisionToCreate);

        // Assert
        division.DomainEvents.Count.Should().Be(1);
        division.DomainEvents.FirstOrDefault().Should().BeOfType(typeof(DivisionCreated));
    }
}