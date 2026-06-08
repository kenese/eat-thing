using System.Diagnostics;
using Npgsql;

namespace EatThing.Api.Tests.Infrastructure;

internal static class DrizzleTestSchema
{
    public static async Task PushAsync(string connectionString)
    {
        var serverDirectory = FindServerDirectory();

        var process = new Process
        {
            StartInfo = new ProcessStartInfo
            {
                FileName = "pnpm",
                WorkingDirectory = serverDirectory,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
            },
        };

        process.StartInfo.ArgumentList.Add("exec");
        process.StartInfo.ArgumentList.Add("drizzle-kit");
        process.StartInfo.ArgumentList.Add("push");
        process.StartInfo.ArgumentList.Add("--force");
        process.StartInfo.Environment["DATABASE_DIRECT_URL"] = ToPostgresUrl(connectionString);

        process.Start();

        var stdout = await process.StandardOutput.ReadToEndAsync();
        var stderr = await process.StandardError.ReadToEndAsync();
        await process.WaitForExitAsync();

        if (process.ExitCode != 0)
        {
            throw new InvalidOperationException(
                $"drizzle-kit push failed with exit code {process.ExitCode}.{Environment.NewLine}{stdout}{Environment.NewLine}{stderr}");
        }
    }

    private static string FindServerDirectory()
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);

        while (current is not null)
        {
            var candidate = Path.Combine(current.FullName, "apps", "server");
            if (File.Exists(Path.Combine(candidate, "drizzle.config.ts")))
            {
                return candidate;
            }

            current = current.Parent;
        }

        throw new DirectoryNotFoundException("Could not locate apps/server from the test output directory.");
    }

    private static string ToPostgresUrl(string connectionString)
    {
        var builder = new NpgsqlConnectionStringBuilder(connectionString);
        var username = Uri.EscapeDataString(builder.Username ?? string.Empty);
        var password = Uri.EscapeDataString(builder.Password ?? string.Empty);
        var database = Uri.EscapeDataString(builder.Database ?? string.Empty);

        return $"postgres://{username}:{password}@{builder.Host}:{builder.Port}/{database}";
    }
}
