using Dao.SWC.Core;

var builder = DistributedApplication.CreateBuilder(args);

var keyVault = builder.AddAzureKeyVault(Constants.ProjectNames.KeyVault);

var postgres = builder.AddPostgres(Constants.ProjectNames.DatabaseProvider).WithLifetime(ContainerLifetime.Persistent);

var insights = builder.AddAzureApplicationInsights(Constants.ProjectNames.AppInsights);

var swcDb = postgres.AddDatabase(Constants.ProjectNames.Database);

var migrations = builder.AddProject<Projects.Dao_SWC_MigrationService>(Constants.ProjectNames.MigrationService)
    .WithReference(swcDb)
    .WaitFor(swcDb);

var apiService = builder.AddProject<Projects.Dao_SWC_ApiService>(Constants.ProjectNames.ApiService)
    .WithExternalHttpEndpoints() // Required for OAuth callbacks
    .WaitFor(migrations)
    .WithReference(swcDb)
    .WithReference(insights)
    .WithReference(keyVault)
    .WithHttpHealthCheck("/health");

var webApp = builder
    .AddJavaScriptApp(Constants.ProjectNames.WebApp, Constants.WebAppConfiguration.AppFolder)
    .WithReference(apiService)
    .WaitFor(apiService)
    .WithHttpEndpoint(targetPort: 3000, env: "PORT")
    .WithExternalHttpEndpoints()
    .WithNpm(installCommand: "ci")
    .PublishAsDockerFile()
    .WithHttpHealthCheck("/health");

if (!string.IsNullOrWhiteSpace(builder.Configuration[Constants.AppUrlConfigurationKey]))
{
    apiService.WithEnvironment(Constants.AppUrlConfigurationKey, builder.Configuration[Constants.AppUrlConfigurationKey]);
}
else
{
    var frontendHttpEndpoint = webApp.GetEndpoint("http");
    apiService.WithEnvironment(Constants.AppUrlConfigurationKey, frontendHttpEndpoint);
}

builder.Build().Run();
