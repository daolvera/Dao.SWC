using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Dao.SWC.Services.Migrations
{
    /// <inheritdoc />
    public partial class AddIsPilot : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsPilot",
                table: "Cards",
                type: "bit",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsPilot",
                table: "Cards");
        }
    }
}
