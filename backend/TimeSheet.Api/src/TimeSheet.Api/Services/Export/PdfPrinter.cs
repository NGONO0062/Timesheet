namespace TimeSheet.Api.Services.Export;

using Microsoft.Playwright;

public interface IPdfPrinter
{
    /// <summary>
    /// Imprime un document HTML autonome (styles en ligne, aucun script, aucune ressource
    /// distante) en PDF A4. <paramref name="footer"/> : gabarit du pied répété sur chaque page
    /// (<see cref="DocumentHtml.PdfFooter"/>).
    /// </summary>
    Task<byte[]> PrintAsync(string html, bool landscape = false, string? footer = null, bool fullBleed = false);
}

/// <summary>
/// PDF (repris de lib/export/pdf.ts) : un gabarit HTML imprimé par Chromium (Microsoft.Playwright),
/// le même mécanisme que l'application actuelle. Un navigateur pour toute l'API, un contexte
/// isolé par document, JavaScript coupé, hors ligne. Chromium s'installe une fois par poste ou par
/// image : <c>bin/…/playwright.ps1 install chromium --only-shell</c> (backend/README.md).
/// </summary>
public sealed class PdfPrinter : IPdfPrinter, IAsyncDisposable
{
    private readonly SemaphoreSlim _gate = new(1, 1);
    private IPlaywright? _playwright;
    private IBrowser? _browser;

    private async Task<IBrowser> BrowserAsync()
    {
        if (_browser is { IsConnected: true }) return _browser;
        await _gate.WaitAsync();
        try
        {
            if (_browser is { IsConnected: true }) return _browser;
            _playwright ??= await Playwright.CreateAsync();
            _browser = await _playwright.Chromium.LaunchAsync(new BrowserTypeLaunchOptions { Headless = true });
            return _browser;
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task<byte[]> PrintAsync(string html, bool landscape = false, string? footer = null, bool fullBleed = false)
    {
        var browser = await BrowserAsync();
        await using var context = await browser.NewContextAsync(new BrowserNewContextOptions { JavaScriptEnabled = false, Offline = true });
        var page = await context.NewPageAsync();
        await page.SetContentAsync(html, new PageSetContentOptions { WaitUntil = WaitUntilState.Load });
        return await page.PdfAsync(new PagePdfOptions
        {
            Format = "A4",
            Landscape = landscape,
            PrintBackground = true,
            // Pleine page : le gabarit fixe lui-même ses marges (fiche de présence, jalon 5).
            Margin = fullBleed ? new Margin { Top = "0", Right = "0", Bottom = "0", Left = "0" } : new Margin { Top = "15mm", Right = "15mm", Bottom = "20mm", Left = "15mm" },
            DisplayHeaderFooter = footer is not null,
            HeaderTemplate = "<span></span>",
            FooterTemplate = footer ?? "<span></span>",
            PreferCSSPageSize = fullBleed,
        });
    }

    public async ValueTask DisposeAsync()
    {
        if (_browser is not null) await _browser.CloseAsync();
        _playwright?.Dispose();
        _gate.Dispose();
    }
}
