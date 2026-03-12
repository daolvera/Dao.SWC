using Dao.SWC.Core;
using Dao.SWC.Core.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace Dao.SWC.ApiService.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = Constants.Roles.Admin)]
public class AdminController(
    UserManager<AppUser> userManager,
    RoleManager<IdentityRole> roleManager
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
}

public record UserRoleDto(string Id, string Email, string Name, List<string> Roles);

public record AssignRoleDto(string Email, string Role);
