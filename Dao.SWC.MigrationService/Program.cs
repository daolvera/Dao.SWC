using Dao.SWC.Core;
using Dao.SWC.Core.Entities;
using Dao.SWC.MigrationService;
using Dao.SWC.Services.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

var builder = Host.CreateApplicationBuilder(args);
builder.AddServiceDefaults();
builder.Services.AddOptions<MigrationOptions>()
    .Bind(builder.Configuration.GetSection(MigrationOptions.SectionName))
    .ValidateOnStart();

builder.Services.AddHostedService<DbMigrationWorker>();

builder
    .Services.AddOpenTelemetry()
    .WithTracing(tracing => tracing.AddSource(Constants.ProjectNames.MigrationService));

builder.AddSqlServerDbContext<SwcDbContext>(
    Constants.ProjectNames.Database,
    configureDbContextOptions: options =>
    {
        options.UseSqlServer(sqlOptions =>
        {
            sqlOptions.EnableRetryOnFailure(
                maxRetryCount: 5,
                maxRetryDelay: TimeSpan.FromSeconds(30),
                errorNumbersToAdd: null
            );
        });
    }
);

// Add Identity services for seeding roles
builder
    .Services.AddIdentityCore<AppUser>()
    .AddRoles<IdentityRole>()
    .AddEntityFrameworkStores<SwcDbContext>();

var host = builder.Build();
host.Run();
