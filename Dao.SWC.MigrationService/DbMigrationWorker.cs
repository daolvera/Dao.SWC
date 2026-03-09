using Dao.SWC.Core;
using Dao.SWC.Services.Data;
using Microsoft.EntityFrameworkCore;
using System.Diagnostics;

namespace Dao.SWC.MigrationService;

public class DbMigrationWorker(
    IServiceProvider ServiceProvider,
    IHostApplicationLifetime HostApplicationLifetime
    ) : BackgroundService
{
    private static readonly ActivitySource s_activitySource = new(Constants.ProjectNames.MigrationService);

    protected override async Task ExecuteAsync(
        CancellationToken cancellationToken)
    {
        using var activity = s_activitySource.StartActivity(
            "Migrating database", ActivityKind.Client);

        try
        {
            using var scope = ServiceProvider.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<SwcDbContext>();

            await RunMigrationAsync(dbContext, cancellationToken);
            //await SeedDataAsync(dbContext, cancellationToken);
        }
        catch (Exception ex)
        {
            activity?.AddException(ex);
            throw;
        }

        HostApplicationLifetime.StopApplication();
    }

    private static async Task RunMigrationAsync(
        SwcDbContext dbContext, CancellationToken cancellationToken)
    {
        var strategy = dbContext.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            // Run migration in a transaction to avoid partial migration if it fails.
            await dbContext.Database.MigrateAsync(cancellationToken);
        });
    }
}
