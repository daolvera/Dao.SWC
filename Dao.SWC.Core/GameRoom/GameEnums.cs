namespace Dao.SWC.Core.GameRoom;

public enum RoomType
{
    OneVsOne,
    TwoVsTwo,
    OneVsTwo,
}

public enum GameState
{
    Waiting,
    InProgress,
    Finished,
}

public enum Team
{
    Team1,
    Team2,
}

public enum CardZone
{
    Deck,
    Hand,
    PlayArea,
    Discard,
}
