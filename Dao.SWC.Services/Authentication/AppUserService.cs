using Dao.SWC.Core.Authentication;
using Dao.SWC.Core.Entities;
using Dao.SWC.Services.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Dao.SWC.Services.Authentication;

public class AppUserService(SwcDbContext dbContext, UserManager<AppUser> userManager)
    : IAppUserService
{
    public async Task<UserDto?> GetByAppUserIdAsync(string appUserId)
    {
        var user = await dbContext.Users.FirstOrDefaultAsync(u => u.Id == appUserId);
        if (user is null)
            return null;

        var roles = await userManager.GetRolesAsync(user);
        return UserDto.FromAppUser(user, roles);
    }
}
