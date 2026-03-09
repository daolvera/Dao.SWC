namespace Dao.SWC.Core.Entities;

public abstract class TrackingBase : ITrackingBase
{
    public DateTime CreatedAt { get; set; }
    public int? CreatedByAppUserId { get; set; }
    public AppUser? CreatedByAppUser { get; set; }
}

public interface ITrackingBase
{
    DateTime CreatedAt { get; set; }
}
