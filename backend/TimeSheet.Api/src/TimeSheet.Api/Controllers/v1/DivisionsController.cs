namespace TimeSheet.Api.Controllers.v1;

using TimeSheet.Api.Domain.Divisions.Features;
using TimeSheet.Api.Domain.Divisions.Dtos;
using TimeSheet.Api.Resources;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using System.Threading.Tasks;
using System.Threading;
using Asp.Versioning;
using MediatR;

[ApiController]
[Route("api/v{v:apiVersion}/divisions")]
[ApiVersion("1.0")]
public sealed class DivisionsController(IMediator mediator): ControllerBase
{    

    /// <summary>
    /// Gets a single Division by ID.
    /// </summary>
    [HttpGet("{divisionId:guid}", Name = "GetDivision")]
    public async Task<ActionResult<DivisionDto>> GetDivision(Guid divisionId)
    {
        var query = new GetDivision.Query(divisionId);
        var queryResponse = await mediator.Send(query);
        return Ok(queryResponse);
    }


    /// <summary>
    /// Gets a list of all Divisions.
    /// </summary>
    [HttpGet(Name = "GetDivisions")]
    public async Task<IActionResult> GetDivisions([FromQuery] DivisionParametersDto divisionParametersDto)
    {
        var query = new GetDivisionList.Query(divisionParametersDto);
        var queryResponse = await mediator.Send(query);

        var paginationMetadata = new
        {
            totalCount = queryResponse.TotalCount,
            pageSize = queryResponse.PageSize,
            currentPageSize = queryResponse.CurrentPageSize,
            currentStartIndex = queryResponse.CurrentStartIndex,
            currentEndIndex = queryResponse.CurrentEndIndex,
            pageNumber = queryResponse.PageNumber,
            totalPages = queryResponse.TotalPages,
            hasPrevious = queryResponse.HasPrevious,
            hasNext = queryResponse.HasNext
        };

        Response.Headers.Append("X-Pagination",
            JsonSerializer.Serialize(paginationMetadata));

        return Ok(queryResponse);
    }

    // endpoint marker - do not delete this comment
}
