using System.Collections.Concurrent;

namespace Dao.SWC.Core.GameRoom;

/// <summary>
/// Singleton storage for game rooms (in-memory).
/// </summary>
public interface IGameRoomStorage
{
    ConcurrentDictionary<string, GameRoom> Rooms { get; }
}
