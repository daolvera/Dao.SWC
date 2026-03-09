using Dao.SWC.Core.Entities;

namespace Dao.SWC.Core.Authentication;

public record UserDto(string Id, string Name, string? Email)
{
    public static UserDto FromAppUser(AppUser appUser)
    {
        return new UserDto(appUser.Id, appUser.UserName ?? appUser.DisplayName ?? "User", appUser.Email);
    }
}
