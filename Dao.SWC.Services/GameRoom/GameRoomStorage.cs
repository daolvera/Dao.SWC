using System.Collections.Concurrent;
using Dao.SWC.Core.GameRoom;

namespace Dao.SWC.Services.GameRoom;

/// <summary>
/// Singleton storage for game rooms.
/// </summary>
public class GameRoomStorage : IGameRoomStorage
{
    public ConcurrentDictionary<string, Core.GameRoom.GameRoom> Rooms { get; } = new();
}
