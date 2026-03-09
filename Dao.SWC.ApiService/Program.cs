using Dao.SWC.ApiService.Extensions;
using Dao.SWC.Core;
using Dao.SWC.Core.Authentication;
using Dao.SWC.Services.Authentication;
using Dao.SWC.Services.Data;
using Microsoft.AspNetCore.HttpOverrides;

var builder = WebApplication.CreateBuilder(args);

// Add service defaults & Aspire client integrations.
builder.AddServiceDefaults();

builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    // Clear known networks/proxies to trust all proxies (needed for Azure Container Apps)
    options.KnownProxies.Clear();
});

builder.Services.AddLoginInRateLimiter();

builder.Services.AddSpaCors(builder.Configuration[Constants.AppUrlConfigurationKey] ?? throw new InvalidOperationException($"{Constants.AppUrlConfigurationKey} is not configured"));

builder.Configuration.AddAzureKeyVaultSecrets(Constants.ProjectNames.KeyVault);

builder.Services.AddControllers();
builder.Services.AddRouting(options =>
{
    options.LowercaseUrls = false;
    options.AppendTrailingSlash = false;
});
builder.Services.AddScoped<ITokenService, JwtTokenService>();
builder.Services.AddScoped<IAppUserRepository, AppUserRepository>();

// Add services to the container.
builder.Services.AddProblemDetails();

// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

builder.AddNpgsqlDbContext<SwcDbContext>(Constants.ProjectNames.Database);

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

app.MapDefaultEndpoints();


app.Run();
