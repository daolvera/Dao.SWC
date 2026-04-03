using System.ComponentModel.DataAnnotations;

namespace Dao.SWC.MigrationService;

public class MigrationOptions
{
    public const string SectionName = "MigrationOptions";
    [Required]
    public required List<string> AdminEmails { get; set; }
}
