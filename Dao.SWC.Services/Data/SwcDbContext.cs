using Dao.SWC.Core.Entities;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Dao.SWC.Services.Data;

public class SwcDbContext : IdentityDbContext<AppUser>
{
    public SwcDbContext(DbContextOptions<SwcDbContext> options)
        : base(options) { }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
    }
}

/// <summary>
/// Design-time factory for EF Core migrations tooling.
/// This is only used by `dotnet ef` commands and not at runtime.
/// </summary>
public class SwcDbContextFactory : IDesignTimeDbContextFactory<SwcDbContext>
{
    public SwcDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<SwcDbContext>();

        // This connection string is only used for migrations tooling.
        // At runtime, Aspire provides the real connection string.
        optionsBuilder.UseNpgsql(
            "Host=localhost;Database=breakpointdb;Username=postgres;Password=postgres"
        );

        return new SwcDbContext(optionsBuilder.Options);
    }
}
