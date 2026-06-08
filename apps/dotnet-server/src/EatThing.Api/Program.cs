using EatThing.Api.Data;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

var connectionString = builder.Configuration.GetConnectionString("EatThing");

if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException("Connection string 'EatThing' is not configured.");
}

builder.Services.AddDbContext<EatThingDbContext>(options =>
    options.UseNpgsql(connectionString));

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

app.MapGet("/healthz", () => Results.Ok(new { status = "ok" }));
app.MapGet("/healthz/db", async (EatThingDbContext db) =>
{
    try
    {
        await db.Database.OpenConnectionAsync();
        await db.Database.CloseConnectionAsync();

        return Results.Ok(new { status = "ok" });
    }
    catch (Exception ex)
    {
        return Results.Problem(
            detail: ex.Message,
            title: ex.GetType().FullName);
    }
});

app.MapGet("/api/foods", async (EatThingDbContext db, string? q, int? limit) =>
{
    var maxRows = Math.Clamp(limit.GetValueOrDefault(50), 1, 100);
    var query = db.CanonicalFoods.AsNoTracking();
    
    if (!string.IsNullOrWhiteSpace(q))
    {
        var pattern = $"%{q.Trim()}%";
        query = query.Where(food => EF.Functions.ILike(food.Name, pattern));
    }
    var foods = await query
        .OrderBy(food => food.Name)
        .Take(maxRows)
        .Select(food => new
        {
            food.Id,
            food.Name,
            food.DefaultUnit,
            food.Aliases,
            food.DensityGPerMl,
            food.CountToGrams
        })
        .ToListAsync();

    return Results.Ok(foods);
});

app.Run();

public partial class Program;