using Dao.SWC.Core.Authentication;
using Dao.SWC.Core.Entities;
using Dao.SWC.Core.Exceptions;
using Dao.SWC.Services.Data;
using Microsoft.EntityFrameworkCore;

namespace Dao.SWC.Services.Authentication;

public class AppUserRepository(SwcDbContext DbContext) : IAppUserRepository
{
    public async Task SaveRefreshTokenAsync(string appUserId, string refreshToken, DateTime refreshTokenExpiry)
    {
        var user = await DbContext.Users.FindAsync(appUserId) ??
            throw new NotFoundException($"App user {appUserId}");
        user.RefreshToken = refreshToken;
        user.RefreshTokenExpiry = refreshTokenExpiry;
        await DbContext.SaveChangesAsync();
    }

    public async Task<AppUser?> GetByRefreshTokenAsync(string refreshToken)
    {
        return await DbContext.Users
            .FirstOrDefaultAsync(u => u.RefreshToken == refreshToken);
    }
}
