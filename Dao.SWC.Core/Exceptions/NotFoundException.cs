namespace Dao.SWC.Core.Exceptions;

public class NotFoundException(string displayName) : ApplicationException($"The entity {displayName} could not be found")
{
}
