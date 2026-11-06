namespace TimeSheet.Api.Middleware;

/// <summary>
/// En-têtes de sécurité sur toutes les réponses (revue du 6 novembre 2026, point 85) :
/// jamais affichée dans une page d'un autre site, pas de devinette de type, référent limité.
/// </summary>
public static class SecurityHeaders
{
    public static IApplicationBuilder UseSecurityHeaders(this IApplicationBuilder app) =>
        app.Use(async (context, next) =>
        {
            var headers = context.Response.Headers;
            headers["X-Frame-Options"] = "DENY";
            headers["Content-Security-Policy"] = "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'";
            headers["X-Content-Type-Options"] = "nosniff";
            headers["Referrer-Policy"] = "same-origin";
            headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=()";
            await next();
        });
}
