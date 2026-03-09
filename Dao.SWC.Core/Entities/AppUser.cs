using Microsoft.AspNetCore.Identity;

namespace Dao.SWC.Core.Entities;

public class AppUser : IdentityUser, ITrackingBase
{
    public string? RefreshToken { get; set; }
    public DateTime? RefreshTokenExpiry { get; set; }
    public string? DisplayName { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
