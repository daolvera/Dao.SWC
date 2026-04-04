using Dao.SWC.Services.DeckImport;

namespace Dao.SWC.Tests.DeckImport;

[TestClass]
public class CsvDeckParsingServiceTests
{
    private CsvDeckParsingService _service = null!;

    [TestInitialize]
    public void Setup()
    {
        _service = new CsvDeckParsingService();
    }

    [TestMethod]
    public void ParseCsv_EmptyContent_ReturnsEmptyList()
    {
        var entries = _service.ParseCsv("");
        Assert.AreEqual(0, entries.Count);
    }

    [TestMethod]
    public void ParseCsv_WithHeaderAndData_ParsesCorrectly()
    {
        var csv = """
            Quantity,CardName,Version
            3,Yoda,J
            2,Mace Windu,C
            1,Obi-Wan Kenobi,
            """;

        var entries = _service.ParseCsv(csv);

        Assert.AreEqual(3, entries.Count);

        Assert.AreEqual(3, entries[0].Quantity);
        Assert.AreEqual("Yoda", entries[0].CardName);
        Assert.AreEqual("J", entries[0].Version);

        Assert.AreEqual(2, entries[1].Quantity);
        Assert.AreEqual("Mace Windu", entries[1].CardName);
        Assert.AreEqual("C", entries[1].Version);

        Assert.AreEqual(1, entries[2].Quantity);
        Assert.AreEqual("Obi-Wan Kenobi", entries[2].CardName);
        Assert.IsNull(entries[2].Version);
    }

    [TestMethod]
    public void ParseCsv_NoHeader_ReturnsEmptyList()
    {
        var csv = """
            3,Yoda,J
            2,Mace Windu,C
            """;

        var entries = _service.ParseCsv(csv);

        Assert.AreEqual(0, entries.Count);
    }

    [TestMethod]
    public void ParseCsv_QuantityOverFour_ClampedToFour()
    {
        var csv = """
            Quantity,CardName,Version
            10,Yoda,J
            """;

        var entries = _service.ParseCsv(csv);

        Assert.AreEqual(1, entries.Count);
        Assert.AreEqual(4, entries[0].Quantity);
    }

    [TestMethod]
    public void ParseCsv_ZeroQuantity_SkipsRow()
    {
        var csv = """
            Quantity,CardName,Version
            0,Yoda,J
            3,Mace Windu,C
            """;

        var entries = _service.ParseCsv(csv);

        Assert.AreEqual(1, entries.Count);
        Assert.AreEqual("Mace Windu", entries[0].CardName);
    }

    [TestMethod]
    public void ParseCsv_InvalidQuantity_SkipsRow()
    {
        var csv = """
            Quantity,CardName,Version
            abc,Yoda,J
            3,Mace Windu,C
            """;

        var entries = _service.ParseCsv(csv);

        Assert.AreEqual(1, entries.Count);
        Assert.AreEqual("Mace Windu", entries[0].CardName);
    }

    [TestMethod]
    public void ParseCsv_EmptyCardName_SkipsRow()
    {
        var csv = """
            Quantity,CardName,Version
            3,,J
            2,Mace Windu,C
            """;

        var entries = _service.ParseCsv(csv);

        Assert.AreEqual(1, entries.Count);
        Assert.AreEqual("Mace Windu", entries[0].CardName);
    }

    [TestMethod]
    public void ParseCsv_WhitespaceInHeader_Accepted()
    {
        var csv = """
            Quantity, CardName, Version
            3,Yoda,J
            """;

        var entries = _service.ParseCsv(csv);

        Assert.AreEqual(1, entries.Count);
        Assert.AreEqual("Yoda", entries[0].CardName);
    }

    [TestMethod]
    public void ParseCsv_CaseInsensitiveHeader_Accepted()
    {
        var csv = """
            QUANTITY,CARDNAME,VERSION
            3,Yoda,J
            """;

        var entries = _service.ParseCsv(csv);

        Assert.AreEqual(1, entries.Count);
        Assert.AreEqual("Yoda", entries[0].CardName);
    }

    [TestMethod]
    public void ParseCsv_TrimsWhitespace()
    {
        var csv = """
            Quantity,CardName,Version
              3  ,  Yoda  ,  J  
            """;

        var entries = _service.ParseCsv(csv);

        Assert.AreEqual(1, entries.Count);
        Assert.AreEqual("Yoda", entries[0].CardName);
        Assert.AreEqual("J", entries[0].Version);
    }
}
