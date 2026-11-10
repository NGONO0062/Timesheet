namespace TimeSheet.Api.Services.Export;

/// <summary>Fichier rendu au navigateur en pièce jointe (exports, PDF de la fiche de présence).</summary>
public sealed record ExportFile(byte[] Content, string ContentType, string FileName);
