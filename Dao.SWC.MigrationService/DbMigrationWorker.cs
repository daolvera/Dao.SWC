using System.Diagnostics;
using Dao.SWC.Core;
using Dao.SWC.Core.Entities;
using Dao.SWC.Services.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Dao.SWC.MigrationService;

public class DbMigrationWorker(
    IServiceProvider ServiceProvider,
    IHostApplicationLifetime HostApplicationLifetime,
    ILogger<DbMigrationWorker> Logger
) : BackgroundService
{
    private static readonly ActivitySource s_activitySource = new(
        Constants.ProjectNames.MigrationService
    );

    protected override async Task ExecuteAsync(CancellationToken cancellationToken)
    {
        using var activity = s_activitySource.StartActivity(
            "Migrating database",
            ActivityKind.Client
        );

        try
        {
            using var scope = ServiceProvider.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<SwcDbContext>();

            await RunMigrationAsync(dbContext, cancellationToken);
            await SeedRolesAsync(scope.ServiceProvider, cancellationToken);

            Logger.LogInformation("Database migration and seeding completed successfully");
        }
        catch (Exception ex)
        {
            activity?.AddException(ex);
            Logger.LogError(ex, "An error occurred while migrating the database");
            Environment.ExitCode = 1;
        }
        finally
        {
            HostApplicationLifetime.StopApplication();
        }
    }

    private static async Task RunMigrationAsync(
        SwcDbContext dbContext,
        CancellationToken cancellationToken
    )
    {
        var strategy = dbContext.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            // Run migration in a transaction to avoid partial migration if it fails.
            await dbContext.Database.MigrateAsync(cancellationToken);
        });
    }

    private static async Task SeedRolesAsync(
        IServiceProvider serviceProvider,
        CancellationToken cancellationToken
    )
    {
        var roleManager = serviceProvider.GetRequiredService<RoleManager<IdentityRole>>();
        var userManager = serviceProvider.GetRequiredService<UserManager<AppUser>>();

        // Seed roles
        string[] roles = [Constants.Roles.Admin, Constants.Roles.CardEditor];
        foreach (var role in roles)
        {
            if (!await roleManager.RoleExistsAsync(role))
            {
                await roleManager.CreateAsync(new IdentityRole(role));
            }
        }

        // Assign admin role to seed user
        const string adminEmail = "dao.olvera@gmail.com";
        var adminUser = await userManager.FindByEmailAsync(adminEmail);
        if (adminUser != null && !await userManager.IsInRoleAsync(adminUser, Constants.Roles.Admin))
        {
            await userManager.AddToRoleAsync(adminUser, Constants.Roles.Admin);
        }
    }
}
