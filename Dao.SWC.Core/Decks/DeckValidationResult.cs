namespace Dao.SWC.Core.Decks;

public record DeckValidationResult(
    bool IsValid,
    IEnumerable<string> Errors,
    IEnumerable<string> Warnings
)
{
    public static DeckValidationResult Valid() => new(true, [], []);

    public static DeckValidationResult Invalid(
        IEnumerable<string> errors,
        IEnumerable<string>? warnings = null
    ) => new(false, errors, warnings ?? []);
}
