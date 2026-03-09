namespace Dao.SWC.Core.Authentication;

public record TokenResponse(string AccessToken, string RefreshToken, DateTime ExpiresAt);
