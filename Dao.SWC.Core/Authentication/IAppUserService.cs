namespace Dao.SWC.Core.Authentication;

public interface IAppUserService
{
    Task<UserDto?> GetByAppUserIdAsync(string appUserId);
}
