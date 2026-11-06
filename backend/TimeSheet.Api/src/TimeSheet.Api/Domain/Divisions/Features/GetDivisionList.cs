namespace TimeSheet.Api.Domain.Divisions.Features;

using TimeSheet.Api.Domain.Divisions.Dtos;
using TimeSheet.Api.Databases;
using TimeSheet.Api.Exceptions;
using TimeSheet.Api.Resources;
using Mappings;
using Microsoft.EntityFrameworkCore;
using MediatR;
using QueryKit;
using QueryKit.Configuration;

public static class GetDivisionList
{
    public sealed record Query(DivisionParametersDto QueryParameters) : IRequest<PagedList<DivisionDto>>;

    public sealed class Handler(TimeSheetDbContext dbContext)
        : IRequestHandler<Query, PagedList<DivisionDto>>
    {
        public async Task<PagedList<DivisionDto>> Handle(Query request, CancellationToken cancellationToken)
        {
            var collection = dbContext.Divisions.AsNoTracking();

            var queryKitConfig = new CustomQueryKitConfiguration();
            var queryKitData = new QueryKitData()
            {
                Filters = request.QueryParameters.Filters,
                SortOrder = request.QueryParameters.SortOrder,
                Configuration = queryKitConfig
            };
            var appliedCollection = collection.ApplyQueryKit(queryKitData);
            var dtoCollection = appliedCollection.ToDivisionDtoQueryable();

            return await PagedList<DivisionDto>.CreateAsync(dtoCollection,
                request.QueryParameters.PageNumber,
                request.QueryParameters.PageSize,
                cancellationToken);
        }
    }
}