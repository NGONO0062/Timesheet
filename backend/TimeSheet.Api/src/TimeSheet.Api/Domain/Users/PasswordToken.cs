namespace TimeSheet.Api.Domain.Users;

using System.Security.Cryptography;
using System.Text;

/// <summary>E-mails que la personne peut couper dans ses Paramètres (écran 14).</summary>
public enum NotificationKind
{
    FillReminder,
    Validated,
    Rejected,
}

public enum TokenKind
{
    INVITATION,
    RESET,
}

/// <summary>
/// Lien à usage unique (PROMPT.md §19) : invitation (premier mot de passe, 7 jours) ou mot de
/// passe oublié (1 heure). Seule l'empreinte SHA-256 du jeton est stockée ; le jeton n'existe
/// que dans l'e-mail.
/// </summary>
public class PasswordToken
{
    public static readonly TimeSpan InvitationLifetime = TimeSpan.FromDays(7);
    public static readonly TimeSpan ResetLifetime = TimeSpan.FromHours(1);

    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid UserId { get; private set; }
    public TokenKind Kind { get; private set; }
    public string TokenHash { get; private set; } = "";
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset ExpiresAt { get; private set; }
    public DateTimeOffset? UsedAt { get; private set; }

    /// <summary>Nouveau lien : renvoie l'entité et le jeton en clair (pour l'e-mail seulement).</summary>
    public static (PasswordToken Token, string Plain) Issue(Guid userId, TokenKind kind, DateTimeOffset now)
    {
        var plain = Base64Url(RandomNumberGenerator.GetBytes(32));
        var lifetime = kind == TokenKind.INVITATION ? InvitationLifetime : ResetLifetime;
        return (new PasswordToken { UserId = userId, Kind = kind, TokenHash = Digest(plain), CreatedAt = now, ExpiresAt = now + lifetime }, plain);
    }

    public static string Digest(string plain) => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(plain)));

    /// <summary>Forme d'un jeton émis (base64url de 32 octets) : on ne cherche rien d'autre en base.</summary>
    public static bool LooksValid(string? plain) => plain is { Length: >= 20 and <= 100 } && plain.All(c => char.IsAsciiLetterOrDigit(c) || c is '-' or '_');

    public bool IsUsable(TokenKind kind, DateTimeOffset now) => Kind == kind && UsedAt is null && ExpiresAt > now;

    public void Use(DateTimeOffset now) => UsedAt ??= now;

    private static string Base64Url(byte[] bytes) => Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    protected PasswordToken() { } // EF
}
