using Destructurama;
using Serilog;
using Hellang.Middleware.ProblemDetails;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Databases;
using TimeSheet.Api.Databases.Seed;
using TimeSheet.Api.Extensions.Application;
using TimeSheet.Api.Extensions.Services;
using TimeSheet.Api.Middleware;
using TimeSheet.Api.Services.Security;

var builder = WebApplication.CreateBuilder(args);
Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.WithProperty("ApplicationName", builder.Environment.ApplicationName)
    .Destructure.UsingAttributes()
    .CreateLogger();

builder.Host.UseSerilog();

// Une configuration dangereuse en production arrête tout, plutôt que de servir des liens
// faux ou une connexion sans mot de passe (revue de sécurité, point 85).
var problems = DemoProfiles.ProductionProblems(builder.Environment.IsProduction(), builder.Configuration["DEMO_PROFILES"], builder.Configuration["APP_URL"]);
if (problems.Count > 0) throw new InvalidOperationException($"Configuration refusée :\n- {string.Join("\n- ", problems)}");

builder.ConfigureServices();
var app = builder.Build();

// « dotnet run -- --seed » : migrations, puis données de démonstration ; « --seed-e2e » : division
// de test des tests de bout en bout, remise à zéro ; « --seed-fresh » : base des tests de bout en
// bout recréée (démonstration et division de test), seulement sur une base « *_e2e »
// (développement seulement).
if (args.Contains("--seed") || args.Contains("--seed-e2e") || args.Contains("--seed-fresh"))
{
    if (app.Environment.IsProduction()) throw new InvalidOperationException("Pas de données de démonstration en production.");
    var password = builder.Configuration["SEED_PASSWORD"];
    if (string.IsNullOrWhiteSpace(password)) throw new InvalidOperationException("SEED_PASSWORD est vide.");
    using var seedScope = app.Services.CreateScope();
    var db = seedScope.ServiceProvider.GetRequiredService<TimeSheetDbContext>();
    if (args.Contains("--seed-fresh"))
    {
        var database = db.Database.GetDbConnection().Database;
        if (!database.EndsWith("_e2e", StringComparison.Ordinal)) throw new InvalidOperationException($"--seed-fresh recrée la base : refusé sur « {database} » (base « *_e2e » attendue).");
        await db.Database.EnsureDeletedAsync();
        await db.Database.MigrateAsync();
        Console.WriteLine(await DemoSeed.RunAsync(db, password));
        Console.WriteLine(await E2eSeed.RunAsync(db, password));
        return;
    }
    await db.Database.MigrateAsync();
    Console.WriteLine(args.Contains("--seed-e2e") ? await E2eSeed.RunAsync(db, password) : await DemoSeed.RunAsync(db, password));
    return;
}

// « --admin-plateforme adresse "Prénom" "Nom" » : première mise en service, production comprise.
var adminIndex = Array.IndexOf(args, "--admin-plateforme");
if (adminIndex >= 0)
{
    using var adminScope = app.Services.CreateScope();
    var services = adminScope.ServiceProvider;
    var db = services.GetRequiredService<TimeSheetDbContext>();
    await db.Database.MigrateAsync();
    string? Arg(int i) => adminIndex + i < args.Length ? args[adminIndex + i] : null;
    Console.WriteLine(await PlatformAdmin.CreateAsync(db, services.GetRequiredService<TimeSheet.Api.Domain.Users.Features.IPasswordLinks>(),
        services.GetRequiredService<TimeSheet.Api.Services.Audit.IAuditWriter>(), builder.Configuration["APP_URL"] ?? "http://localhost:5173", Arg(1), Arg(2), Arg(3)));
    return;
}

// Adresse du client transmise par le proxy d'entrée (limitation des tentatives par poste).
// Le proxy doit remplacer l'en-tête reçu du client (docs/exploitation.md).
// Le proxy est un autre conteneur (pas le poste local) : le premier relais est cru, quelle que
// soit son adresse. L'application ne doit donc être joignable qu'à travers lui.
var forwarded = new ForwardedHeadersOptions { ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto, ForwardLimit = 1 };
forwarded.KnownIPNetworks.Clear();
forwarded.KnownProxies.Clear();
app.UseForwardedHeaders(forwarded);
app.UseSecurityHeaders();
if (!builder.Environment.IsDevelopment())
{
    app.UseHsts();
    app.UseHttpsRedirection();
}
app.UseProblemDetails();

app.UseSerilogRequestLogging();

// Image de production : l'interface (frontend/dist, copiée dans wwwroot) est servie par l'API,
// sur la même origine (cookie de session, pas de CORS). Les fichiers de /assets portent une
// empreinte dans leur nom : ils se gardent en cache ; index.html est relu à chaque fois.
var spa = Directory.Exists(Path.Combine(app.Environment.ContentRootPath, "wwwroot"));
if (spa)
{
    app.UseStaticFiles(new StaticFileOptions
    {
        OnPrepareResponse = ctx => ctx.Context.Response.Headers.CacheControl =
            ctx.Context.Request.Path.StartsWithSegments("/assets") ? "public, max-age=31536000, immutable" : "no-cache",
    });
}
app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();

app.MapHealthChecks("api/health").AllowAnonymous();
app.MapControllers();
// Toute adresse de l'interface (/saisie/2026/12…) rend index.html ; une adresse /api inconnue reste un 404.
if (spa)
{
    // Page publique : elle ne contient aucune donnée (l'API reste protégée, connexion comprise).
    app.MapFallbackToFile("index.html", new StaticFileOptions
    {
        OnPrepareResponse = ctx => ctx.Context.Response.Headers.CacheControl = "no-cache",
    }).AllowAnonymous();
    app.MapFallback("api/{**rest}", context =>
    {
        context.Response.StatusCode = StatusCodes.Status404NotFound;
        return Task.CompletedTask;
    }).AllowAnonymous();
}

app.UseSwaggerExtension(builder.Configuration, builder.Environment);

try
{
    Log.Information("Starting application");
    await app.RunAsync();
}
catch (Exception e)
{
    Log.Error(e, "The application failed to start correctly");
    throw;
}
finally
{
    Log.Information("Shutting down application");
    Log.CloseAndFlush();
}

// Make the implicit Program class public so the functional test project can access it
public partial class Program { }
