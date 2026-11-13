namespace TimeSheet.Api.Databases.EntityConfigurations;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TimeSheet.Api.Domain.Divisions;
using TimeSheet.Api.Domain.Projects;
using TimeSheet.Api.Domain.Timesheets;
using TimeSheet.Api.Domain.Users;

public sealed class DivisionSettingsConfiguration : IEntityTypeConfiguration<DivisionSettings>
{
    public void Configure(EntityTypeBuilder<DivisionSettings> builder)
    {
        builder.HasKey(s => s.DivisionId);
        builder.HasOne<Division>().WithOne().HasForeignKey<DivisionSettings>(s => s.DivisionId).OnDelete(DeleteBehavior.Cascade);
        // Jours ouvrés en texte (« Monday »…), lisibles en base.
        builder.Property(s => s.WorkingDays).HasConversion(
            v => string.Join(',', v.Select(d => d.ToString())),
            v => v.Split(',', StringSplitOptions.RemoveEmptyEntries).Select(Enum.Parse<DayOfWeek>).ToArray(),
            new Microsoft.EntityFrameworkCore.ChangeTracking.ValueComparer<DayOfWeek[]>((a, b) => a!.SequenceEqual(b!), v => v.Aggregate(0, (h, d) => HashCode.Combine(h, d)), v => v.ToArray()));
        builder.Property(s => s.DeadlineDay).HasConversion<string>().HasMaxLength(10);
        builder.Property(s => s.DeadlineTime).HasMaxLength(5);
    }
}

public sealed class HolidayConfiguration : IEntityTypeConfiguration<Holiday>
{
    public void Configure(EntityTypeBuilder<Holiday> builder)
    {
        builder.HasIndex(h => new { h.DivisionId, h.Date }).IsUnique();
        builder.HasOne<Division>().WithMany().HasForeignKey(h => h.DivisionId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class ProjectConfiguration : IEntityTypeConfiguration<Project>
{
    public void Configure(EntityTypeBuilder<Project> builder)
    {
        builder.HasIndex(p => new { p.DivisionId, p.Code }).IsUnique();
        builder.HasIndex(p => new { p.DivisionId, p.Status });
        builder.Property(p => p.Status).HasConversion<string>().HasMaxLength(20);
        builder.HasOne<Division>().WithMany().HasForeignKey(p => p.DivisionId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<User>().WithMany().HasForeignKey(p => p.ManagerId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<User>().WithMany().HasForeignKey(p => p.StatusChangedById).OnDelete(DeleteBehavior.Restrict);
        builder.HasMany(p => p.Activities).WithOne().HasForeignKey(a => a.ProjectId).OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(p => p.Members).WithOne().HasForeignKey(m => m.ProjectId).OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(p => p.Activities).UsePropertyAccessMode(PropertyAccessMode.Field);
        builder.Navigation(p => p.Members).UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}

public sealed class ActivityConfiguration : IEntityTypeConfiguration<Activity>
{
    public void Configure(EntityTypeBuilder<Activity> builder)
    {
        // Identifiant créé par le code : une activité ajoutée à un projet existant est une insertion.
        builder.Property(a => a.Id).ValueGeneratedNever();
    }
}

public sealed class ProjectMemberConfiguration : IEntityTypeConfiguration<ProjectMember>
{
    public void Configure(EntityTypeBuilder<ProjectMember> builder)
    {
        builder.HasKey(m => new { m.ProjectId, m.UserId });
        builder.HasOne<User>().WithMany().HasForeignKey(m => m.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class TimesheetConfiguration : IEntityTypeConfiguration<Timesheet>
{
    public void Configure(EntityTypeBuilder<Timesheet> builder)
    {
        builder.HasIndex(t => new { t.UserId, t.WeekYear, t.WeekNumber }).IsUnique();
        builder.HasIndex(t => new { t.DivisionId, t.Status });
        builder.Property(t => t.Status).HasConversion<string>().HasMaxLength(20);
        builder.Property(t => t.Comment).HasMaxLength(2000);
        builder.Property(t => t.RejectionReason).HasMaxLength(500);
        builder.HasOne<Division>().WithMany().HasForeignKey(t => t.DivisionId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<User>().WithMany().HasForeignKey(t => t.UserId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<User>().WithMany().HasForeignKey(t => t.DecidedById).OnDelete(DeleteBehavior.Restrict);
        builder.HasMany(t => t.Days).WithOne().HasForeignKey(d => d.TimesheetId).OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(t => t.Events).WithOne().HasForeignKey(e => e.TimesheetId).OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(t => t.Days).UsePropertyAccessMode(PropertyAccessMode.Field);
        builder.Navigation(t => t.Events).UsePropertyAccessMode(PropertyAccessMode.Field);
        builder.Ignore(t => t.Week);
    }
}

public sealed class TimesheetDayConfiguration : IEntityTypeConfiguration<TimesheetDay>
{
    public void Configure(EntityTypeBuilder<TimesheetDay> builder)
    {
        builder.HasKey(d => new { d.TimesheetId, d.Date });
        builder.HasOne<Activity>().WithMany().HasForeignKey(d => d.ActivityId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class TimesheetEventConfiguration : IEntityTypeConfiguration<TimesheetEvent>
{
    public void Configure(EntityTypeBuilder<TimesheetEvent> builder)
    {
        // Identifiant créé par le code : un événement ajouté à une fiche existante est une insertion.
        builder.Property(e => e.Id).ValueGeneratedNever();
        builder.HasIndex(e => new { e.TimesheetId, e.At });
        builder.Property(e => e.Type).HasMaxLength(20);
        builder.Property(e => e.Note).HasMaxLength(2000);
        builder.HasOne<User>().WithMany().HasForeignKey(e => e.ActorId).OnDelete(DeleteBehavior.Restrict);
    }
}

/// <summary>Tâches du tableau Kanban (écran 15) : lues par projet, colonne et position.</summary>
public sealed class ProjectTaskConfiguration : IEntityTypeConfiguration<Domain.Tasks.ProjectTask>
{
    public void Configure(EntityTypeBuilder<Domain.Tasks.ProjectTask> builder)
    {
        builder.ToTable("Tasks");
        builder.HasKey(t => t.Id);
        builder.Property(t => t.Title).HasMaxLength(Domain.Tasks.TaskRules.TitleMax);
        builder.Property(t => t.Status).HasConversion<string>().HasMaxLength(20);
        builder.HasIndex(t => new { t.ProjectId, t.Status, t.Position });
        builder.HasIndex(t => t.DivisionId);
        builder.HasOne<Division>().WithMany().HasForeignKey(t => t.DivisionId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<Project>().WithMany().HasForeignKey(t => t.ProjectId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<User>().WithMany().HasForeignKey(t => t.CreatedById).OnDelete(DeleteBehavior.Cascade);
    }
}
