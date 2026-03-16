using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace Dao.SWC.ApiService.Extensions;

public static class ClaimsPrincipalExtensions
{
    extension(ClaimsPrincipal principal)
    {
        public string? GetAppUserId()
        {
            // Check for NameIdentifier first (most common in .NET Identity)
            var claim = principal
                .Claims.FirstOrDefault(c => c.Type == ClaimTypes.NameIdentifier)
                ?.Value;

            // Try "sub" claim (JWT standard - note: .NET JWT handler may remap this)
            claim ??= principal.Claims.FirstOrDefault(c => c.Type == "sub")?.Value;

            // Try the registered JWT claim name constant
            claim ??= principal
                .Claims.FirstOrDefault(c => c.Type == JwtRegisteredClaimNames.Sub)
                ?.Value;

            return claim;
        }
    }
}
