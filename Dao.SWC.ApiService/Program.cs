using Azure.Identity;
using Dao.SWC.ApiService.Extensions;
using Dao.SWC.ApiService.Hubs;
using Dao.SWC.Core;
using Dao.SWC.Core.Authentication;
using Dao.SWC.Core.CardImport;
using Dao.SWC.Core.Decks;
using Dao.SWC.Core.GameRoom;
using Dao.SWC.Services.Authentication;
using Dao.SWC.Services.CardImport;
using Dao.SWC.Services.Data;
using Dao.SWC.Services.DeckImport;
using Dao.SWC.Services.Decks;
using Dao.SWC.Services.GameRoom;
using Microsoft.AspNetCore.HttpOverrides;

var builder = WebApplication.CreateBuilder(args);

// Add service defaults & Aspire client integrations.
builder.AddServiceDefaults();

if (
    !string.IsNullOrEmpty(
        builder.Configuration.GetConnectionString(Constants.ProjectNames.KeyVault)
    )
)
{
    var managedIdentityClientId = builder.Configuration["AZURE_CLIENT_ID"];
    builder.Configuration.AddAzureKeyVaultSecrets(
        connectionName: Constants.ProjectNames.KeyVault,
        configureSettings: settings =>
        {
            if (!string.IsNullOrEmpty(managedIdentityClientId))
            {
                settings.Credential = new ManagedIdentityCredential(managedIdentityClientId);
            }
        }
    );
}

builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    // Clear known networks/proxies to trust all proxies (needed for Azure Container Apps)
    options.KnownProxies.Clear();
});

builder.Services.AddLoginInRateLimiter();

builder.Services.AddSpaCors(
    builder.Configuration[Constants.AppUrlConfigurationKey]
        ?? throw new InvalidOperationException(
            $"{Constants.AppUrlConfigurationKey} is not configured"
        )
);

builder.Services.AddControllers();
builder.Services.AddRouting(options =>
{
    options.LowercaseUrls = false;
    options.AppendTrailingSlash = false;
});
builder.Services.AddScoped<ITokenService, JwtTokenService>();
builder.Services.AddScoped<IAppUserRepository, AppUserRepository>();
builder.Services.AddScoped<IAppUserService, AppUserService>();

// Deck and Card services
builder.Services.AddScoped<IDeckService, DeckService>();
builder.Services.AddScoped<IDeckValidationService, DeckValidationService>();
builder.Services.AddScoped<ICardService, CardService>();
builder.Services.AddScoped<ICardImageService, CardImageService>();

// Deck import services
builder.Services.AddScoped<ICsvDeckParsingService, CsvDeckParsingService>();
builder.Services.AddScoped<ICardMatchingService, CardMatchingService>();
builder.Services.AddScoped<IDeckImportService, DeckImportService>();

// Configure authentication
builder.AddGoogleAuthentication();

// Configure SignalR
builder.Services.AddSignalR();

// Game room storage (singleton for in-memory state)
builder.Services.AddSingleton<IGameRoomStorage, GameRoomStorage>();
builder.Services.AddScoped<IGameRoomService, GameRoomService>();

// Add services to the container.
builder.Services.AddProblemDetails();

// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

builder.AddSqlServerDbContext<SwcDbContext>(Constants.ProjectNames.Database);

builder.AddAzureBlobServiceClient(Constants.ProjectNames.BlobContainer);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

app.UseForwardedHeaders();

app.UseRateLimiter();

// Configure the HTTP request pipeline.
app.UseExceptionHandler();

app.UseCors();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "DAO.SWC API V1");
        c.RoutePrefix = string.Empty;
    });
}

app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/health", () => Results.Ok(new { status = "healthy", timestamp = DateTime.UtcNow }))
    .WithName("HealthCheck")
    .WithTags("Health")
    .WithSummary("Check API health");

app.MapControllers();

// Map SignalR hubs
app.MapHub<GameHub>(Constants.WebAppConfiguration.GameHubPath);

app.MapDefaultEndpoints();

app.Run();
