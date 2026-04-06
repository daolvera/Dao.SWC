# Stage 1: Build the .NET application
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy project files for restore
COPY Dao.SWC.Core/Dao.SWC.Core.csproj Dao.SWC.Core/
COPY Dao.SWC.ServiceDefaults/Dao.SWC.ServiceDefaults.csproj Dao.SWC.ServiceDefaults/
COPY Dao.SWC.Services/Dao.SWC.Services.csproj Dao.SWC.Services/
COPY Dao.SWC.ApiService/Dao.SWC.ApiService.csproj Dao.SWC.ApiService/
RUN dotnet restore Dao.SWC.ApiService/Dao.SWC.ApiService.csproj

# Copy all source and publish
COPY . .
RUN dotnet publish Dao.SWC.ApiService/Dao.SWC.ApiService.csproj -c Release -o /app/publish --no-restore

# Stage 2: Runtime with Playwright Chromium support
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app

# Install Playwright Chromium dependencies (Debian-based)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 \
    libatk1.0-0t64 \
    libatk-bridge2.0-0t64 \
    libcups2t64 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2t64 \
    libxshmfence1 \
    fonts-liberation \
    libappindicator3-1 \
    xdg-utils \
    wget \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/publish .

# Install Playwright Chromium browser
RUN pwsh playwright.ps1 install chromium || \
    dotnet tool install --global Microsoft.Playwright.CLI && \
    /root/.dotnet/tools/playwright install chromium

EXPOSE 8080

ENTRYPOINT ["dotnet", "Dao.SWC.ApiService.dll"]
