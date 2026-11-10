namespace TimeSheet.Api.Services.Export;

using System.Globalization;
using System.IO.Compression;
using System.Security;
using System.Text;

/// <summary>
/// Exports d'un tableau (repris de lib/export/table.ts) : CSV et Excel, sans dépendance. Le CSV
/// suit l'usage d'Excel en français : séparateur « ; », virgule décimale, BOM UTF-8. Le classeur
/// Excel est un .xlsx minimal ouvert par une ligne noire au mot TimeSheet ; le CSV reste des
/// données seules. Une cellule vaut un texte, un nombre ou rien (null).
/// </summary>
public static class TableExport
{
    /// <summary>Lignes avant le tableau dans le classeur : le mot TimeSheet, puis une ligne vide.</summary>
    public const int XlsxBrandRows = 2;

    private static string Number(decimal n) => Math.Round(n, 3).ToString("0.###", CultureInfo.InvariantCulture);

    private static string CsvCell(object? c)
    {
        var s = c switch
        {
            null => "",
            string text => text,
            _ => Number(Convert.ToDecimal(c, CultureInfo.InvariantCulture)).Replace('.', ','),
        };
        return s.IndexOfAny([';', '"', '\n', '\r']) >= 0 ? $"\"{s.Replace("\"", "\"\"")}\"" : s;
    }

    public static byte[] Csv(IReadOnlyList<IReadOnlyList<object?>> rows)
    {
        var text = "﻿" + string.Concat(rows.Select(r => string.Join(";", r.Select(CsvCell)) + "\r\n"));
        return Encoding.UTF8.GetBytes(text);
    }

    private static string Xml(string s) => SecurityElement.Escape(s) ?? "";

    /// <summary>Colonne Excel : 0 → A, 26 → AA.</summary>
    public static string Column(int i)
    {
        var s = "";
        for (var n = i + 1; n > 0; n = (n - 1) / 26) s = (char)('A' + (n - 1) % 26) + s;
        return s;
    }

    /// <summary>Classeur Excel (.xlsx) d'une feuille ; les <paramref name="headerRows"/> premières lignes sont en gras.</summary>
    public static byte[] Xlsx(string name, IReadOnlyList<IReadOnlyList<object?>> rows, int headerRows = 1)
    {
        var width = Math.Max(1, rows.Count == 0 ? 0 : rows.Max(r => r.Count));
        static string Run(string text, string color) => $"<r><rPr><b/><sz val=\"14\"/><color rgb=\"{color}\"/><rFont val=\"Arial\"/></rPr><t>{Xml(text)}</t></r>";
        var brand = new StringBuilder("<row r=\"1\" ht=\"30\" customHeight=\"1\">");
        for (var ci = 0; ci < width; ci++)
            brand.Append(ci == 0 ? $"<c r=\"A1\" t=\"inlineStr\" s=\"2\"><is>{Run("Time", "FFF16E00")}{Run("Sheet", "FFFFFFFF")}</is></c>" : $"<c r=\"{Column(ci)}1\" s=\"2\"/>");
        brand.Append("</row>");

        var data = new StringBuilder();
        for (var i = 0; i < rows.Count; i++)
        {
            var ri = i + XlsxBrandRows + 1;
            data.Append($"<row r=\"{ri}\">");
            for (var ci = 0; ci < rows[i].Count; ci++)
            {
                var c = rows[i][ci];
                if (c is null) continue;
                var style = i < headerRows ? " s=\"1\"" : "";
                var reference = $"{Column(ci)}{ri}";
                data.Append(c is string s
                    ? $"<c r=\"{reference}\" t=\"inlineStr\"{style}><is><t xml:space=\"preserve\">{Xml(s)}</t></is></c>"
                    : $"<c r=\"{reference}\"{style}><v>{Number(Convert.ToDecimal(c, CultureInfo.InvariantCulture))}</v></c>");
            }
            data.Append("</row>");
        }

        var sheetName = Xml(name.Length > 31 ? name[..31] : name);
        var files = new (string Path, string Content)[]
        {
            ("[Content_Types].xml", "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/><Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/><Override PartName=\"/xl/worksheets/sheet1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/><Override PartName=\"/xl/styles.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml\"/></Types>"),
            ("_rels/.rels", "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/></Relationships>"),
            ("xl/workbook.xml", $"<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\"><sheets><sheet name=\"{sheetName}\" sheetId=\"1\" r:id=\"rId1\"/></sheets></workbook>"),
            ("xl/_rels/workbook.xml.rels", "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet1.xml\"/><Relationship Id=\"rId2\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles\" Target=\"styles.xml\"/></Relationships>"),
            ("xl/styles.xml", "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><styleSheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><fonts count=\"3\"><font><sz val=\"11\"/><name val=\"Arial\"/></font><font><b/><sz val=\"11\"/><name val=\"Arial\"/></font><font><b/><sz val=\"14\"/><color rgb=\"FFFFFFFF\"/><name val=\"Arial\"/></font></fonts><fills count=\"3\"><fill><patternFill patternType=\"none\"/></fill><fill><patternFill patternType=\"gray125\"/></fill><fill><patternFill patternType=\"solid\"><fgColor rgb=\"FF000000\"/></patternFill></fill></fills><borders count=\"1\"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count=\"1\"><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\"/></cellStyleXfs><cellXfs count=\"3\"><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\"/><xf numFmtId=\"0\" fontId=\"1\" fillId=\"0\" borderId=\"0\" xfId=\"0\" applyFont=\"1\"/><xf numFmtId=\"0\" fontId=\"2\" fillId=\"2\" borderId=\"0\" xfId=\"0\" applyFont=\"1\" applyFill=\"1\" applyAlignment=\"1\"><alignment vertical=\"center\"/></xf></cellXfs></styleSheet>"),
            ("xl/worksheets/sheet1.xml", $"<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><sheetData>{brand}{data}</sheetData></worksheet>"),
        };

        using var buffer = new MemoryStream();
        using (var archive = new ZipArchive(buffer, ZipArchiveMode.Create, leaveOpen: true))
        {
            foreach (var (path, content) in files)
            {
                var entry = archive.CreateEntry(path, CompressionLevel.Optimal);
                // Date fixe : l'archive ne dépend pas de l'heure de génération.
                entry.LastWriteTime = new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);
                using var stream = entry.Open();
                stream.Write(Encoding.UTF8.GetBytes(content));
            }
        }
        return buffer.ToArray();
    }
}
