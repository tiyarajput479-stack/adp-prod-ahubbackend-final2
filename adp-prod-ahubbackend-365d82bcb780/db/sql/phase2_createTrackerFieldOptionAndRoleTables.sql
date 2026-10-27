IF OBJECT_ID(N'dbo.TrackerFieldOption', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.TrackerFieldOption', N'Value') IS NULL
    RAISERROR(N'dbo.TrackerFieldOption exists with a different layout. Check it before running this script.', 16, 1);
IF OBJECT_ID(N'dbo.Role', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Role', N'AccessPages') IS NULL
    RAISERROR(N'dbo.Role exists with a different layout. Check it before running this script.', 16, 1);
GO

IF OBJECT_ID(N'dbo.TrackerFieldOption', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.TrackerFieldOption (
        DocId     CHAR(24)       NOT NULL CONSTRAINT PK_TrackerFieldOption PRIMARY KEY,
        Field     NVARCHAR(100)  COLLATE Latin1_General_100_BIN2 NOT NULL,
        [Value]   NVARCHAR(400)  COLLATE Latin1_General_100_BIN2 NOT NULL,
        CreatedAt DATETIME2(3)   NULL,
        UpdatedAt DATETIME2(3)   NULL,
        CONSTRAINT UQ_TrackerFieldOption_Field_Value UNIQUE (Field, [Value])
    );
END
GO

IF EXISTS (
    SELECT 1 FROM (
        SELECT Field, LOWER([Value]) AS LV FROM dbo.TrackerFieldOption
    ) AS t
    GROUP BY Field, LV
    HAVING COUNT(*) > 1
)
    RAISERROR(N'dbo.TrackerFieldOption has values that only differ by case for the same field - resolve them before this script can make Value case-insensitive. Run: SELECT Field, [Value] FROM dbo.TrackerFieldOption ORDER BY Field, [Value]; and look for near-duplicates by eye.', 16, 1);
GO

IF (SELECT collation_name FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.TrackerFieldOption') AND name = 'Value') = 'Latin1_General_100_BIN2'
BEGIN
    ALTER TABLE dbo.TrackerFieldOption DROP CONSTRAINT UQ_TrackerFieldOption_Field_Value;
    ALTER TABLE dbo.TrackerFieldOption ALTER COLUMN [Value] NVARCHAR(400) COLLATE Latin1_General_100_CI_AS NOT NULL;
    ALTER TABLE dbo.TrackerFieldOption ADD CONSTRAINT UQ_TrackerFieldOption_Field_Value UNIQUE (Field, [Value]);
END
GO

IF OBJECT_ID(N'dbo.Role', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Role (
        DocId       CHAR(24)        NOT NULL CONSTRAINT PK_Role PRIMARY KEY,
        [Role]      NVARCHAR(200)   COLLATE Latin1_General_100_BIN2 NULL,
        AccessPages NVARCHAR(2000)  NULL,
        [Status]    NVARCHAR(100)   NULL,
        CreatedBy   NVARCHAR(400)   NULL,
        [Time]      DATETIME2(3)    NULL
    );
END
GO

IF EXISTS (
    SELECT 1 FROM dbo.Role WHERE [Role] IS NOT NULL
    GROUP BY [Role] HAVING COUNT(*) > 1
)
    RAISERROR(N'dbo.Role has duplicate [Role] values - resolve them before this script can make the index unique. Run: SELECT [Role], COUNT(*) FROM dbo.Role WHERE [Role] IS NOT NULL GROUP BY [Role] HAVING COUNT(*) > 1;', 16, 1);
GO


IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Role_Role' AND object_id = OBJECT_ID(N'dbo.Role') AND is_unique = 0)
    DROP INDEX IX_Role_Role ON dbo.Role;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Role_Role' AND object_id = OBJECT_ID(N'dbo.Role'))
 
    CREATE UNIQUE INDEX IX_Role_Role ON dbo.Role ([Role]) WHERE [Role] IS NOT NULL;
GO
