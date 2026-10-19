using System;
using System.Collections;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Security.Cryptography;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;

internal sealed class ReleaseAsset
{
    public string Url { get; set; }
    public string Sha256 { get; set; }
}

internal sealed class LauncherForm : Form
{
    private readonly Label status;
    private readonly ProgressBar progress;
    private readonly Button downloadButton;

    public LauncherForm()
    {
        Text = "Ban Wars Launcher";
        ClientSize = new Size(420, 150);
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        StartPosition = FormStartPosition.CenterScreen;

        status = new Label
        {
            AutoSize = false,
            Location = new Point(20, 20),
            Size = new Size(380, 38),
            Text = "Download the latest Ban Wars installer from GitHub."
        };
        progress = new ProgressBar
        {
            Location = new Point(20, 65),
            Size = new Size(380, 20),
            Style = ProgressBarStyle.Continuous
        };
        downloadButton = new Button
        {
            Location = new Point(250, 102),
            Size = new Size(150, 30),
            Text = "Download and install"
        };
        downloadButton.Click += StartDownload;

        Controls.Add(status);
        Controls.Add(progress);
        Controls.Add(downloadButton);
    }

    private async void StartDownload(object sender, EventArgs e)
    {
        downloadButton.Enabled = false;
        progress.Value = 0;
        status.Text = "Finding the latest Ban Wars release...";

        try
        {
            ReleaseAsset asset = await Task.Factory.StartNew<ReleaseAsset>(
                new Func<ReleaseAsset>(FindLatestInstaller));
            string directory = Path.Combine(Path.GetTempPath(), "BanWars-" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(directory);
            string installerPath = Path.Combine(directory, "Ban-Wars-Setup.exe");

            status.Text = "Downloading the installer...";
            using (WebClient client = new WebClient())
            {
                client.Headers[HttpRequestHeader.UserAgent] = "BanWarsDiscordLauncher";
                client.DownloadProgressChanged += (s, args) =>
                {
                    progress.Value = Math.Max(0, Math.Min(100, args.ProgressPercentage));
                    status.Text = "Downloading the installer... " + args.ProgressPercentage + "%";
                };
                await client.DownloadFileTaskAsync(new Uri(asset.Url), installerPath);
            }

            status.Text = "Verifying the installer...";
            string actualHash = await Task.Factory.StartNew<string>(
                () => CalculateSha256(installerPath));
            if (!String.Equals(actualHash, asset.Sha256, StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidDataException("The downloaded installer failed its SHA-256 check.");
            }

            status.Text = "Starting the Ban Wars installer...";
            Process.Start(new ProcessStartInfo(installerPath) { UseShellExecute = true });
            Close();
        }
        catch (Exception error)
        {
            status.Text = "Could not download or start the installer.";
            downloadButton.Enabled = true;
            MessageBox.Show(this, error.Message, "Ban Wars Launcher", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    private static ReleaseAsset FindLatestInstaller()
    {
        ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;
        string endpoint = "https://api.github.com/repos/Fries-dev/ban-wars/releases/latest";
        string json;
        using (WebClient client = new WebClient())
        {
            client.Headers[HttpRequestHeader.UserAgent] = "BanWarsDiscordLauncher";
            json = client.DownloadString(endpoint);
        }

        JavaScriptSerializer serializer = new JavaScriptSerializer();
        Dictionary<string, object> release =
            serializer.Deserialize<Dictionary<string, object>>(json);
        IEnumerable assets = release["assets"] as IEnumerable;
        if (assets == null)
        {
            throw new InvalidDataException("The latest release response did not contain an asset list.");
        }

        foreach (object value in assets)
        {
            Dictionary<string, object> asset = value as Dictionary<string, object>;
            if (asset == null)
            {
                continue;
            }
            string name = (string)asset["name"];
            object digestValue;
            string digest = asset.TryGetValue("digest", out digestValue) ? digestValue as string : null;
            if (name.StartsWith("Ban-Wars-Setup-", StringComparison.OrdinalIgnoreCase) &&
                name.EndsWith(".exe", StringComparison.OrdinalIgnoreCase) &&
                !String.IsNullOrEmpty(digest) &&
                digest.StartsWith("sha256:", StringComparison.OrdinalIgnoreCase))
            {
                return new ReleaseAsset
                {
                    Url = (string)asset["browser_download_url"],
                    Sha256 = digest.Substring("sha256:".Length)
                };
            }
        }

        throw new InvalidDataException("No installer with a SHA-256 digest was found in the latest release.");
    }

    private static string CalculateSha256(string path)
    {
        using (SHA256 sha256 = SHA256.Create())
        using (FileStream stream = File.OpenRead(path))
        {
            byte[] hash = sha256.ComputeHash(stream);
            return BitConverter.ToString(hash).Replace("-", String.Empty);
        }
    }
}

internal static class Launcher
{
    [STAThread]
    private static void Main()
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new LauncherForm());
    }
}
