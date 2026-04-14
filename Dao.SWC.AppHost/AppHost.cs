using Dao.SWC.Core;

var builder = DistributedApplication.CreateBuilder(args);

// Use Azure SQL Database in production, containerized SQL Server for local dev
IResourceBuilder<IResourceWithConnectionString> swcDb;

if (builder.ExecutionContext.IsPublishMode)
{
    var azureSql = builder.AddAzureSqlServer(Constants.ProjectNames.DatabaseProvider)
        .ConfigureInfrastructure(infra =>
        {
            // Codify BillOverUsage so azd provision doesn't revert it to AutoPause
            foreach (var db in infra.GetProvisionableResources().OfType<Azure.Provisioning.Sql.SqlDatabase>())
            {
                db.FreeLimitExhaustionBehavior = Azure.Provisioning.Sql.FreeLimitExhaustionBehavior.BillOverUsage;
            }
        });
    swcDb = azureSql.AddDatabase(Constants.ProjectNames.Database);
}
else
{
    var sqlServer = builder
        .AddSqlServer(Constants.ProjectNames.DatabaseProvider)
        .WithDataVolume()
        .WithLifetime(ContainerLifetime.Persistent);
    swcDb = sqlServer.AddDatabase(Constants.ProjectNames.Database);
}

var blobStorage = builder.AddAzureStorage(Constants.ProjectNames.BlobStorage);

// Use Azurite emulator only for local development
if (!builder.ExecutionContext.IsPublishMode)
{
    blobStorage.RunAsEmulator(emulator => emulator.WithLifetime(ContainerLifetime.Persistent));
}

var blobs = blobStorage.AddBlobs(Constants.ProjectNames.BlobContainer);

var migrations = builder
    .AddProject<Projects.Dao_SWC_MigrationService>(Constants.ProjectNames.MigrationService)
    .WaitFor(swcDb)
    .WithReference(swcDb);

// Card Importer console app - one-time import tool
var cardImporter = builder
    .AddProject<Projects.Dao_SWC_CardImporter>(Constants.ProjectNames.CardImporter)
    .WithReference(swcDb)
    .WithReference(blobs)
    .WaitForCompletion(migrations)
    .WithExplicitStart();

// Card Text Scraper console app - scrapes card text from swtcg.com
var cardTextScraper = builder
    .AddProject<Projects.Dao_SWC_CardTextScraper>(Constants.ProjectNames.CardTextScraper)
    .PublishAsDockerFile(c => c.WithDockerfile(contextPath: "..", dockerfilePath: "Dao.SWC.CardTextScraper/Dockerfile"))
    .WithReference(swcDb)
    .WaitForCompletion(migrations)
    .WithExplicitStart();

var apiService = builder
    .AddProject<Projects.Dao_SWC_ApiService>(Constants.ProjectNames.ApiService)
    .WithExternalHttpEndpoints() // Required for OAuth callbacks
    .WaitForCompletion(migrations)
    .WithReference(swcDb)
    .WithReference(blobs)
    .WithHttpHealthCheck("/health");

if (builder.ExecutionContext.IsPublishMode)
{
    var keyVault = builder.AddAzureKeyVault(Constants.ProjectNames.KeyVault);
    var insights = builder.AddAzureApplicationInsights(Constants.ProjectNames.AppInsights);

    cardImporter.WithReference(keyVault).WithReference(insights);
    cardTextScraper.WithReference(keyVault).WithReference(insights);

    apiService.WithReference(keyVault).WithReference(insights);
}

var webApp = builder
    .AddJavaScriptApp(Constants.ProjectNames.WebApp, Constants.WebAppConfiguration.AppFolder)
    .WithReference(apiService)
    .WaitFor(apiService)
    .WithHttpEndpoint(targetPort: 3000, env: "PORT")
    .WithExternalHttpEndpoints()
    .PublishAsDockerFile()
    .WithHttpHealthCheck("/health");

if (builder.ExecutionContext.IsPublishMode)
{
    var apiCustomDomain = builder.AddParameter(Constants.CustomDomainParameters.ApiCustomDomain);
    var apiCertificateName = builder.AddParameter(Constants.CustomDomainParameters.ApiCertificateName);
    var appCustomDomain = builder.AddParameter(Constants.CustomDomainParameters.AppCustomDomain);
    var appCertificateName = builder.AddParameter(Constants.CustomDomainParameters.AppCertificateName);

    builder.AddAzureContainerAppEnvironment("cae-hmvnzqjqex33y");
    apiService.PublishAsAzureContainerApp((module, app) =>
    {
        app.ConfigureCustomDomain(apiCustomDomain, apiCertificateName);
    });

    webApp.PublishAsAzureContainerApp((module, app) =>
    {
        app.ConfigureCustomDomain(appCustomDomain, appCertificateName);
    });
}

if (builder.ExecutionContext.IsPublishMode && !string.IsNullOrWhiteSpace(builder.Configuration[Constants.AppUrlConfigurationKey]))
{
    apiService.WithEnvironment(
        Constants.AppUrlConfigurationKey,
        builder.Configuration[Constants.AppUrlConfigurationKey]
    );
}
else
{
    var frontendHttpEndpoint = webApp.GetEndpoint("http");
    apiService.WithEnvironment(Constants.AppUrlConfigurationKey, frontendHttpEndpoint);
}

if (builder.ExecutionContext.IsPublishMode && !string.IsNullOrWhiteSpace(builder.Configuration[Constants.ApiUrlConfigurationKey]))
{
    webApp.WithEnvironment(
        Constants.WebAppConfiguration.ApiUrlEnvironmentKey,
        builder.Configuration[Constants.ApiUrlConfigurationKey]
    );
}
else
{
    webApp.WithEnvironment(
        Constants.WebAppConfiguration.ApiUrlEnvironmentKey,
        apiService.GetEndpoint("https")
    );
}

builder.Build().Run();
