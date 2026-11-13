namespace TimeSheet.Api.Services.Security;

using System.Security.Cryptography;
using System.Text;
using Konscious.Security.Cryptography;

/// <summary>
/// Mots de passe en argon2id (PROMPT.md §16), paramètres recommandés par l'OWASP
/// (19 Mio, 2 passes, 1 fil). Format PHC standard, le même que l'application
/// Next.js (hash-wasm) : « $argon2id$v=19$m=19456,t=2,p=1$sel$empreinte », en base64
/// sans remplissage. Les empreintes existantes restent donc valables.
/// </summary>
public static class PasswordHasher
{
    private const int MemoryKib = 19_456;
    private const int Iterations = 2;
    private const int Parallelism = 1;
    private const int HashLength = 32;
    private const int SaltLength = 16;

    public static string Hash(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(SaltLength);
        var hash = Compute(password, salt, MemoryKib, Iterations, Parallelism, HashLength);
        return $"$argon2id$v=19$m={MemoryKib},t={Iterations},p={Parallelism}${Encode(salt)}${Encode(hash)}";
    }

    /// <summary>Vérifie un mot de passe ; une empreinte mal formée vaut un refus.</summary>
    public static bool Verify(string password, string encoded)
    {
        try
        {
            var parts = encoded.Split('$');
            // ["", "argon2id", "v=19", "m=…,t=…,p=…", sel, empreinte]
            if (parts.Length != 6 || parts[1] != "argon2id" || parts[2] != "v=19") return false;
            var settings = parts[3].Split(',').Select(p => p.Split('=')).ToDictionary(p => p[0], p => int.Parse(p[1]));
            var salt = Decode(parts[4]);
            var expected = Decode(parts[5]);
            var actual = Compute(password, salt, settings["m"], settings["t"], settings["p"], expected.Length);
            return CryptographicOperations.FixedTimeEquals(actual, expected);
        }
        catch (Exception e) when (e is FormatException or KeyNotFoundException or IndexOutOfRangeException or ArgumentException)
        {
            return false;
        }
    }

    private static readonly Lazy<string> Dummy = new(() => Hash("compte-inexistant"));

    /// <summary>Calcul factice quand le compte n'existe pas : le temps de réponse ne révèle rien.</summary>
    public static bool VerifyAgainstDummy(string password)
    {
        Verify(password, Dummy.Value);
        return false;
    }

    private static byte[] Compute(string password, byte[] salt, int memoryKib, int iterations, int parallelism, int length)
    {
        using var argon = new Argon2id(Encoding.UTF8.GetBytes(password))
        {
            Salt = salt,
            MemorySize = memoryKib,
            Iterations = iterations,
            DegreeOfParallelism = parallelism,
        };
        return argon.GetBytes(length);
    }

    private static string Encode(byte[] bytes) => Convert.ToBase64String(bytes).TrimEnd('=');

    private static byte[] Decode(string text)
    {
        var padded = text.PadRight(text.Length + (4 - text.Length % 4) % 4, '=');
        return Convert.FromBase64String(padded);
    }
}
