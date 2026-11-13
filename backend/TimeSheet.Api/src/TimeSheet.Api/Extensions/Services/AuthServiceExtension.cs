namespace TimeSheet.Api.Extensions.Services;

using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.DataProtection;
using TimeSheet.Api.Services.Access;

public static class AuthServiceExtension
{
    public const string CookieName = "timesheet.session";

    /// <summary>
    /// Session par cookie (PROMPT.md §16) : HttpOnly, SameSite=Strict, Secure en production,
    /// 8 heures. Le cookie ne porte que l'identifiant et le numéro de session ; le compte est
    /// relu à chaque requête. Toute route exige une session, sauf celles marquées [AllowAnonymous].
    /// </summary>
    public static void AddCookieSession(this IServiceCollection services, IWebHostEnvironment env)
    {
        services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
            .AddCookie(options =>
            {
                options.Cookie.Name = CookieName;
                options.Cookie.HttpOnly = true;
                options.Cookie.SameSite = SameSiteMode.Strict;
                options.Cookie.SecurePolicy = env.IsProduction() ? CookieSecurePolicy.Always : CookieSecurePolicy.SameAsRequest;
                options.ExpireTimeSpan = TimeSpan.FromHours(8);
                options.SlidingExpiration = false;
                // Une API répond par un code, jamais par une redirection vers une page de connexion.
                options.Events.OnRedirectToLogin = ctx =>
                {
                    ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
                    return Task.CompletedTask;
                };
                options.Events.OnRedirectToAccessDenied = ctx =>
                {
                    ctx.Response.StatusCode = StatusCodes.Status404NotFound;
                    return Task.CompletedTask;
                };
                // Compte désactivé, division suspendue, mot de passe changé : la session tombe tout de suite.
                options.Events.OnValidatePrincipal = async ctx =>
                {
                    var viewers = ctx.HttpContext.RequestServices.GetRequiredService<IViewerAccessor>();
                    if (await viewers.FindAsync(ctx.Principal) is null)
                    {
                        ctx.RejectPrincipal();
                        await ctx.HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
                    }
                };
            });

        services.AddAuthorization(options =>
        {
            options.FallbackPolicy = new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build();
        });
    }

    /// <summary>
    /// Clés qui signent les cookies de session : gardées sur disque, pour qu'un redémarrage ou une
    /// nouvelle version ne déconnecte personne, et partagées si plusieurs instances tournent.
    /// <c>DATA_PROTECTION_DIR</c>, sinon « cles-session » dans <c>STORAGE_DIR</c> (volume sauvegardé).
    /// Ce dossier est un secret : accès réservé à l'application.
    /// </summary>
    public static void AddSessionKeys(this IServiceCollection services, IConfiguration configuration, IWebHostEnvironment env)
    {
        var storage = configuration["STORAGE_DIR"] is { Length: > 0 } dir ? dir : Path.Combine(env.ContentRootPath, "storage");
        var keys = configuration["DATA_PROTECTION_DIR"] is { Length: > 0 } explicitDir ? explicitDir : Path.Combine(storage, "cles-session");
        services.AddDataProtection().SetApplicationName("TimeSheet").PersistKeysToFileSystem(new DirectoryInfo(keys));
    }
}
