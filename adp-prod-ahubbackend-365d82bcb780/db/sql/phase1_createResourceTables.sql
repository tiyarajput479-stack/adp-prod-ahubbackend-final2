
IF OBJECT_ID(N'dbo.ResourceTracker', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.ResourceTracker', N'ExtraFields') IS NULL
    RAISERROR(N'dbo.ResourceTracker exists with a different layout. If it was created by an earlier version of this script, drop it and run again.', 16, 1);
IF OBJECT_ID(N'dbo.ResourceAudit', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.ResourceAudit', N'Changes') IS NULL
    RAISERROR(N'dbo.ResourceAudit exists with a different layout. If it was created by an earlier version of this script, drop it and run again.', 16, 1);
GO

IF OBJECT_ID(N'dbo.ResourceTracker', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ResourceTracker (
        DocId            CHAR(24)       NOT NULL CONSTRAINT PK_ResourceTracker PRIMARY KEY,
        AssociateId      NVARCHAR(100)  NULL,
        Name             NVARCHAR(400)  NULL,
        ReportingManager NVARCHAR(400)  NULL,
        Manager          NVARCHAR(400)  NULL,
        [Type]           NVARCHAR(400)  NULL,
        Stream           NVARCHAR(400)  NULL,
        [Role]           NVARCHAR(400)  NULL,
        Country          NVARCHAR(400)  NULL,
        [Status]         NVARCHAR(400)  NULL,
        ProjectProduct   NVARCHAR(400)  NULL,
        [Group]          NVARCHAR(400)  NULL,
        FinanceNames     NVARCHAR(400)  NULL,
        IKareProject     NVARCHAR(400)  NULL,
        Comments         NVARCHAR(MAX)  NULL,
        ProjectDetails   NVARCHAR(MAX)  NULL,
        ExtraFields      NVARCHAR(MAX)  NULL,
        CreatedAt        DATETIME2(3)   NOT NULL CONSTRAINT DF_ResourceTracker_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt        DATETIME2(3)   NOT NULL CONSTRAINT DF_ResourceTracker_UpdatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT CK_ResourceTracker_ProjectDetails_Json CHECK (ProjectDetails IS NULL OR ISJSON(ProjectDetails) = 1),
        CONSTRAINT CK_ResourceTracker_ExtraFields_Json    CHECK (ExtraFields IS NULL OR ISJSON(ExtraFields) = 1)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ResourceTracker_Name' AND object_id = OBJECT_ID(N'dbo.ResourceTracker'))
    CREATE INDEX IX_ResourceTracker_Name ON dbo.ResourceTracker (Name);
GO


IF OBJECT_ID(N'dbo.ResourceAudit', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ResourceAudit (
        DocId          CHAR(24)       NOT NULL CONSTRAINT PK_ResourceAudit PRIMARY KEY,
        [Action]       NVARCHAR(20)   NOT NULL,
        ResourceId     NVARCHAR(64)   NULL,
        ResourceName   NVARCHAR(400)  NULL,
        ProjectProduct NVARCHAR(400)  NULL,
        ActorEsId      NVARCHAR(200)  NULL,
        ActorName      NVARCHAR(400)  NULL,
        ActorEmail     NVARCHAR(400)  NULL,
        Changes        NVARCHAR(MAX)  NULL,
        Snapshot       NVARCHAR(MAX)  NULL,
        CorrelationId  NVARCHAR(100)  NULL,
        CreatedAt      DATETIME2(3)   NOT NULL CONSTRAINT DF_ResourceAudit_CreatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT CK_ResourceAudit_Changes_Json  CHECK (Changes IS NULL OR ISJSON(Changes) = 1),
        CONSTRAINT CK_ResourceAudit_Snapshot_Json CHECK (Snapshot IS NULL OR ISJSON(Snapshot) = 1)
    );
END
GO


IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ResourceAudit_CreatedAt' AND object_id = OBJECT_ID(N'dbo.ResourceAudit'))
    CREATE INDEX IX_ResourceAudit_CreatedAt ON dbo.ResourceAudit (CreatedAt DESC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ResourceAudit_ResourceId' AND object_id = OBJECT_ID(N'dbo.ResourceAudit'))
    CREATE INDEX IX_ResourceAudit_ResourceId ON dbo.ResourceAudit (ResourceId, CreatedAt DESC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ResourceAudit_Action' AND object_id = OBJECT_ID(N'dbo.ResourceAudit'))
    CREATE INDEX IX_ResourceAudit_Action ON dbo.ResourceAudit ([Action], CreatedAt DESC);
GO

--  