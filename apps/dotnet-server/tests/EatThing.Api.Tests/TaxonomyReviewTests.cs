// describe('findExistingFoodOrRequireReview', () => {
//     beforeEach(() => {
//         mocks.selectResult = [];
//         mocks.insertResult = [{ id: 'new-uuid' }];
//     });
//
//     it('returns existing food id when name matches', async () => {
//         mocks.selectResult = [{ id: 'existing-uuid', name: 'Milk', defaultUnit: 'ml', category: 'dairy' }];
//         const result = await findExistingFoodOrRequireReview('Milk', 'dairy', 'ml');
//         expect(result).toEqual({ kind: 'existing', id: 'existing-uuid' });
//     });
//
//     it('requires taxonomy review when there is no exact match', async () => {
//         mocks.selectResult = [];
//         const result = await findExistingFoodOrRequireReview('Dish Soap', 'other', 'count');
//         expect(result).toEqual({
//             kind: 'review',
//             proposed: {
//                 name: 'Dish Soap',
//                 category: 'other',
//                 defaultUnit: 'count',
//             },
//             matches: [],
//         });
//     });
//
//     it('includes suggested matches when similar canonical foods exist', async () => {
//         mocks.selectResult = [
//             { id: 'match-1', name: 'Dish soap', defaultUnit: 'count', category: 'other' },
//             { id: 'match-2', name: 'Hand soap', defaultUnit: 'count', category: 'other' },
//         ];
//         const result = await findExistingFoodOrRequireReview('Soap', 'other', 'count');
//         expect(result).toEqual({
//             kind: 'review',
//             proposed: {
//                 name: 'Soap',
//                 category: 'other',
//                 defaultUnit: 'count',
//             },
//             matches: [
//             { id: 'match-1', name: 'Dish soap', defaultUnit: 'count', category: 'other' },
//             { id: 'match-2', name: 'Hand soap', defaultUnit: 'count', category: 'other' },
//             ],
//         });
//     });
// });

using System.Net;
using System.Net.Http.Json;
using EatThing.Api.Data;
using EatThing.Api.Tests.Infrastructure;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Testcontainers.PostgreSql;

namespace EatThing.Api.Tests;

public sealed class TaxonomyReviewTests : IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:16-alpine")
        .WithDatabase("eatthing_test")
        .WithUsername("postgres")
        .WithPassword("postgres")
        .Build();

    private WebApplicationFactory<Program> _factory = null!;

    public async Task InitializeAsync()
    {
        await _postgres.StartAsync();
        await DrizzleTestSchema.PushAsync(_postgres.GetConnectionString());

        _factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.UseSetting("ConnectionStrings:EatThing", _postgres.GetConnectionString());

                builder.ConfigureServices(services =>
                {
                    using var scope = services.BuildServiceProvider().CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<EatThingDbContext>();

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
