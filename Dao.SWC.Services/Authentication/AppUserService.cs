using Dao.SWC.Core.Authentication;
using Dao.SWC.Services.Data;
using Microsoft.EntityFrameworkCore;

namespace Dao.SWC.Services.Authentication;

public class AppUserService(SwcDbContext dbContext) : IAppUserService
{
    public async Task<UserDto?> GetByAppUserIdAsync(string appUserId)
    {
        var user = await dbContext.Users.FirstOrDefaultAsync(u => u.Id == appUserId);
        return user is null ? null : UserDto.FromAppUser(user);
    }
}
