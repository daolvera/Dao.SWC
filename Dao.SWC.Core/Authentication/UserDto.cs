using Dao.SWC.Core.Entities;

namespace Dao.SWC.Core.Authentication;

public record UserDto(string Id, string Name, string? Email, IList<string> Roles)
{
    public static UserDto FromAppUser(AppUser appUser, IList<string> roles)
    {
        return new UserDto(
            appUser.Id,
            appUser.UserName ?? appUser.DisplayName ?? "User",
            appUser.Email,
            roles
        );
    }
}
