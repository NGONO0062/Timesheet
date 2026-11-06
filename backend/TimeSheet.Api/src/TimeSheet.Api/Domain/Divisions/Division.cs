namespace TimeSheet.Api.Domain.Divisions;

using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Destructurama.Attributed;
using TimeSheet.Api.Exceptions;
using TimeSheet.Api.Domain.Divisions.Models;
using TimeSheet.Api.Domain.Divisions.DomainEvents;


public class Division : BaseEntity
{
    [Required]
    public string Name { get; private set; }

    [Required]
    public string Slug { get; private set; }

    // Add Props Marker -- Deleting this comment will cause the add props utility to be incomplete


    public static Division Create(DivisionForCreation divisionForCreation)
    {
        var newDivision = new Division();

        newDivision.Name = divisionForCreation.Name;
        newDivision.Slug = divisionForCreation.Slug;

        newDivision.QueueDomainEvent(new DivisionCreated(){ Division = newDivision });
        
        return newDivision;
    }

    public Division Update(DivisionForUpdate divisionForUpdate)
    {
        Name = divisionForUpdate.Name;
        Slug = divisionForUpdate.Slug;

        QueueDomainEvent(new DivisionUpdated(){ Id = Id });
        return this;
    }

    // Add Prop Methods Marker -- Deleting this comment will cause the add props utility to be incomplete
    
    protected Division() { } // For EF + Mocking
}