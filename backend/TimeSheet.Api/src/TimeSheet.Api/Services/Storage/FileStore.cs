namespace TimeSheet.Api.Services.Storage;

using System.Text.RegularExpressions;

public interface IFileStore : ITimeSheetApiScopedService
{
    Task WriteAsync(string relative, byte[] bytes, CancellationToken cancellationToken = default);

    /// <summary>Contenu du fichier, ou null s'il n'existe pas.</summary>
    Task<byte[]?> ReadAsync(string relative, CancellationToken cancellationToken = default);
}

/// <summary>
/// Fichiers produits par l'application (PDF signés), repris de lib/storage.ts : dans
/// <c>STORAGE_DIR</c> (par défaut « storage » à côté de l'API), jamais servis directement — seule
/// une route qui vérifie les droits les lit.
/// </summary>
public sealed partial class FileStore(IConfiguration configuration, IHostEnvironment environment) : IFileStore
{
    [GeneratedRegex("^[A-Za-z0-9_\\-/.]+$")]
    private static partial Regex SafePath();

    private string Resolve(string relative)
    {
        if (!SafePath().IsMatch(relative) || relative.Contains("..", StringComparison.Ordinal)) throw new ArgumentException("Chemin de stockage invalide.", nameof(relative));
        var root = Path.GetFullPath(configuration["STORAGE_DIR"] is { Length: > 0 } dir ? dir : Path.Combine(environment.ContentRootPath, "storage"));
        var full = Path.GetFullPath(Path.Combine(root, relative));
        if (!full.StartsWith(root, StringComparison.Ordinal)) throw new ArgumentException("Chemin de stockage invalide.", nameof(relative));
        return full;
    }

    public async Task WriteAsync(string relative, byte[] bytes, CancellationToken cancellationToken = default)
    {
        var full = Resolve(relative);
        Directory.CreateDirectory(Path.GetDirectoryName(full)!);
        await File.WriteAllBytesAsync(full, bytes, cancellationToken);
    }

    public async Task<byte[]?> ReadAsync(string relative, CancellationToken cancellationToken = default)
    {
        var full = Resolve(relative);
        return File.Exists(full) ? await File.ReadAllBytesAsync(full, cancellationToken) : null;
    }
}
