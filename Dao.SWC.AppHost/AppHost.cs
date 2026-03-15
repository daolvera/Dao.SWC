using Dao.SWC.Core;

var builder = DistributedApplication.CreateBuilder(args);

var keyVault = builder.AddAzureKeyVault(Constants.ProjectNames.KeyVault);

var postgres = builder
    .AddPostgres(Constants.ProjectNames.DatabaseProvider)
    .WithLifetime(ContainerLifetime.Persistent);

var insights = builder.AddAzureApplicationInsights(Constants.ProjectNames.AppInsights);

var swcDb = postgres.AddDatabase(Constants.ProjectNames.Database);

// Azure Blob Storage with Azurite emulator for local dev
var blobStorage = builder
    .AddAzureStorage(Constants.ProjectNames.BlobStorage)
    .RunAsEmulator(emulator => emulator.WithLifetime(ContainerLifetime.Persistent));
var blobs = blobStorage.AddBlobs(Constants.ProjectNames.BlobContainer);

var migrations = builder
    .AddProject<Projects.Dao_SWC_MigrationService>(Constants.ProjectNames.MigrationService)
    .WithReference(swcDb)
    .WaitFor(swcDb);

// Card Importer console app - one-time import tool
var cardImporter = builder
    .AddProject<Projects.Dao_SWC_CardImporter>(Constants.ProjectNames.CardImporter)
    .WithReference(swcDb)
    .WithReference(blobs)
    .WithReference(keyVault)
    .WithReference(insights)
    .WaitFor(migrations)
    .WithExplicitStart();

var apiService = builder
    .AddProject<Projects.Dao_SWC_ApiService>(Constants.ProjectNames.ApiService)
    .WithExternalHttpEndpoints() // Required for OAuth callbacks
    .WaitFor(migrations)
    .WithReference(swcDb)
    .WithReference(blobs)
    .WithReference(insights)
    .WithReference(keyVault)
    .WithHttpHealthCheck("/health");

var webApp = builder
    .AddJavaScriptApp(Constants.ProjectNames.WebApp, Constants.WebAppConfiguration.AppFolder)
    .WithReference(apiService)
    .WaitFor(apiService)
    .WithHttpEndpoint(targetPort: 3000, env: "PORT")
    .WithEnvironment(
        Constants.WebAppConfiguration.ApiUrlEnvironmentKey,
        apiService.GetEndpoint("https")
    )
    .WithExternalHttpEndpoints()
    .PublishAsDockerFile()
    .WithHttpHealthCheck("/health");

if (!string.IsNullOrWhiteSpace(builder.Configuration[Constants.AppUrlConfigurationKey]))
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

builder.Build().Run();
