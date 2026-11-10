namespace TimeSheet.Api.Databases.EntityConfigurations;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TimeSheet.Api.Domain.Audit;
using TimeSheet.Api.Domain.Divisions;
using TimeSheet.Api.Domain.Teams;
using TimeSheet.Api.Domain.Users;

// Énumérations stockées en texte : la base reste lisible et un nouveau rôle ne décale rien.

public sealed class DivisionConfiguration : IEntityTypeConfiguration<Division>
{
    public void Configure(EntityTypeBuilder<Division> builder)
    {
        builder.HasIndex(d => d.Slug).IsUnique();
        builder.Property(d => d.Status).HasConversion<string>().HasMaxLength(20);
        builder.HasMany(d => d.Permissions).WithOne().HasForeignKey(p => p.DivisionId).OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(d => d.Permissions).UsePropertyAccessMode(PropertyAccessMode.Field);
        builder.Ignore(d => d.Overrides);
        builder.Ignore(d => d.AllowsSignIn);
    }
}

public sealed class RolePermissionConfiguration : IEntityTypeConfiguration<RolePermission>
{
    public void Configure(EntityTypeBuilder<RolePermission> builder)
    {
        builder.HasKey(p => new { p.DivisionId, p.Role, p.Permission });
        builder.Property(p => p.Role).HasConversion<string>().HasMaxLength(20);
        builder.Property(p => p.Permission).HasConversion<string>().HasMaxLength(30);
    }
}

public sealed class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.HasIndex(u => u.Email).IsUnique();
        builder.HasIndex(u => u.DivisionId);
        builder.HasIndex(u => u.ManagerId);
        builder.Property(u => u.Email).HasMaxLength(254);
        builder.Property(u => u.Role).HasConversion<string>().HasMaxLength(20);
        builder.Property(u => u.UsualArrival).IsRequired().HasMaxLength(5).HasDefaultValue("08:00");
        builder.Property(u => u.UsualDeparture).IsRequired().HasMaxLength(5).HasDefaultValue("17:00");
        builder.Property(u => u.DefaultSignatureMode).HasConversion<string>().HasMaxLength(20).HasDefaultValueSql("'DRAWN'");
        builder.HasOne(u => u.Division).WithMany().HasForeignKey(u => u.DivisionId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<User>().WithMany().HasForeignKey(u => u.ManagerId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Team>().WithMany().HasForeignKey(u => u.TeamId).OnDelete(DeleteBehavior.SetNull);
        builder.Ignore(u => u.FullName);
        builder.Ignore(u => u.CanSignIn);
    }
}

public sealed class TeamConfiguration : IEntityTypeConfiguration<Team>
{
    public void Configure(EntityTypeBuilder<Team> builder)
    {
        builder.HasIndex(t => t.DivisionId);
        builder.HasOne<Division>().WithMany().HasForeignKey(t => t.DivisionId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<User>().WithMany().HasForeignKey(t => t.ManagerId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class AuditEntryConfiguration : IEntityTypeConfiguration<AuditEntry>
{
    public void Configure(EntityTypeBuilder<AuditEntry> builder)
    {
        builder.ToTable("AuditLog");
        builder.HasKey(a => a.Id);
        builder.Property(a => a.Result).HasConversion<string>().HasMaxLength(10);
        builder.Property(a => a.Metadata).HasColumnType("jsonb");
        builder.HasOne<Division>().WithMany().HasForeignKey(a => a.DivisionId).OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(a => new { a.DivisionId, a.At });
        builder.HasIndex(a => new { a.Action, a.At });
        builder.HasIndex(a => new { a.Action, a.ObjectLabel, a.RecordedAt });
    }
}
