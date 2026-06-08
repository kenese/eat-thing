using Microsoft.EntityFrameworkCore;

namespace EatThing.Api.Data;

public sealed class EatThingDbContext(DbContextOptions<EatThingDbContext> options)
    : DbContext(options)
{
    public DbSet<CanonicalFood> CanonicalFoods => Set<CanonicalFood>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<CanonicalFood>(entity =>
        {
            entity.ToTable("canonical_foods");

            entity.HasKey(food => food.Id);

            entity.Property(food => food.Id).HasColumnName("id");
            entity.Property(food => food.Name).HasColumnName("name");
            entity.Property(food => food.DefaultUnit).HasColumnName("default_unit");
            entity.Property(food => food.Category).HasColumnName("category");
            entity.Property(food => food.Aliases).HasColumnName("aliases");
            entity.Property(food => food.DensityGPerMl).HasColumnName("density_g_per_ml");
            entity.Property(food => food.CountToGrams).HasColumnName("count_to_grams");
            entity.Property(food => food.CreatedAt).HasColumnName("created_at");
        });
    }
}