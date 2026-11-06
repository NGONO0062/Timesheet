namespace TimeSheet.Api.Domain.Divisions.Features;

using TimeSheet.Api.Domain.Divisions.Dtos;
using TimeSheet.Api.Databases;
using TimeSheet.Api.Exceptions;
using Mappings;
using MediatR;
using Microsoft.EntityFrameworkCore;

public static class GetDivision
{
    public sealed record Query(Guid DivisionId) : IRequest<DivisionDto>;

    public sealed class Handler(TimeSheetDbContext dbContext)
        : IRequestHandler<Query, DivisionDto>
    {
        public async Task<DivisionDto> Handle(Query request, CancellationToken cancellationToken)
        {
            var result = await dbContext.Divisions
                .AsNoTracking()
                .GetById(request.DivisionId, cancellationToken);
            return result.ToDivisionDto();
        }
    }
}