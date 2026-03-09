using Dao.SWC.Core;
using Dao.SWC.Core.Authentication;
using Dao.SWC.Core.Entities;
using Dao.SWC.Services.Authentication;
using Dao.SWC.Services.Data;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
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

    extension(WebApplicationBuilder builder)
    {
        public void AddGoogleAuthentication()
        {
            builder.Services.Configure<JwtOptions>(
            builder.Configuration.GetSection(JwtOptions.SectionName)
        );

            builder
                .Services.AddOptionsWithValidateOnStart<JwtOptions>()
                .Bind(builder.Configuration.GetSection(JwtOptions.SectionName))
                .ValidateDataAnnotations();

            builder
                .Services.AddIdentityCore<AppUser>(options =>
                {
                    options.User.RequireUniqueEmail = true;
                })
                .AddEntityFrameworkStores<SwcDbContext>()
                .AddDefaultTokenProviders();

            // Use a service provider to access the configured JwtOptions
            var serviceProvider = builder.Services.BuildServiceProvider();
            var jwtOptions = serviceProvider.GetRequiredService<IOptions<JwtOptions>>().Value;

            builder
                .Services.AddAuthentication(options =>
                {
                    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
                    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
                    options.DefaultSignInScheme = CookieAuthenticationDefaults.AuthenticationScheme;
                    options.DefaultScheme = JwtBearerDefaults.AuthenticationScheme;
                })
                .AddJwtBearer(options =>
                {
                    options.SaveToken = true;
                    options.TokenValidationParameters = new TokenValidationParameters()
                    {
                        IssuerSigningKey = JwtTokenService.GetSecurityKey(jwtOptions.Key),
                        ValidIssuer = jwtOptions.Issuer,
                        ValidateIssuer = true,
                        ValidAudiences = [jwtOptions.Audience],
                        ValidateAudience = true,
                        ValidateLifetime = true,
                        ValidateIssuerSigningKey = true,
                    };
                    options.Events = new()
                    {
                        OnMessageReceived = context =>
                        {
                            // First, check for SignalR access token in query string
                            // SignalR sends the token via query string for WebSocket connections
                            var accessToken = context.Request.Query["access_token"];
                            var path = context.HttpContext.Request.Path;

                            if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
                            {
                                context.Token = accessToken;
                                return Task.CompletedTask;
                            }

                            // Fall back to cookie-based authentication for regular HTTP requests
                            var token = context.Request.Cookies[Constants.Authentication.AccessTokenCookieKey];

                            if (!string.IsNullOrEmpty(token))
                            {
                                context.Token = token;
                            }

                            return Task.CompletedTask;
                        },
                    };
                })
                .AddCookie(
                    CookieAuthenticationDefaults.AuthenticationScheme,
                    options =>
                    {
                        options.ExpireTimeSpan = TimeSpan.FromMinutes(5);
                        options.Events.OnRedirectToLogin = context =>
                        {
                            context.Response.StatusCode = 401;
                            return Task.CompletedTask;
                        };
                        options.Events.OnRedirectToAccessDenied = context =>
                        {
                            context.Response.StatusCode = 403;
                            return Task.CompletedTask;
                        };
                    }
                )
                .AddGoogle(options =>
                {
                    options.SignInScheme = CookieAuthenticationDefaults.AuthenticationScheme;
                    options.ClientId = builder.Configuration["Authentication:Google:ClientId"]!;
                    options.ClientSecret = builder.Configuration["Authentication:Google:ClientSecret"]!;
                    options.CallbackPath = "/Auth/google/callback";
                });

            builder.Services.AddAuthorization();
        }
    }
}
