IF OBJECT_ID(N'dbo.AppUser', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.AppUser', N'UserName') IS NULL
    RAISERROR(N'dbo.AppUser exists with a different layout. Check it before running this script.', 16, 1);
GO

IF OBJECT_ID(N'dbo.AppUser', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.AppUser (
        DocId       CHAR(24)       NOT NULL CONSTRAINT PK_AppUser PRIMARY KEY,
        UserName    NVARCHAR(200)  COLLATE Latin1_General_100_BIN2 NULL,
        [Name]      NVARCHAR(400)  NULL,
        Designation NVARCHAR(400)  NULL,
        Email       NVARCHAR(400)  NULL,
        [Role]      NVARCHAR(200)  NULL,
        Active      NVARCHAR(100)  NULL,
        [Status]    NVARCHAR(100)  NULL
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = N'IX_AppUser_UserName' AND object_id = OBJECT_ID(N'dbo.AppUser'))
    CREATE INDEX IX_AppUser_UserName ON dbo.AppUser (UserName);
GO


IF OBJECT_ID(N'dbo.Users', N'U') IS NOT NULL
    RAISERROR(N'dbo.Users already exists - check it before re-running this script.', 16, 1);
GO

IF OBJECT_ID(N'dbo.Users', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Users (
        DocId       CHAR(24)       NOT NULL CONSTRAINT PK_Users PRIMARY KEY,
        Seq         BIGINT         IDENTITY(1, 1) NOT NULL,
        EsId        NVARCHAR(200)  COLLATE Latin1_General_100_BIN2 NULL,
        Email       NVARCHAR(400)  COLLATE Latin1_General_100_BIN2 NULL,
        DisplayName NVARCHAR(400)  NULL,
        Designation NVARCHAR(400)  NULL,
        [Role]      NVARCHAR(200)  NULL,
        Permissions NVARCHAR(MAX)  NULL,
        Teams       NVARCHAR(MAX)  NULL,
        Countries   NVARCHAR(MAX)  NULL,
        Products    NVARCHAR(MAX)  NULL,
        [Status]    NVARCHAR(100)  NULL,
        CreatedAt   DATETIME2(3)   NULL,
        UpdatedAt   DATETIME2(3)   NULL
    );
END
GO

CREATE INDEX IX_Users_Email ON dbo.Users (Email);
GO

IF OBJECT_ID('tempdb..#AdminUsersDeduped') IS NOT NULL DROP TABLE #AdminUsersDeduped;
IF OBJECT_ID('tempdb..#LegacyUsers') IS NOT NULL DROP TABLE #LegacyUsers;

SELECT *, ROW_NUMBER() OVER (PARTITION BY EmailLower ORDER BY UpdatedAt DESC) AS rn
INTO #AdminUsersDeduped
FROM (
    SELECT
        DocId,
        JSON_VALUE(Payload, '$.esId')          AS EsId,
        LOWER(JSON_VALUE(Payload, '$.email'))  AS EmailLower,
        JSON_VALUE(Payload, '$.email')         AS Email,
        JSON_VALUE(Payload, '$.displayName')   AS DisplayName,
        JSON_VALUE(Payload, '$.designation')   AS Designation,
        JSON_VALUE(Payload, '$.role')          AS [Role],
        JSON_VALUE(Payload, '$.permissions')   AS Permissions,
        JSON_VALUE(Payload, '$.teams')         AS Teams,
        JSON_VALUE(Payload, '$.countries')     AS Countries,
        JSON_VALUE(Payload, '$.products')      AS Products,
        CreatedAt,
        UpdatedAt
    FROM dbo.IntakeAdminResource
    WHERE Resource = 'users'
      AND JSON_VALUE(Payload, '$.email') IS NOT NULL
      AND LTRIM(RTRIM(JSON_VALUE(Payload, '$.email'))) <> ''
) AS AdminUsers;
GO

SELECT
    DocId, UserName AS EsId, LOWER(Email) AS EmailLower, Email,
    [Name] AS DisplayName, Designation, [Role], [Status]
INTO #LegacyUsers
FROM dbo.AppUser;
GO

INSERT INTO dbo.Users (DocId, EsId, Email, DisplayName, Designation, [Role], Permissions,
                       Teams, Countries, Products, [Status], CreatedAt, UpdatedAt)
SELECT
    a.DocId,
    NULLIF(LTRIM(RTRIM(a.EsId)), ''),
    a.Email,
    NULLIF(LTRIM(RTRIM(a.DisplayName)), ''),
    NULLIF(LTRIM(RTRIM(a.Designation)), ''),
    NULLIF(LTRIM(RTRIM(a.[Role])), ''),
    NULLIF(LTRIM(RTRIM(a.Permissions)), ''),
    NULLIF(LTRIM(RTRIM(a.Teams)), ''),
    NULLIF(LTRIM(RTRIM(a.Countries)), ''),
    NULLIF(LTRIM(RTRIM(a.Products)), ''),
    l.[Status],
    a.CreatedAt,
    a.UpdatedAt
FROM #AdminUsersDeduped a
LEFT JOIN #LegacyUsers l ON l.EmailLower = a.EmailLower
WHERE a.rn = 1;
GO

INSERT INTO dbo.Users (DocId, EsId, Email, DisplayName, Designation, [Role], [Status],
                       CreatedAt, UpdatedAt)
SELECT
    l.DocId,
    NULLIF(LTRIM(RTRIM(l.EsId)), ''),
    l.Email,
    NULLIF(LTRIM(RTRIM(l.DisplayName)), ''),
    NULLIF(LTRIM(RTRIM(l.Designation)), ''),
    NULLIF(LTRIM(RTRIM(l.[Role])), ''),
    l.[Status],
    SYSUTCDATETIME(),
    SYSUTCDATETIME()
FROM #LegacyUsers l
WHERE l.EmailLower IS NOT NULL AND l.EmailLower <> ''
  AND NOT EXISTS (SELECT 1 FROM #AdminUsersDeduped a WHERE a.EmailLower = l.EmailLower AND a.rn = 1);
GO

DROP TABLE #AdminUsersDeduped;
DROP TABLE #LegacyUsers;
GO

IF EXISTS (
    SELECT 1 FROM dbo.Users WHERE EsId IS NOT NULL
    GROUP BY EsId HAVING COUNT(*) > 1
)
    RAISERROR(N'dbo.Users has duplicate EsId values after migration - resolve them before adding the unique index. Run: SELECT EsId, COUNT(*) FROM dbo.Users WHERE EsId IS NOT NULL GROUP BY EsId HAVING COUNT(*) > 1;', 16, 1);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UQ_Users_EsId' AND object_id = OBJECT_ID(N'dbo.Users'))
    CREATE UNIQUE INDEX UQ_Users_EsId ON dbo.Users (EsId) WHERE EsId IS NOT NULL;
GO

SELECT COUNT(*) AS LegacyAppUserCount FROM dbo.AppUser;
SELECT COUNT(DISTINCT LOWER(JSON_VALUE(Payload, '$.email'))) AS DistinctAdminResourceUserEmails
    FROM dbo.IntakeAdminResource WHERE Resource = 'users' AND JSON_VALUE(Payload, '$.email') IS NOT NULL;
SELECT COUNT(*) AS NewUsersTableCount FROM dbo.Users;
SELECT * FROM dbo.Users ORDER BY Seq;

