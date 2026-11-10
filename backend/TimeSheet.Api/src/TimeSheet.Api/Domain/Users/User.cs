namespace TimeSheet.Api.Domain.Users;

using TimeSheet.Api.Domain.Access;
using TimeSheet.Api.Domain.Divisions;

/// <summary>
/// Compte. L'admin plateforme n'a pas de division ; tous les autres en ont une et une seule.
/// Le jeton de session ne porte que l'identifiant et le numéro de session : le compte est
/// relu à chaque requête, donc une désactivation coupe l'accès tout de suite.
/// </summary>
public class User : BaseEntity
{
    public Guid? DivisionId { get; private set; }
    public Division? Division { get; private set; }
    public string Email { get; private set; } = "";
    public string? PasswordHash { get; private set; }
    /// <summary>Augmenté à chaque changement de mot de passe : les sessions ouvertes avant sont refusées.</summary>
    public int SessionVersion { get; private set; }
    public string FirstName { get; private set; } = "";
    public string LastName { get; private set; } = "";
    public Role Role { get; private set; }
    public Guid? ManagerId { get; private set; }
    public Guid? TeamId { get; private set; }
    public bool Active { get; private set; } = true;
    /// <summary>Horaires habituels (« hh:mm ») : arrivée et départ imprimés sur la fiche de présence (§9.7).</summary>
    public string UsualArrival { get; private set; } = "08:00";
    public string UsualDeparture { get; private set; } = "17:00";
    /// <summary>Mode de signature proposé d'abord (écran 14) : tracé ou mot de passe.</summary>
    public Attendance.SignatureMethod DefaultSignatureMode { get; private set; } = Attendance.SignatureMethod.DRAWN;

    public string FullName => $"{FirstName} {LastName}";

    public static string NormalizeEmail(string email) => email.Trim().ToLowerInvariant();

    public static User Create(Guid? divisionId, string email, string firstName, string lastName, Role role)
    {
        if ((role == Role.PLATFORM_ADMIN) != (divisionId is null))
            throw new ArgumentException("Seul l'admin plateforme est sans division.", nameof(divisionId));
        return new User { DivisionId = divisionId, Email = NormalizeEmail(email), FirstName = firstName.Trim(), LastName = lastName.Trim(), Role = role };
    }

    /// <summary>Nouveau mot de passe : toutes les sessions ouvertes sont fermées.</summary>
    public void SetPassword(string passwordHash)
    {
        PasswordHash = passwordHash;
        SessionVersion++;
    }

    public void AssignManager(Guid? managerId) => ManagerId = managerId;
    public void AssignTeam(Guid? teamId) => TeamId = teamId;
    public void SetActive(bool active) => Active = active;

    /// <summary>Horaires habituels « hh:mm » (écran 14), imprimés sur la fiche de présence.</summary>
    public void SetUsualHours(string arrival, string departure)
    {
        UsualArrival = arrival;
        UsualDeparture = departure;
    }

    public void ChangeRole(Role role) => Role = role;

    /// <summary>Un compte désactivé, ou d'une division suspendue, ne se connecte pas.</summary>
    public bool CanSignIn => Active && (Division?.AllowsSignIn ?? Role == Role.PLATFORM_ADMIN);

    protected User() { } // EF
}
