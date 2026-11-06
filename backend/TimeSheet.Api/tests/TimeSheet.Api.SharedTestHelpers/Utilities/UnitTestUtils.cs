namespace TimeSheet.Api.SharedTestHelpers.Utilities;

using Npgsql;

/// <summary>
/// Bases de test sur un PostgreSQL déjà lancé (pas de Docker sur les postes de développement).
/// Serveur : TIMESHEET_TEST_DB, sinon le PostgreSQL local de développement.
/// </summary>
public static class TestDatabase
{
    private const string LocalServer = "Host=localhost;Port=5432;Username=timesheet;Password=timesheet";

    public static string ConnectionString(string database)
    {
        var server = Environment.GetEnvironmentVariable("TIMESHEET_TEST_DB") ?? LocalServer;
        return new NpgsqlConnectionStringBuilder(server) { Database = database }.ConnectionString;
    }
}
