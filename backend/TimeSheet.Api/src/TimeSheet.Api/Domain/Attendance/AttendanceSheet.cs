namespace TimeSheet.Api.Domain.Attendance;

using TimeSheet.Api.Domain.Access;

public enum InternshipKind
{
    ACADEMIC,
    PROFESSIONAL,
    GRADUATE,
}

/// <summary>Circuit de la fiche (§9.7) : générée, signée par le stagiaire, par le superviseur, envoyée aux RH.</summary>
public enum AttendanceStatus
{
    GENERATED,
    SIGNED_BY_INTERN,
    SIGNED_BY_SUPERVISOR,
    SENT,
}

/// <summary>Deux modes de signature (§9.8) ; le mot de passe est toujours proposé (clavier, lecteur d'écran).</summary>
public enum SignatureMethod
{
    DRAWN,
    PASSWORD,
}

/// <summary>Stage d'un collaborateur (PROMPT.md §8) : il fait de lui un stagiaire, avec une fiche de présence par mois.</summary>
public class Internship
{
    public Guid UserId { get; private set; }
    public InternshipKind Kind { get; private set; }
    public string Direction { get; private set; } = "";
    public string Department { get; private set; } = "";
    public string Service { get; private set; } = "";
    public DateOnly StartDate { get; private set; }
    public DateOnly EndDate { get; private set; }

    public static Internship Create(Guid userId, InternshipKind kind, string direction, string department, string service, DateOnly start, DateOnly end) =>
        new() { UserId = userId, Kind = kind, Direction = direction.Trim(), Department = department.Trim(), Service = service.Trim(), StartDate = start, EndDate = end };

    protected Internship() { } // EF
}

/// <summary>
/// Fiche de présence d'un stagiaire pour un mois (PROMPT.md §9.7). Générée quand toutes les
/// semaines du mois sont validées ; signée par le stagiaire, puis par son superviseur (signature
/// imprimée, PDF stocké avec son empreinte), puis envoyée aux RH.
/// </summary>
public class AttendanceSheet
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid DivisionId { get; private set; }
    public Guid UserId { get; private set; }
    public int Year { get; private set; }
    /// <summary>1 à 12.</summary>
    public int Month { get; private set; }
    public AttendanceStatus Status { get; private set; } = AttendanceStatus.GENERATED;
    public DateTimeOffset GeneratedAt { get; private set; }
    public string? Observation { get; private set; }
    /// <summary>Motif du dernier renvoi au stagiaire ; effacé à sa nouvelle signature.</summary>
    public string? RejectionReason { get; private set; }
    public DateTimeOffset? RejectedAt { get; private set; }
    public string? PdfPath { get; private set; }
    public string? PdfSha256 { get; private set; }
    public DateTimeOffset? SentAt { get; private set; }
    public string? SentTo { get; private set; }

    private readonly List<Signature> _signatures = [];
    public IReadOnlyCollection<Signature> Signatures => _signatures;

    /// <summary>Signatures en cours (une signature annulée par un renvoi reste en base).</summary>
    public IEnumerable<Signature> ActiveSignatures => _signatures.Where(s => s.CancelledAt is null).OrderBy(s => s.SignedAt);

    public Signature? InternSignature => ActiveSignatures.FirstOrDefault(s => s.SignerRole == Role.STAFF);
    public Signature? SupervisorSignature => ActiveSignatures.FirstOrDefault(s => s.SignerRole != Role.STAFF);

    public static AttendanceSheet Generate(Guid divisionId, Guid userId, int year, int month, DateTimeOffset now) =>
        new() { DivisionId = divisionId, UserId = userId, Year = year, Month = month, GeneratedAt = now };

    /// <summary>Signature du stagiaire : certifie la fiche, n'est pas imprimée (§9.7).</summary>
    public void SignAsIntern(Guid signerId, SignatureMethod method, string? drawing, string sha256, DateTimeOffset now, string? ip, string? userAgent)
    {
        if (Status != AttendanceStatus.GENERATED) throw new InvalidOperationException("Fiche déjà signée.");
        _signatures.Add(new Signature(Id, signerId, Role.STAFF, method, drawing, now, sha256, ip, userAgent));
        RejectionReason = null;
        RejectedAt = null;
        Status = AttendanceStatus.SIGNED_BY_INTERN;
    }

    /// <summary>Signature du superviseur : imprimée sur le PDF, stocké avec son empreinte SHA-256.</summary>
    public void SignAsSupervisor(Guid signerId, Role role, SignatureMethod method, string? drawing, string? observation, string pdfPath, string sha256, DateTimeOffset now, string? ip, string? userAgent)
    {
        if (Status != AttendanceStatus.SIGNED_BY_INTERN) throw new InvalidOperationException("Signature du stagiaire attendue.");
        _signatures.Add(new Signature(Id, signerId, role, method, drawing, now, sha256, ip, userAgent));
        Observation = observation;
        PdfPath = pdfPath;
        PdfSha256 = sha256;
        Status = AttendanceStatus.SIGNED_BY_SUPERVISOR;
    }

    /// <summary>Renvoi au stagiaire avec un motif : sa signature est annulée, jamais supprimée (§9.8).</summary>
    public void Reject(string reason, DateTimeOffset now)
    {
        if (Status != AttendanceStatus.SIGNED_BY_INTERN) throw new InvalidOperationException("Rien à renvoyer.");
        if (string.IsNullOrWhiteSpace(reason)) throw new ArgumentException("Motif obligatoire.", nameof(reason));
        foreach (var s in _signatures.Where(s => s.CancelledAt is null)) s.CancelledAt = now;
        RejectionReason = reason.Trim();
        RejectedAt = now;
        Status = AttendanceStatus.GENERATED;
    }

    public void MarkSent(string to, DateTimeOffset now)
    {
        if (Status != AttendanceStatus.SIGNED_BY_SUPERVISOR) throw new InvalidOperationException("Signature du superviseur attendue.");
        SentTo = to;
        SentAt = now;
        Status = AttendanceStatus.SENT;
    }

    protected AttendanceSheet() { } // EF
}

/// <summary>Signature électronique (§9.8) : signataire et rôle, méthode, instant, empreinte du document, poste.</summary>
public class Signature
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid AttendanceSheetId { get; private set; }
    public Guid SignerId { get; private set; }
    public Role SignerRole { get; private set; }
    public SignatureMethod Method { get; private set; }
    /// <summary>Tracé : chemin SVG (viewBox 0 0 300 100), commandes M et L.</summary>
    public string? Drawing { get; private set; }
    public DateTimeOffset SignedAt { get; private set; }
    public string DocumentSha256 { get; private set; } = "";
    public string? Ip { get; private set; }
    public string? UserAgent { get; private set; }
    public DateTimeOffset? CancelledAt { get; internal set; }

    internal Signature(Guid sheetId, Guid signerId, Role role, SignatureMethod method, string? drawing, DateTimeOffset at, string sha256, string? ip, string? userAgent)
    {
        AttendanceSheetId = sheetId;
        SignerId = signerId;
        SignerRole = role;
        Method = method;
        Drawing = drawing;
        SignedAt = at;
        DocumentSha256 = sha256;
        Ip = ip;
        UserAgent = userAgent is { Length: > 300 } ua ? ua[..300] : userAgent;
    }

    protected Signature() { } // EF
}
