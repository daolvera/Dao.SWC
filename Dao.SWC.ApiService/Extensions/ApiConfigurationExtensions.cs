using Dao.SWC.Core;
using System.Threading.RateLimiting;

namespace Dao.SWC.ApiService.Extensions;

public static class ApiConfigurationExtensions
{
    extension(IServiceCollection services)
    {
        public IServiceCollection AddLoginInRateLimiter()
        {
            services.AddRateLimiter(options =>
            {
                options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

                // Named policy for stricter anonymous endpoint limiting (e.g., login, register)
                options.AddPolicy(
                    Constants.AnonymousPolicy,
                    context =>
                    {
                        return RateLimitPartition.GetSlidingWindowLimiter(
                            context.ClientIpAddress,
                            _ => new SlidingWindowRateLimiterOptions
                            {
                                PermitLimit = 10,
                                Window = TimeSpan.FromMinutes(1),
                                SegmentsPerWindow = 2,
                                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                                QueueLimit = 0,
                            }
                        );
                    }
                );
            });
            return services;
        }

        public IServiceCollection AddSpaCors(string appUrl)
        {
            services.AddCors(options =>
            {
                options.AddPolicy(
                    "AllowAngularApp",
                    policy =>
                    {
                        // Allow both http and https versions (Azure Container Apps uses https publicly)
                        var origins = new List<string> { appUrl };
                        if (appUrl.StartsWith("http://"))
                        {
                            origins.Add(appUrl.Replace("http://", "https://"));
                        }

                        policy.WithOrigins([.. origins]).AllowAnyMethod().AllowAnyHeader().AllowCredentials();
                    }
                );
            });
            return services;
        }
    }

    extension(HttpContext httpContext)
    {
        public string ClientIpAddress
        {
            get
            {
                // First check X-Forwarded-For header (set by reverse proxies like Azure Container Apps)
                var forwardedFor = httpContext.Request.Headers["X-Forwarded-For"].FirstOrDefault();
                if (!string.IsNullOrEmpty(forwardedFor))
                {
                    // X-Forwarded-For can contain multiple IPs, take the first (original client)
                    var ip = forwardedFor.Split(',').FirstOrDefault()?.Trim();
                    if (!string.IsNullOrEmpty(ip))
                    {
                        return ip;
                    }
                }

                // Fall back to RemoteIpAddress
                return httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
            }
        }
    }
}
