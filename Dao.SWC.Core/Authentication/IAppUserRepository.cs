using Dao.SWC.Core.Entities;

namespace Dao.SWC.Core.Authentication;

public interface IAppUserRepository
{
    Task SaveRefreshTokenAsync(string appUserId, string refreshToken, DateTime refreshTokenExpiry);
    Task<AppUser?> GetByRefreshTokenAsync(string refreshToken);
}
