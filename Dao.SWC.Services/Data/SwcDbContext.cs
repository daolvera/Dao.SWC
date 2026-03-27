using Dao.SWC.Core.Entities;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Dao.SWC.Services.Data;

public class SwcDbContext : IdentityDbContext<AppUser>
{
    public SwcDbContext(DbContextOptions<SwcDbContext> options)
        : base(options)
    {
    }

    public DbSet<Card> Cards => Set<Card>();
    public DbSet<Deck> Decks => Set<Deck>();
    public DbSet<DeckCard> DeckCards => Set<DeckCard>();

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        base.OnConfiguring(optionsBuilder);
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Card configuration
        modelBuilder.Entity<Card>(entity =>
        {
            entity.HasKey(c => c.Id);
            entity.Property(c => c.Name).IsRequired().HasMaxLength(200);
            entity.Property(c => c.CardText).HasMaxLength(2000);
            entity.Property(c => c.ImageUrl).HasMaxLength(500);
            entity.Property(c => c.Version).HasMaxLength(10);

            // Index for efficient lookups
            entity.HasIndex(c => new { c.Name, c.Version });
            entity.HasIndex(c => c.Type);
            entity.HasIndex(c => c.Alignment);
        });

        // Deck configuration
        modelBuilder.Entity<Deck>(entity =>
        {
            entity.HasKey(d => d.Id);
            entity.Property(d => d.Name).IsRequired().HasMaxLength(100);
            entity.Property(d => d.UserId).IsRequired();

            entity
                .HasOne(d => d.User)
                .WithMany()
                .HasForeignKey(d => d.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(d => d.UserId);
        });

        // DeckCard configuration (join table)
        modelBuilder.Entity<DeckCard>(entity =>
        {
            entity.HasKey(dc => new { dc.DeckId, dc.CardId });

            entity.Property(dc => dc.Quantity).IsRequired().HasDefaultValue(1);

            entity
                .HasOne(dc => dc.Deck)
                .WithMany(d => d.DeckCards)
                .HasForeignKey(dc => dc.DeckId)
                .OnDelete(DeleteBehavior.Cascade);

            entity
                .HasOne(dc => dc.Card)
                .WithMany(c => c.DeckCards)
                .HasForeignKey(dc => dc.CardId)
                .OnDelete(DeleteBehavior.Restrict);
        });
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
