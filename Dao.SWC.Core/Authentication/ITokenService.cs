using Dao.SWC.Core.Entities;
using System.Security.Claims;

namespace Dao.SWC.Core.Authentication;

public interface ITokenService
{
    Task<TokenResponse> GenerateTokenAsync(AppUser user);
    Task<TokenResponse> RefreshTokenAsync(string refreshToken);
    ClaimsPrincipal? GetPrincipalFromExpiredToken(string token);
}
