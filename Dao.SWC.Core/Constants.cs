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
        public const string RefreshTokenCookieKey = "swc-refresh-token";
        public const string AccessTokenCookieKey = "swc-access-token";
        public const string IsAuthenticatedCookieKey = "swc-is-authenticated";
    }

    public static class ProjectNames
    {
        public const string ApiService = "swc-api";
        public const string KeyVault = "swc-kv";
        public const string AppInsights = "swc-ai";
        public const string WebApp = "swc-app";
        public const string Database = "swc-db";
        public const string DatabaseProvider = "swc-postgres";
    }
}
