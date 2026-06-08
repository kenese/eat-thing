namespace EatThing.Api.Data;

public sealed class CanonicalFood
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string DefaultUnit { get; set; } = string.Empty;
    public string Category { get; set; } = "other";
    public string[] Aliases { get; set; } = [];
    public double? DensityGPerMl { get; set; }
    public double? CountToGrams { get; set; }
    public DateTime CreatedAt { get; set; }
}