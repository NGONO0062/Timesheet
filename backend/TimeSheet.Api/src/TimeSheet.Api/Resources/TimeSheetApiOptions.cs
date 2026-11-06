namespace TimeSheet.Api.Resources;

public class TimeSheetApiOptions
{
    public const string SectionName = "TimeSheetApi";
    
    public RabbitMqOptions RabbitMq { get; set; } = new RabbitMqOptions();
    public ConnectionStringOptions ConnectionStrings { get; set; } = new ConnectionStringOptions();
    public AuthOptions Auth { get; set; } = new AuthOptions();
    public string JaegerHost { get; set; } = String.Empty;
    
    public class RabbitMqOptions
    {
        public const string SectionName = $"{TimeSheetApiOptions.SectionName}:RabbitMq";
        public const string HostKey = nameof(Host);
        public const string VirtualHostKey = nameof(VirtualHost);
        public const string UsernameKey = nameof(Username);
        public const string PasswordKey = nameof(Password);
        public const string PortKey = nameof(Port);

        public string Host { get; set; } = String.Empty;
        public string VirtualHost { get; set; } = String.Empty;
        public string Username { get; set; } = String.Empty;
        public string Password { get; set; } = String.Empty;
        public string Port { get; set; } = String.Empty;
    }

    public class ConnectionStringOptions
    {
        public const string SectionName = $"{TimeSheetApiOptions.SectionName}:ConnectionStrings";
        public const string TimeSheetApiKey = nameof(TimeSheetApi); 
            
        public string TimeSheetApi { get; set; } = String.Empty;
    }
    
    
    public class AuthOptions
    {
        public const string SectionName = $"{TimeSheetApiOptions.SectionName}:Auth";

        public string Audience { get; set; } = String.Empty;
        public string Authority { get; set; } = String.Empty;
        public string AuthorizationUrl { get; set; } = String.Empty;
        public string TokenUrl { get; set; } = String.Empty;
        public string ClientId { get; set; } = String.Empty;
        public string ClientSecret { get; set; } = String.Empty;
    }
}

public static class TimeSheetApiOptionsExtensions
{
    public static TimeSheetApiOptions GetTimeSheetApiOptions(this IConfiguration configuration)
    {
        return configuration
            .GetSection(TimeSheetApiOptions.SectionName)
            .Get<TimeSheetApiOptions>();
    }
    
    public static TimeSheetApiOptions.RabbitMqOptions GetRabbitMqOptions(this IConfiguration configuration)
    {
        return configuration
            .GetSection(TimeSheetApiOptions.RabbitMqOptions.SectionName)
            .Get<TimeSheetApiOptions.RabbitMqOptions>();
    }
    
    public static TimeSheetApiOptions.ConnectionStringOptions GetConnectionStringOptions(this IConfiguration configuration)
    {
        return configuration
            .GetSection(TimeSheetApiOptions.ConnectionStringOptions.SectionName)
            .Get<TimeSheetApiOptions.ConnectionStringOptions>();
    }
    
    public static TimeSheetApiOptions.AuthOptions GetAuthOptions(this IConfiguration configuration)
    {
        return configuration
            .GetSection(TimeSheetApiOptions.AuthOptions.SectionName)
            .Get<TimeSheetApiOptions.AuthOptions>();
    }

    public static string GetJaegerHostValue(this IConfiguration configuration)
    {
        return configuration
            .GetSection(TimeSheetApiOptions.SectionName)
            .GetSection(nameof(TimeSheetApiOptions.JaegerHost)).Value;
    }
}