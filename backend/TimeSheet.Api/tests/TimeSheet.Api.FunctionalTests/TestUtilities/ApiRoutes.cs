namespace TimeSheet.Api.FunctionalTests.TestUtilities;

public class ApiRoutes
{
    public const string Base = "api";
    public const string Health = Base + "/health";

    public static class Auth
    {
        public static string Login(string version = "v1") => $"{Base}/{version}/auth/connexion";
        public static string Logout(string version = "v1") => $"{Base}/{version}/auth/deconnexion";
        public static string Me(string version = "v1") => $"{Base}/{version}/auth/moi";
    }
}
