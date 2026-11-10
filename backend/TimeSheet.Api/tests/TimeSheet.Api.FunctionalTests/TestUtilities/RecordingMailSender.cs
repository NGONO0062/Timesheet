namespace TimeSheet.Api.FunctionalTests.TestUtilities;

using System.Collections.Concurrent;
using TimeSheet.Api.Services.Mail;

/// <summary>Envoi d'e-mails des tests : rien ne part, chaque message est gardé pour être vérifié.</summary>
public sealed class RecordingMailSender : IMailSender
{
    public static ConcurrentQueue<MailMessage> Sent { get; } = new();

    /// <summary>Secret des tâches planifiées dans les tests (32 caractères au moins).</summary>
    public const string TasksSecret = "secret-des-taches-planifiees-de-test-0123456789";

    public static IReadOnlyList<MailMessage> To(string email) => Sent.Where(m => m.To == email).ToList();

    public Task<bool> SendAsync(MailMessage mail, CancellationToken cancellationToken = default)
    {
        Sent.Enqueue(mail);
        return Task.FromResult(true);
    }
}
