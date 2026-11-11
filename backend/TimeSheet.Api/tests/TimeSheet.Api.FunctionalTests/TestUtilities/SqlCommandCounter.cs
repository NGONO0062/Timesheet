namespace TimeSheet.Api.FunctionalTests.TestUtilities;

using System.Data.Common;
using Microsoft.EntityFrameworkCore.Diagnostics;

/// <summary>
/// Compte les requêtes SQL envoyées par l'API pendant un test, pour vérifier qu'un écran ne
/// multiplie pas les lectures. Les tests fonctionnels s'exécutent l'un après l'autre.
/// </summary>
public sealed class SqlCommandCounter : DbCommandInterceptor
{
    private static int _count;

    public static int Count => Volatile.Read(ref _count);

    public static void Reset() => Interlocked.Exchange(ref _count, 0);

    public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(DbCommand command, CommandEventData eventData, InterceptionResult<DbDataReader> result, CancellationToken cancellationToken = default)
    {
        Interlocked.Increment(ref _count);
        return base.ReaderExecutingAsync(command, eventData, result, cancellationToken);
    }

    public override InterceptionResult<DbDataReader> ReaderExecuting(DbCommand command, CommandEventData eventData, InterceptionResult<DbDataReader> result)
    {
        Interlocked.Increment(ref _count);
        return base.ReaderExecuting(command, eventData, result);
    }
}
