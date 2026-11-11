namespace TimeSheet.Api.Services.Export;

/// <summary>Fichier rendu au navigateur en pièce jointe (exports CSV, Excel et PDF).</summary>
public sealed record ExportFile(byte[] Content, string ContentType, string FileName);
