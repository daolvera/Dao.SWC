namespace Dao.SWC.Core.GameRoom;

public enum RoomType
{
    OneVsOne = 1,
    TwoVsTwo = 2,
    OneVsTwo = 3,
}

public enum GameState
{
    Waiting,
    InProgress,
    Finished,
}

public enum Team
{
    Team1 = 1,
    Team2 = 2,
}

public enum CardZone
{
    Deck,
    Hand,
    PlayArea,
    Discard,
}
