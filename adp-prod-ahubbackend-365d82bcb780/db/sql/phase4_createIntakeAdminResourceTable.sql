IF OBJECT_ID(N'dbo.IntakeAdminResource', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.IntakeAdminResource', N'Payload') IS NULL
    RAISERROR(N'dbo.IntakeAdminResource exists with a different layout. Check it before running this script.', 16, 1);
GO

IF OBJECT_ID(N'dbo.IntakeAdminResource', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.IntakeAdminResource (
        DocId       CHAR(24)       NOT NULL CONSTRAINT PK_IntakeAdminResource PRIMARY KEY,
        Seq         BIGINT         IDENTITY(1, 1) NOT NULL,
        Resource    NVARCHAR(100)  COLLATE Latin1_General_100_BIN2 NOT NULL,
        ItemId      NVARCHAR(400)  COLLATE Latin1_General_100_BIN2 NOT NULL,
        ItemIdBytes AS DATALENGTH(ItemId) PERSISTED,
        Payload     NVARCHAR(MAX)  NULL CONSTRAINT CK_IntakeAdminResource_Payload CHECK (ISJSON(Payload) = 1),
        CreatedAt   DATETIME2(3)   NULL,
        UpdatedAt   DATETIME2(3)   NULL,
        CONSTRAINT UQ_IntakeAdminResource_Resource_ItemId UNIQUE (Resource, ItemId, ItemIdBytes)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = N'IX_IntakeAdminResource_Resource' AND object_id = OBJECT_ID(N'dbo.IntakeAdminResource'))
    CREATE INDEX IX_IntakeAdminResource_Resource ON dbo.IntakeAdminResource (Resource, Seq);
GO
