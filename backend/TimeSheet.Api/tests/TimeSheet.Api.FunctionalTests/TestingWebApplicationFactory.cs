namespace TimeSheet.Api.FunctionalTests;

using TimeSheet.Api.Resources;
using TimeSheet.Api.SharedTestHelpers.Utilities;
using Resources;
using TimeSheet.Api.Databases;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using System.Reflection;
using Microsoft.Extensions.Logging;
using Xunit;
using static Resources.TimeSheetApiOptions;

[CollectionDefinition(nameof(TestBase))]
public class TestingWebApplicationFactoryCollection : ICollectionFixture<TestingWebApplicationFactory> { }

public class TestingWebApplicationFactory : WebApplicationFactory<Program>, IAsyncLifetime
{

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment(Consts.Testing.FunctionalTestingEnvName);
        builder.ConfigureLogging(logging =>
        {
            logging.ClearProviders();
        });
        
        builder.ConfigureAppConfiguration(configurationBuilder =>
        {
            var functionalConfig = new ConfigurationBuilder()
                .AddJsonFile("appsettings.json")
                .AddEnvironmentVariables()
                .Build();
            configurationBuilder.AddConfiguration(functionalConfig);
            configurationBuilder.AddInMemoryCollection(new Dictionary<string, string?> { ["TASKS_SECRET"] = TestUtilities.RecordingMailSender.TasksSecret });
        });

        // Aucun e-mail ne part pendant les tests : ils sont gardés pour être vérifiés.
        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<TimeSheet.Api.Services.Mail.IMailSender>();
            services.AddSingleton<TimeSheet.Api.Services.Mail.IMailSender, TestUtilities.RecordingMailSender>();
        });
    }

    public async Task InitializeAsync()
    {
        // Base dédiée sur le PostgreSQL local, recréée à chaque lancement.
        var connectionString = TestDatabase.ConnectionString("timesheet_api_functional");
        var options = new DbContextOptionsBuilder<TimeSheetDbContext>().UseNpgsql(connectionString).Options;
        await using (var context = new TimeSheetDbContext(options, null, null, null))
        {
            await context.Database.EnsureDeletedAsync();
            await context.Database.MigrateAsync();
        }
        Environment.SetEnvironmentVariable($"{ConnectionStringOptions.SectionName.Replace(":", "__")}__{ConnectionStringOptions.TimeSheetApiKey}", connectionString);
    }

    public new Task DisposeAsync() => Task.CompletedTask;
}