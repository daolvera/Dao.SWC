# Dao.SWC

A Star Wars CCG deck building and online play application.

## Overview

Dao.SWC is a web application for managing Star Wars Customizable Card Game decks and playing games online. Users can browse the card database, build decks, and play against others in real-time.

## Architecture

Built with .NET Aspire for orchestration:

- **Dao.SWC.Web** - Angular frontend
- **Dao.SWC.ApiService** - ASP.NET Core API with SignalR for real-time gameplay
- **Dao.SWC.Core** - Domain entities and business logic
- **Dao.SWC.Services** - Application services
- **Dao.SWC.MigrationService** - Database migrations
- **Dao.SWC.CardImporter** - Card data import tool

## Tech Stack

- .NET 8 / ASP.NET Core
- Angular
- PostgreSQL
- Azure Blob Storage (card images)
- SignalR (real-time game communication)

## Getting Started

1. Ensure you have .NET 8 SDK and Node.js installed
2. Run the AppHost project:
   ```
   dotnet run --project Dao.SWC.AppHost
   ```
3. The Aspire dashboard will open with links to all services

## Development

- API runs with Swagger UI in development
- Card importer is set to explicit start (run manually when needed)
- Local development uses containerized PostgreSQL and Azurite for blob storage