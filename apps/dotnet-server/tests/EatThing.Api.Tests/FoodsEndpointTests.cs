using System.Net;
using System.Net.Http.Json;
using EatThing.Api.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Testcontainers.PostgreSql;

namespace EatThing.Api.Tests;

public sealed class FoodsEndpointTests : IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder()
        .WithImage("postgres:16-alpine")
        .WithDatabase("eatthing_test")
        .WithUsername("postgres")
        .WithPassword("postgres")
        .Build();

    private WebApplicationFactory<Program> _factory = null!;

    public async Task InitializeAsync()
    {
        await _postgres.StartAsync();

        _factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.UseSetting("ConnectionStrings:EatThing", _postgres.GetConnectionString());

                builder.ConfigureServices(services =>
                {
                    using var scope = services.BuildServiceProvider().CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<EatThingDbContext>();

                    db.Database.ExecuteSqlRaw("""
                        CREATE TABLE canonical_foods (
                            id uuid PRIMARY KEY,
                            name text NOT NULL UNIQUE,
                            default_unit text NOT NULL,
                            category text NOT NULL DEFAULT 'other',
                            aliases text[] NOT NULL DEFAULT ARRAY[]::text[],
                            density_g_per_ml double precision,
                            count_to_grams double precision,
                            created_at timestamp NOT NULL DEFAULT now()
                        );
                    """);

                    db.CanonicalFoods.AddRange(
                        new CanonicalFood { Id = Guid.Parse("11111111-1111-1111-1111-111111111111"), Name = "Tomato", DefaultUnit = "g", Category = "produce" },
                        new CanonicalFood { Id = Guid.Parse("22222222-2222-2222-2222-222222222222"), Name = "Flour", DefaultUnit = "g", Category = "pantry" }
                    );

                    db.SaveChanges();
                });
            });
    }

    [Fact]
    public async Task Foods_ReturnsCaseInsensitiveMatches()
    {
        using var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/foods?q=tom&limit=5");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var foods = await response.Content.ReadFromJsonAsync<List<FoodResponse>>();

        Assert.NotNull(foods);
        var food = Assert.Single(foods);
        Assert.Equal("Tomato", food.Name);
        Assert.Equal("g", food.DefaultUnit);
    }

    public async Task DisposeAsync()
    {
        await _factory.DisposeAsync();
        await _postgres.DisposeAsync();
    }

    private sealed record FoodResponse(
        Guid Id,
        string Name,
        string DefaultUnit,
        string[] Aliases,
        double? DensityGPerMl,
        double? CountToGrams);
}