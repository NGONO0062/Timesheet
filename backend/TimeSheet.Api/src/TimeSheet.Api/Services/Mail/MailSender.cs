namespace TimeSheet.Api.Services.Mail;

using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

/// <summary>E-mail prêt à partir : texte brut et HTML sobre, sans image ni contenu distant.</summary>
public sealed record MailMessage(string To, string Subject, string Text, string Html);

public interface IMailSender : ITimeSheetApiScopedService
{
    /// <summary>
    /// Envoie un e-mail ; renvoie false (sans lever) si l'envoi échoue ou si SMTP n'est pas
    /// configuré. Un échec d'envoi n'annule jamais l'action métier qui l'a déclenché.
    /// </summary>
    Task<bool> SendAsync(MailMessage mail, CancellationToken cancellationToken = default);
}

/// <summary>
/// Envoi SMTP (repris de lib/mail/send.ts) : SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD,
/// SMTP_FROM. En développement, Mailpit (http://localhost:8025).
/// </summary>
public sealed class MailSender(IConfiguration configuration, ILogger<MailSender> logger) : IMailSender
{
    public async Task<bool> SendAsync(MailMessage mail, CancellationToken cancellationToken = default)
    {
        var host = configuration["SMTP_HOST"]?.Trim();
        if (string.IsNullOrEmpty(host))
        {
            logger.LogWarning("E-mail non envoyé (SMTP_HOST vide) : {Subject}", mail.Subject);
            return false;
        }
        var port = int.TryParse(configuration["SMTP_PORT"], out var p) ? p : 587;
        try
        {
            var message = new MimeMessage();
            message.From.Add(MailboxAddress.Parse(configuration["SMTP_FROM"] ?? "TimeSheet <timesheet@exemple.com>"));
            message.To.Add(MailboxAddress.Parse(mail.To));
            message.Subject = mail.Subject;
            message.Body = new BodyBuilder { TextBody = mail.Text, HtmlBody = mail.Html }.ToMessageBody();

            using var client = new SmtpClient();
            // 465 : TLS implicite ; sinon STARTTLS quand le serveur le propose (Mailpit ne le propose pas).
            await client.ConnectAsync(host, port, port == 465 ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTlsWhenAvailable, cancellationToken);
            var user = configuration["SMTP_USER"];
            if (!string.IsNullOrEmpty(user)) await client.AuthenticateAsync(user, configuration["SMTP_PASSWORD"] ?? "", cancellationToken);
            await client.SendAsync(message, cancellationToken);
            await client.DisconnectAsync(true, cancellationToken);
            return true;
        }
        catch (Exception e) when (e is not OperationCanceledException)
        {
            logger.LogError(e, "Échec d'envoi de l'e-mail « {Subject} »", mail.Subject);
            return false;
        }
    }
}
