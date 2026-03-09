namespace Dao.SWC.Core;

public static class Constants
{
    public const string AnonymousPolicy = "AnonymousRateLimitingPolicy";
    public const string AppUrlConfigurationKey = "SwcAppUrl";

    public static class WebAppConfiguration
    {
        public const string AppFolder = "../Dao.SWC.Web";
    }

    public static class Authentication
    {
        public const string RefreshTokenCookieKey = "refresh_token";
        public const string AccessTokenCookieKey = "access_token";
        public const string IsAuthenticatedCookieKey = "user_authenticated";
    }

    public static class ProjectNames
    {
        public const string ApiService = "SwcApi";
        public const string KeyVault = "SwcKv";
        public const string AppInsights = "SwcAi";
        public const string WebApp = "SwcApp";
        public const string Database = "SwcDb";
        public const string DatabaseProvider = "SwcPostgres";
        public const string MigrationService = "SwcMigrationService";
    }
}
