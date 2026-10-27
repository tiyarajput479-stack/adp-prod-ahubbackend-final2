IF OBJECT_ID(N'dbo.ProgramTracker', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ProgramTracker (
        DocId               CHAR(24)       NOT NULL CONSTRAINT PK_ProgramTracker PRIMARY KEY,
        Seq                 BIGINT         IDENTITY(1, 1) NOT NULL,                
        Bu                  NVARCHAR(200)  NULL,
        Scope               NVARCHAR(100)  NULL,
        Program             NVARCHAR(400)  NULL,
        Dt                  FLOAT          NULL,                                    
        Gpt                 FLOAT          NULL,                                    
        Total               FLOAT          NULL,                                 
        Fy                  NVARCHAR(20)   NULL,                                 
        ProgramLeadership   NVARCHAR(400)  NULL,
        ProductMgmt         NVARCHAR(400)  NULL,
        ProgramMgmt         NVARCHAR(400)  NULL,
        DtProductMgmt       NVARCHAR(400)  NULL,
        TechLead            NVARCHAR(400)  NULL,
        ExecSponsor         NVARCHAR(400)  NULL,
        BexLeader           NVARCHAR(400)  NULL,
        ProjectMgmt         NVARCHAR(400)  NULL,
        Definition          NVARCHAR(50)   NULL,                                  
        Delivery            NVARCHAR(50)   NULL,
        Capacity            NVARCHAR(50)   NULL,
        Risk                NVARCHAR(50)   NULL,
        [Keep]              NVARCHAR(MAX)  NULL,
        Improve             NVARCHAR(MAX)  NULL,
        [Start]             NVARCHAR(MAX)  NULL,
        Stop                NVARCHAR(MAX)  NULL,
        CreatedAt           DATETIME2(3)   NULL,
        UpdatedAt           DATETIME2(3)   NULL
    );
END
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = N'IX_ProgramTracker_Bu' AND object_id = OBJECT_ID(N'dbo.ProgramTracker'))
    CREATE INDEX IX_ProgramTracker_Bu ON dbo.ProgramTracker (Bu, Seq);
GO
