namespace TimeSheet.Api.Extensions.Services;

using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
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
}
