using Dao.SWC.Core;
using Dao.SWC.Core.Entities;
using Dao.SWC.MigrationService;
using Dao.SWC.Services.Data;
using Microsoft.AspNetCore.Identity;

var builder = Host.CreateApplicationBuilder(args);
builder.AddServiceDefaults();
builder.Services.AddHostedService<DbMigrationWorker>();

builder
    .Services.AddOpenTelemetry()
    .WithTracing(tracing => tracing.AddSource(Constants.ProjectNames.MigrationService));

builder.AddNpgsqlDbContext<SwcDbContext>(Constants.ProjectNames.Database);

// Add Identity services for seeding roles
builder
    .Services.AddIdentityCore<AppUser>()
    .AddRoles<IdentityRole>()
    .AddEntityFrameworkStores<SwcDbContext>();

var host = builder.Build();
host.Run();
