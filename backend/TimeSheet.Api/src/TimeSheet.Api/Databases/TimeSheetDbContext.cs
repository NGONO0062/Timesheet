namespace TimeSheet.Api.Databases;

using TimeSheet.Api.Domain;
using TimeSheet.Api.Databases.EntityConfigurations;
using TimeSheet.Api.Services;
using TimeSheet.Api.Exceptions;
using Resources;
using MediatR;
using TimeSheet.Api.Domain.Audit;
using TimeSheet.Api.Domain.Divisions;
using TimeSheet.Api.Domain.Projects;
using TimeSheet.Api.Domain.Teams;
using TimeSheet.Api.Domain.Timesheets;
using TimeSheet.Api.Domain.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using System.Linq.Expressions;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore.Query;

public sealed class TimeSheetDbContext(DbContextOptions<TimeSheetDbContext> options, 
    ICurrentUserService currentUserService, 
    IMediator mediator, 
    TimeProvider dateTimeProvider)
    : DbContext(options)
{
    #region DbSet Region - Do Not Delete
    public DbSet<Division> Divisions { get; set; }
    public DbSet<RolePermission> RolePermissions { get; set; }
    public DbSet<User> Users { get; set; }
    public DbSet<Team> Teams { get; set; }
    public DbSet<AuditEntry> AuditLog { get; set; }
    public DbSet<DivisionSettings> DivisionSettings { get; set; }
    public DbSet<Holiday> Holidays { get; set; }
    public DbSet<Project> Projects { get; set; }
    public DbSet<Activity> Activities { get; set; }
    public DbSet<ProjectMember> ProjectMembers { get; set; }
    public DbSet<Timesheet> Timesheets { get; set; }
    public DbSet<TimesheetDay> TimesheetDays { get; set; }
    public DbSet<Domain.Attendance.Internship> Internships { get; set; }
    public DbSet<Domain.Attendance.AttendanceSheet> AttendanceSheets { get; set; }
    public DbSet<Domain.Attendance.Signature> Signatures { get; set; }
    public DbSet<PasswordToken> PasswordTokens { get; set; }
    #endregion DbSet Region - Do Not Delete

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        #region Entity Database Config Region - Only delete if you don't want to automatically add configurations
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(TimeSheetDbContext).Assembly);
        #endregion Entity Database Config Region - Only delete if you don't want to automatically add configurations
    }

    public override int SaveChanges()
    {
        UpdateAuditFields();
        var result = base.SaveChanges();
        _dispatchDomainEvents().GetAwaiter().GetResult();
        return result;
    }

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = new())
    {
        UpdateAuditFields();
        var result = await base.SaveChangesAsync(cancellationToken);
        await _dispatchDomainEvents();
        return result;
    }
    
    private async Task _dispatchDomainEvents()
    {
        var domainEventEntities = ChangeTracker.Entries<BaseEntity>()
            .Select(po => po.Entity)
            .Where(po => po.DomainEvents.Any())
            .ToArray();

        foreach (var entity in domainEventEntities)
        {
            var events = entity.DomainEvents.ToArray();
            entity.DomainEvents.Clear();
            foreach (var entityDomainEvent in events)
                await mediator.Publish(entityDomainEvent);
        }
    }
        
    private void UpdateAuditFields()
    {
        var now = dateTimeProvider.GetUtcNow();
        foreach (var entry in ChangeTracker.Entries<BaseEntity>())
        {
            switch (entry.State)
            {
                case EntityState.Added:
                    entry.Entity.UpdateCreationProperties(now, currentUserService?.UserId);
                    entry.Entity.UpdateModifiedProperties(now, currentUserService?.UserId);
                    break;

                case EntityState.Modified:
                    entry.Entity.UpdateModifiedProperties(now, currentUserService?.UserId);
                    break;
                
                case EntityState.Deleted:
                    break;
            }
        }
    }
}

public static class Extensions
{
    public static async Task<TEntity> GetByIdOrDefault<TEntity>(this DbSet<TEntity> dbSet, 
        Guid id, 
        CancellationToken cancellationToken = default) 
            where TEntity : BaseEntity
    {
        return await dbSet.FirstOrDefaultAsync(e => e.Id == id, cancellationToken);
    }
    
    public static async Task<TEntity> GetByIdOrDefault<TEntity>(this IQueryable<TEntity> query, 
        Guid id, 
        CancellationToken cancellationToken = default) 
            where TEntity : BaseEntity
    {
        return await query.FirstOrDefaultAsync(e => e.Id == id, cancellationToken);
    } 
    
    public static async Task<TEntity> GetById<TEntity>(this DbSet<TEntity> dbSet, 
        Guid id, 
        CancellationToken cancellationToken = default) 
            where TEntity : BaseEntity
    {
        var result = await dbSet.FirstOrDefaultAsync(e => e.Id == id, cancellationToken);
    
        return result.MustBeFoundOrThrow();
    }
    
    public static async Task<TEntity> GetById<TEntity>(this IQueryable<TEntity> query, 
        Guid id, 
        CancellationToken cancellationToken = default) 
            where TEntity : BaseEntity
    {
        var result = await query.FirstOrDefaultAsync(e => e.Id == id, cancellationToken);
    
        return result.MustBeFoundOrThrow();
    }

    public static TEntity MustBeFoundOrThrow<TEntity>(this TEntity entity)
        where TEntity : BaseEntity
    {
         return entity ?? throw new NotFoundException($"{typeof(TEntity).Name} was not found.");
    }
}
