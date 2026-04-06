# Stage 1: Build the .NET application
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy solution-level files and project files for restore
COPY Dao.SWC.Core/Dao.SWC.Core.csproj Dao.SWC.Core/
COPY Dao.SWC.ServiceDefaults/Dao.SWC.ServiceDefaults.csproj Dao.SWC.ServiceDefaults/
COPY Dao.SWC.Services/Dao.SWC.Services.csproj Dao.SWC.Services/
COPY Dao.SWC.ApiService/Dao.SWC.ApiService.csproj Dao.SWC.ApiService/
RUN dotnet restore Dao.SWC.ApiService/Dao.SWC.ApiService.csproj

# Copy all source and publish
COPY Dao.SWC.Core/ Dao.SWC.Core/
COPY Dao.SWC.ServiceDefaults/ Dao.SWC.ServiceDefaults/
COPY Dao.SWC.Services/ Dao.SWC.Services/
COPY Dao.SWC.ApiService/ Dao.SWC.ApiService/
RUN dotnet publish Dao.SWC.ApiService/Dao.SWC.ApiService.csproj -c Release -o /app/publish

# Stage 2: Runtime with Playwright Chromium support
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final

# Install PowerShell (required by Playwright install script)
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    apt-transport-https \
    && wget -q https://packages.microsoft.com/config/debian/12/packages-microsoft-prod.deb \
    && dpkg -i packages-microsoft-prod.deb \
    && rm packages-microsoft-prod.deb \
    && apt-get update && apt-get install -y --no-install-recommends powershell \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build /app/publish .

# Install Playwright Chromium browser and its OS dependencies
RUN pwsh playwright.ps1 install --with-deps chromium

EXPOSE 8080

ENTRYPOINT ["dotnet", "Dao.SWC.ApiService.dll"]
