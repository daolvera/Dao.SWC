using Dao.SWC.Core;
using Dao.SWC.MigrationService;
using Dao.SWC.Services.Data;

var builder = Host.CreateApplicationBuilder(args);
builder.AddServiceDefaults();
builder.Services.AddHostedService<DbMigrationWorker>();

builder.Services.AddOpenTelemetry()
    .WithTracing(tracing => tracing.AddSource(Constants.ProjectNames.MigrationService));

builder.AddNpgsqlDbContext<SwcDbContext>(Constants.ProjectNames.Database);

var host = builder.Build();
host.Run();
