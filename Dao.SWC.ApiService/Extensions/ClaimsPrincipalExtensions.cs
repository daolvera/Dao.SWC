using System.Security.Claims;

namespace Dao.SWC.ApiService.Extensions;

public static class ClaimsPrincipalExtensions
{
    extension(ClaimsPrincipal principal)
    {
        public string GetAppUserId()
        {
            var claim = principal.Claims.FirstOrDefault(c => c.Type == "sub")?.Value;

            // Try the application cookie claim
            claim ??= principal.Claims.FirstOrDefault(c => c.Type == ClaimTypes.NameIdentifier)?.Value;

            if (claim is null)
            {
                throw new ArgumentException("User is not authenticated");
            }

            return claim;
        }
    }
}
