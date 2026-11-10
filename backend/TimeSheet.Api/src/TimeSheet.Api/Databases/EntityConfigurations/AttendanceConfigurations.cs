namespace TimeSheet.Api.Databases.EntityConfigurations;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TimeSheet.Api.Domain.Attendance;
using TimeSheet.Api.Domain.Divisions;
using TimeSheet.Api.Domain.Users;

public sealed class InternshipConfiguration : IEntityTypeConfiguration<Internship>
{
    public void Configure(EntityTypeBuilder<Internship> builder)
    {
        builder.HasKey(i => i.UserId);
        builder.Property(i => i.Kind).HasConversion<string>().HasMaxLength(20);
        builder.Property(i => i.Direction).HasMaxLength(120);
        builder.Property(i => i.Department).HasMaxLength(120);
        builder.Property(i => i.Service).HasMaxLength(120);
        builder.HasOne<User>().WithOne().HasForeignKey<Internship>(i => i.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class AttendanceSheetConfiguration : IEntityTypeConfiguration<AttendanceSheet>
{
    public void Configure(EntityTypeBuilder<AttendanceSheet> builder)
    {
        builder.Property(s => s.Id).ValueGeneratedNever();
        builder.HasIndex(s => new { s.UserId, s.Year, s.Month }).IsUnique();
        builder.HasIndex(s => new { s.DivisionId, s.Status });
        builder.Property(s => s.Status).HasConversion<string>().HasMaxLength(30);
        builder.Property(s => s.Observation).HasMaxLength(500);
        builder.Property(s => s.RejectionReason).HasMaxLength(500);
        builder.Property(s => s.PdfPath).HasMaxLength(300);
        builder.Property(s => s.PdfSha256).HasMaxLength(64);
        builder.Property(s => s.SentTo).HasMaxLength(254);
        builder.HasOne<Division>().WithMany().HasForeignKey(s => s.DivisionId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<User>().WithMany().HasForeignKey(s => s.UserId).OnDelete(DeleteBehavior.Restrict);
        builder.HasMany(s => s.Signatures).WithOne().HasForeignKey(x => x.AttendanceSheetId).OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(s => s.Signatures).UsePropertyAccessMode(PropertyAccessMode.Field);
        builder.Ignore(s => s.ActiveSignatures);
        builder.Ignore(s => s.InternSignature);
        builder.Ignore(s => s.SupervisorSignature);
    }
}

public sealed class SignatureConfiguration : IEntityTypeConfiguration<Signature>
{
    public void Configure(EntityTypeBuilder<Signature> builder)
    {
        // Identifiant créé par le code : une signature ajoutée à une fiche existante est une insertion.
        builder.Property(s => s.Id).ValueGeneratedNever();
        builder.Property(s => s.SignerRole).HasConversion<string>().HasMaxLength(20);
        builder.Property(s => s.Method).HasConversion<string>().HasMaxLength(20);
        builder.Property(s => s.Drawing).HasMaxLength(20000);
        builder.Property(s => s.DocumentSha256).HasMaxLength(64);
        builder.Property(s => s.Ip).HasMaxLength(64);
        builder.Property(s => s.UserAgent).HasMaxLength(300);
        builder.HasOne<User>().WithMany().HasForeignKey(s => s.SignerId).OnDelete(DeleteBehavior.Restrict);
    }
}
