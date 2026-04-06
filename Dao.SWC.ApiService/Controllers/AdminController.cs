using Dao.SWC.Core;
using Dao.SWC.Core.CardTextScraping;
using Dao.SWC.Core.Entities;
using Dao.SWC.Core.Enums;
using Dao.SWC.Services.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Dao.SWC.ApiService.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = Constants.Roles.Admin)]
public class AdminController(
    UserManager<AppUser> userManager,
    RoleManager<IdentityRole> roleManager,
    SwcDbContext dbContext,
    ICardTextScraperService cardTextScraperService
) : ControllerBase
{
    /// <summary>
    /// Get all users with their roles.
    /// </summary>
    [HttpGet("users")]
    [ProducesResponseType(typeof(IEnumerable<UserRoleDto>), 200)]
    public async Task<IActionResult> GetUsersWithRoles()
    {
        var users = userManager.Users.ToList();
        var result = new List<UserRoleDto>();

        foreach (var user in users)
        {
            var roles = await userManager.GetRolesAsync(user);
            result.Add(
                new UserRoleDto(
                    user.Id,
                    user.Email ?? "",
                    user.DisplayName ?? user.UserName ?? "Unknown",
                    roles.ToList()
                )
            );
        }

        return Ok(result);
    }

    /// <summary>
    /// Assign a role to a user by email.
    /// </summary>
    [HttpPost("roles/assign")]
    [ProducesResponseType(200)]
    [ProducesResponseType(404)]
    [ProducesResponseType(400)]
    public async Task<IActionResult> AssignRole([FromBody] AssignRoleDto dto)
    {
        // Validate role exists
        if (!await roleManager.RoleExistsAsync(dto.Role))
        {
            return BadRequest($"Role '{dto.Role}' does not exist");
        }

        // Find user by email
        var user = await userManager.FindByEmailAsync(dto.Email);
        if (user == null)
        {
            return NotFound($"User with email '{dto.Email}' not found");
        }

        // Check if user already has role
        if (await userManager.IsInRoleAsync(user, dto.Role))
        {
            return Ok(new { message = $"User already has role '{dto.Role}'" });
        }

        // Assign role
        var result = await userManager.AddToRoleAsync(user, dto.Role);
        if (!result.Succeeded)
        {
            return BadRequest(result.Errors);
        }

        return Ok(new { message = $"Role '{dto.Role}' assigned to '{dto.Email}'" });
    }

    /// <summary>
    /// Remove a role from a user by email.
    /// </summary>
    [HttpPost("roles/remove")]
    [ProducesResponseType(200)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> RemoveRole([FromBody] AssignRoleDto dto)
    {
        var user = await userManager.FindByEmailAsync(dto.Email);
        if (user == null)
        {
            return NotFound($"User with email '{dto.Email}' not found");
        }

        if (!await userManager.IsInRoleAsync(user, dto.Role))
        {
            return Ok(new { message = $"User does not have role '{dto.Role}'" });
        }

        var result = await userManager.RemoveFromRoleAsync(user, dto.Role);
        if (!result.Succeeded)
        {
            return BadRequest(result.Errors);
        }

        return Ok(new { message = $"Role '{dto.Role}' removed from '{dto.Email}'" });
    }

    /// <summary>
    /// Get available roles that can be assigned.
    /// </summary>
    [HttpGet("roles")]
    [ProducesResponseType(typeof(IEnumerable<string>), 200)]
    public IActionResult GetRoles()
    {
        // Return assignable roles (Admin can assign CardEditor)
        return Ok(new[] { Constants.Roles.CardEditor });
    }

    /// <summary>
    /// Get user statistics including deck counts.
    /// </summary>
    [HttpGet("user-stats")]
    [ProducesResponseType(typeof(IEnumerable<UserStatsDto>), 200)]
    public async Task<IActionResult> GetUserStats()
    {
        var stats = (await dbContext.Users
            .Include(u => u.Decks)
            .ToListAsync())
            .Select(u => new UserStatsDto(
                u.Id,
                u.DisplayName ?? u.UserName ?? "Unknown",
                u.Email ?? "",
                u.Decks.Count,
                u.CreatedAt
            ))
            .OrderBy(s => s.DisplayName)
            .ToList();

        return Ok(stats);
    }

    /// <summary>
    /// Seed test cards into the database. Requires Admin role.
    /// </summary>
    [HttpPost("seed-cards")]
    [ProducesResponseType(typeof(SeedCardsResult), 200)]
    public async Task<IActionResult> SeedTestCards()
    {
        var existingCount = await dbContext.Cards.CountAsync();

        var testCards = new List<Card>
        {
            // Light Side Units
            new()
            {
                Name = "Luke Skywalker",
                Type = CardType.Unit,
                Alignment = Alignment.Light,
                Arena = Arena.Character,
                Version = "A",
                CardText = "When deployed: Draw a card.",
            },
            new()
            {
                Name = "Princess Leia",
                Type = CardType.Unit,
                Alignment = Alignment.Light,
                Arena = Arena.Character,
                Version = "A",
                CardText = "Inspire: Friendly units get +1/+0.",
            },
            new()
            {
                Name = "Han Solo",
                Type = CardType.Unit,
                Alignment = Alignment.Light,
                Arena = Arena.Character,
                Version = "A",
                CardText = "Quick Draw: Attacks first in combat.",
            },
            new()
            {
                Name = "Chewbacca",
                Type = CardType.Unit,
                Alignment = Alignment.Light,
                Arena = Arena.Character,
                CardText = "Protector: Must be attacked first.",
            },
            new()
            {
                Name = "X-Wing Fighter",
                Type = CardType.Unit,
                Alignment = Alignment.Light,
                Arena = Arena.Space,
                CardText = "Agile: Can evade one attack per turn.",
            },
            new()
            {
                Name = "Rebel Trooper",
                Type = CardType.Unit,
                Alignment = Alignment.Light,
                Arena = Arena.Ground,
                CardText = "Basic rebel infantry unit.",
            },
            new()
            {
                Name = "Y-Wing Bomber",
                Type = CardType.Unit,
                Alignment = Alignment.Light,
                Arena = Arena.Space,
                CardText = "Bombing Run: Deal 2 damage to a ground unit.",
            },
            // Dark Side Units
            new()
            {
                Name = "Darth Vader",
                Type = CardType.Unit,
                Alignment = Alignment.Dark,
                Arena = Arena.Character,
                Version = "A",
                CardText = "Fear: Enemy units get -1/-0.",
            },
            new()
            {
                Name = "Emperor Palpatine",
                Type = CardType.Unit,
                Alignment = Alignment.Dark,
                Arena = Arena.Character,
                Version = "A",
                CardText = "Dark Lightning: Deal 3 damage to any unit.",
            },
            new()
            {
                Name = "Boba Fett",
                Type = CardType.Unit,
                Alignment = Alignment.Dark,
                Arena = Arena.Character,
                Version = "A",
                CardText = "Bounty Hunter: Gains bonus when defeating unique units.",
            },
            new()
            {
                Name = "Stormtrooper",
                Type = CardType.Unit,
                Alignment = Alignment.Dark,
                Arena = Arena.Ground,
                CardText = "Imperial infantry unit.",
            },
            new()
            {
                Name = "TIE Fighter",
                Type = CardType.Unit,
                Alignment = Alignment.Dark,
                Arena = Arena.Space,
                CardText = "Swarm: +1/+1 for each other TIE Fighter.",
            },
            new()
            {
                Name = "Star Destroyer",
                Type = CardType.Unit,
                Alignment = Alignment.Dark,
                Arena = Arena.Space,
                CardText = "Capital Ship: Can carry up to 3 fighter units.",
            },
            new()
            {
                Name = "AT-AT Walker",
                Type = CardType.Unit,
                Alignment = Alignment.Dark,
                Arena = Arena.Ground,
                CardText = "Heavy Armor: Reduces incoming damage by 2.",
            },
            // Neutral Units
            new()
            {
                Name = "Jabba the Hutt",
                Type = CardType.Unit,
                Alignment = Alignment.Neutral,
                Arena = Arena.Character,
                Version = "A",
                CardText = "Crime Lord: Generate 1 resource each turn.",
            },
            new()
            {
                Name = "Tusken Raider",
                Type = CardType.Unit,
                Alignment = Alignment.Neutral,
                Arena = Arena.Ground,
                CardText = "Ambush: Deals double damage when attacking from hand.",
            },
            new()
            {
                Name = "Jawa Scavenger",
                Type = CardType.Unit,
                Alignment = Alignment.Neutral,
                Arena = Arena.Ground,
                CardText = "Salvage: When deployed, search deck for an Equipment card.",
            },
            new()
            {
                Name = "Gamorrean Guard",
                Type = CardType.Unit,
                Alignment = Alignment.Neutral,
                Arena = Arena.Ground,
                CardText = "Tough: Takes 1 less damage from all sources.",
            },
            new()
            {
                Name = "Slave I",
                Type = CardType.Unit,
                Alignment = Alignment.Neutral,
                Arena = Arena.Space,
                CardText = "Pursuit: Can attack units that just entered play.",
            },
            new()
            {
                Name = "Outrider",
                Type = CardType.Unit,
                Alignment = Alignment.Neutral,
                Arena = Arena.Space,
                CardText = "Smuggler's Hold: Draw a card when leaving combat.",
            },
            // Locations
            new()
            {
                Name = "Death Star",
                Type = CardType.Location,
                Alignment = Alignment.Dark,
                Arena = Arena.Space,
                CardText = "Superlaser: Once per game, destroy any unit.",
            },
            new()
            {
                Name = "Rebel Base",
                Type = CardType.Location,
                Alignment = Alignment.Light,
                Arena = Arena.Ground,
                CardText = "Safe Haven: Friendly units here cannot be targeted.",
            },
            new()
            {
                Name = "Mos Eisley Cantina",
                Type = CardType.Location,
                Alignment = Alignment.Neutral,
                Arena = Arena.Ground,
                CardText = "Wretched Hive: Draw extra card but discard one.",
            },
            new()
            {
                Name = "Cloud City",
                Type = CardType.Location,
                Alignment = Alignment.Neutral,
                Arena = Arena.Space,
                CardText = "Mining Operation: Generate 1 additional resource.",
            },
            // Equipment
            new()
            {
                Name = "Lightsaber",
                Type = CardType.Equipment,
                Alignment = Alignment.Neutral,
                CardText = "Attach to Character: +2/+1.",
            },
            new()
            {
                Name = "Blaster Rifle",
                Type = CardType.Equipment,
                Alignment = Alignment.Neutral,
                CardText = "Attach to Unit: +1/+0 and Ranged.",
            },
            new()
            {
                Name = "Jetpack",
                Type = CardType.Equipment,
                Alignment = Alignment.Neutral,
                CardText = "Attach to Character: Can move between arenas.",
            },
            // Missions
            new()
            {
                Name = "Rescue Mission",
                Type = CardType.Mission,
                Alignment = Alignment.Light,
                CardText = "Return a friendly unit from discard to hand.",
            },
            new()
            {
                Name = "Imperial Assault",
                Type = CardType.Mission,
                Alignment = Alignment.Dark,
                CardText = "Deal 2 damage to all enemy ground units.",
            },
            new()
            {
                Name = "Smuggling Run",
                Type = CardType.Mission,
                Alignment = Alignment.Neutral,
                CardText = "Draw 2 cards, then discard 1.",
            },
            // Battle Cards
            new()
            {
                Name = "Ambush",
                Type = CardType.Battle,
                Alignment = Alignment.Neutral,
                CardText = "Your unit deals damage first this combat.",
            },
            new()
            {
                Name = "Force Push",
                Type = CardType.Battle,
                Alignment = Alignment.Light,
                CardText = "Remove target enemy unit from combat.",
            },
            new()
            {
                Name = "Force Choke",
                Type = CardType.Battle,
                Alignment = Alignment.Dark,
                CardText = "Deal 2 damage to target character.",
            },
        };

        dbContext.Cards.AddRange(testCards);
        await dbContext.SaveChangesAsync();

        return Ok(new SeedCardsResult(testCards.Count, existingCount + testCards.Count));
    }

    /// <summary>
    /// Scrape card text from swtcg.com for cards that don't have card text.
    /// </summary>
    [HttpPost("scrape-card-texts")]
    [ProducesResponseType(typeof(CardTextScrapeResult), 200)]
    public async Task<IActionResult> ScrapeCardTexts(CancellationToken cancellationToken)
    {
        var result = await cardTextScraperService.ScrapeCardTextsAsync(cancellationToken);
        return Ok(result);
    }
}

public record UserRoleDto(string Id, string Email, string Name, List<string> Roles);

public record AssignRoleDto(string Email, string Role);

public record SeedCardsResult(int CardsAdded, int TotalCards);

public record UserStatsDto(string Id, string DisplayName, string Email, int DeckCount, DateTime CreatedAt);
