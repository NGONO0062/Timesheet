namespace TimeSheet.Api.IntegrationTests;

using TimeSheet.Api.Extensions.Services;
using TimeSheet.Api.Databases;
using TimeSheet.Api.Resources;
using TimeSheet.Api.SharedTestHelpers.Utilities;
using Resources;
using FluentAssertions;
using FluentAssertions.Extensions;
using Hangfire;
using NSubstitute;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Xunit;
using static Resources.TimeSheetApiOptions;

[CollectionDefinition(nameof(TestFixture))]
public class TestFixtureCollection : ICollectionFixture<TestFixture> {}

public class TestFixture : IAsyncLifetime
{
    public static IServiceScopeFactory BaseScopeFactory;

    public async Task InitializeAsync()
    {
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions
        {
            EnvironmentName = Consts.Testing.IntegrationTestingEnvName
        });

        // Base dédiée sur le PostgreSQL local (pas de Docker sur les postes) : recréée à chaque lancement.
        var connectionString = TestDatabase.ConnectionString("timesheet_api_integration");
        builder.Configuration.GetSection(ConnectionStringOptions.SectionName)[ConnectionStringOptions.TimeSheetApiKey] = connectionString;
        await RunMigration(connectionString);

        builder.ConfigureServices();
        var services = builder.Services;

        // add any mock services here
        services.ReplaceServiceWithSingletonMock<IHttpContextAccessor>();
        services.ReplaceServiceWithSingletonMock<IBackgroundJobClient>();

        var provider = services.BuildServiceProvider();
        BaseScopeFactory = provider.GetService<IServiceScopeFactory>();
    }

    private static async Task RunMigration(string connectionString)
    {
        var options = new DbContextOptionsBuilder<TimeSheetDbContext>()
            .UseNpgsql(connectionString)
            .Options;
        var context = new TimeSheetDbContext(options, null, null, null);
        await context.Database.EnsureDeletedAsync();
        await context.Database.MigrateAsync();
    }

    public Task DisposeAsync() => Task.CompletedTask;
}

public static class ServiceCollectionServiceExtensions
{
    public static IServiceCollection ReplaceServiceWithSingletonMock<TService>(this IServiceCollection services)
        where TService : class
    {
        services.RemoveAll(typeof(TService));
        services.AddSingleton(_ => Substitute.For<TService>());
        return services;
    }
}