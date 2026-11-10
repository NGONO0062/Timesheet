namespace TimeSheet.Api.Extensions.Services;

using TimeSheet.Api.Middleware;
using TimeSheet.Api.Services;
using Resources;
using System.Text.Json.Serialization;
using Serilog;
using FluentValidation.AspNetCore;
using Hellang.Middleware.ProblemDetails;
using Hellang.Middleware.ProblemDetails.Mvc;
using MediatR;
using Microsoft.Extensions.DependencyInjection;
using Resources;
using System.Reflection;
using System.Text.Json;
using System.Text.RegularExpressions;

public static class WebAppServiceConfiguration
{
    public static void ConfigureServices(this WebApplicationBuilder builder)
    {
        builder.Services.Configure<TimeSheetApiOptions>(builder.Configuration.GetSection(TimeSheetApiOptions.SectionName));

        // Horloge de l'application : TIMESHEET_NOW en démonstration, l'heure réelle sinon.
        builder.Services.AddSingleton<TimeProvider>(new AppClock(builder.Configuration["TIMESHEET_NOW"]));
        builder.Services.AddSingleton(Log.Logger);
        // Impression PDF : un Chromium pour toute l'API (Services/Export/PdfPrinter.cs).
        builder.Services.AddSingleton<TimeSheet.Api.Services.Export.IPdfPrinter, TimeSheet.Api.Services.Export.PdfPrinter>();
        builder.Services.AddProblemDetails(ProblemDetailsConfigurationExtension.ConfigureProblemDetails)
            .AddProblemDetailsConventions();

        // Pas de CORS : l'interface est servie par le même hôte (/api relayé), les cookies restent SameSite=Strict.
        builder.Services.AddCookieSession(builder.Environment);
        builder.Services.AddInfrastructure(builder.Environment, builder.Configuration);

        builder.Services.AddControllers()
            .AddJsonOptions(o => o.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles);
        builder.Services.AddApiVersioningExtension();

        builder.Services.AddHttpContextAccessor();
        builder.Services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(Assembly.GetExecutingAssembly()));

        // registers all services that inherit from your base service interface - ITimeSheetApiScopedService
        builder.Services.AddBoundaryServices(Assembly.GetExecutingAssembly());

        builder.Services.AddMvc();

        builder.Services.AddHealthChecks();
        builder.Services.AddSwaggerExtension(builder.Configuration);
    }

    /// <summary>
    /// Registers all services in the assembly of the given interface.
    /// </summary>
    private static void AddBoundaryServices(this IServiceCollection services, params Assembly[] assemblies)
    {
        if (!assemblies.Any())
            throw new ArgumentException("No assemblies found to scan. Supply at least one assembly to scan for handlers.");

        foreach (var assembly in assemblies)
        {
            var rules = assembly.GetTypes()
                .Where(x => !x.IsAbstract && x.IsClass && x.GetInterface(nameof(ITimeSheetApiScopedService)) == typeof(ITimeSheetApiScopedService));

            foreach (var rule in rules)
            {
                foreach (var @interface in rule.GetInterfaces())
                {
                    services.Add(new ServiceDescriptor(@interface, rule, ServiceLifetime.Scoped));
                }
            }
        }
    }
}