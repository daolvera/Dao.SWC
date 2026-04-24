namespace Dao.SWC.Core;

public static class Constants
{
    public const string AnonymousPolicy = "AnonymousRateLimitingPolicy";
    public const string AppUrlConfigurationKey = "SwcAppUrl";

    public static class WebAppConfiguration
    {
        public const string AppFolder = "../Dao.SWC.Web";
        public const string ApiUrlEnvironmentKey = "API_URL";
        public const string GameHubPath = "/gamehub";
    }

    public static class Authentication
    {
        public const string RefreshTokenCookieKey = "refresh_token";
        public const string AccessTokenCookieKey = "access_token";
        public const string IsAuthenticatedCookieKey = "user_authenticated";
    }

    public static class ProjectNames
    {
        public const string ApiService = "swcapi";
        public const string KeyVault = "swckv";
        public const string AppInsights = "swcai";
        public const string WebApp = "swcapp";
        public const string Database = "swcdb";
        public const string DatabaseProvider = "swcsqlserver";
        public const string MigrationService = "swcmigrationservice";
        public const string BlobStorage = "swcstorage";
        public const string BlobContainer = "swcblobs";
        public const string CardImporter = "swccardimporter";
        public const string CardTextScraper = "swccardtextscraper";
        public const string OpenAi = "swcopenai";
    }

    public static class CustomDomainParameters
    {
        public const string ApiCustomDomain = "apiCustomDomain";
        public const string ApiCertificateName = "apiCertificateName";
        public const string AppCustomDomain = "appCustomDomain";
        public const string AppCertificateName = "appCertificateName";
    }

    public static class ImportOptions
    {
        public const int DefaultDelayMs = 500;
        public const string CardsContainerName = "cards";
    }

    public static class Roles
    {
        public const string Admin = "Admin";
        public const string CardEditor = "CardEditor";
    }
}
