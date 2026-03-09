namespace Dao.SWC.Core;

public static class Constants
{
    public const string AnonymousPolicy = "AnonymousRateLimitingPolicy";
    public const string AppUrlConfigurationKey = "SwcAppUrl";

    public static class WebAppConfiguration
    {
        public const string AppFolder = "../Dao.SWC.Web";
        public const string StartCommandName = "start";
    }

    public static class Authentication
    {
        public const string RefreshTokenCookieKey = "SwcRefreshToken";
        public const string AccessTokenCookieKey = "SwcAccessToken";
        public const string IsAuthenticatedCookieKey = "SwcIsAuthenticated";
    }

    public static class ProjectNames
    {
        public const string ApiService = "SwcApi";
        public const string KeyVault = "SwcKv";
        public const string AppInsights = "SwcAi";
        public const string WebApp = "SwcApp";
        public const string Database = "SwcDb";
        public const string DatabaseProvider = "SwcPostgres";
    }
}
