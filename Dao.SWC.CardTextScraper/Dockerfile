FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src

# Copy project files for restore
COPY Dao.SWC.CardTextScraper/Dao.SWC.CardTextScraper.csproj Dao.SWC.CardTextScraper/
COPY Dao.SWC.Services/Dao.SWC.Services.csproj Dao.SWC.Services/
COPY Dao.SWC.Core/Dao.SWC.Core.csproj Dao.SWC.Core/
COPY Dao.SWC.ServiceDefaults/Dao.SWC.ServiceDefaults.csproj Dao.SWC.ServiceDefaults/
RUN dotnet restore Dao.SWC.CardTextScraper/Dao.SWC.CardTextScraper.csproj

# Copy source and publish
COPY Dao.SWC.CardTextScraper/ Dao.SWC.CardTextScraper/
COPY Dao.SWC.Services/ Dao.SWC.Services/
COPY Dao.SWC.Core/ Dao.SWC.Core/
COPY Dao.SWC.ServiceDefaults/ Dao.SWC.ServiceDefaults/
RUN dotnet publish Dao.SWC.CardTextScraper/Dao.SWC.CardTextScraper.csproj \
    -c $BUILD_CONFIGURATION \
    -o /app/publish \
    /p:UseAppHost=false

# Install Playwright Chromium browser binaries (SDK image has pwsh)
RUN pwsh /app/publish/playwright.ps1 install chromium

FROM mcr.microsoft.com/dotnet/runtime:10.0 AS final
WORKDIR /app

# Install Chromium runtime OS dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libasound2t64 \
    libatk-bridge2.0-0 \
    libatk1.0-0t64 \
    libatspi2.0-0t64 \
    libcairo2 \
    libcups2t64 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libglib2.0-0t64 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libwayland-client0 \
    libx11-6 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    libxshmfence1 \
    fonts-liberation \
    fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/publish .
COPY --from=build /root/.cache/ms-playwright /root/.cache/ms-playwright

ENTRYPOINT ["dotnet", "Dao.SWC.CardTextScraper.dll"]
