IF OBJECT_ID(N'dbo.IntakeRequest', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.IntakeRequest', N'ExtraFields') IS NULL
    RAISERROR(N'IntakeRequest exists with a different layout. Check it before running this script.', 16, 1);
IF OBJECT_ID(N'dbo.Attachment', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Attachment', N'Data') IS NULL
    RAISERROR(N'Attachment exists with a different layout. Check it before running this script.', 16, 1);
IF OBJECT_ID(N'dbo.Counter', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Counter', N'Seq') IS NULL
    RAISERROR(N'Counter exists with a different layout. Check it before running this script.', 16, 1);
GO

IF OBJECT_ID(N'dbo.IntakeRequest', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.IntakeRequest (
        DocId CHAR(24) NOT NULL CONSTRAINT PK_IntakeRequest PRIMARY KEY,
        Seq BIGINT IDENTITY(1, 1) NOT NULL,
        OppId NVARCHAR(100) COLLATE Latin1_General_100_BIN2 NOT NULL,
        OppIdBytes AS DATALENGTH(OppId) PERSISTED,
        [RequestTitle] NVARCHAR(MAX) NULL,
        [RequestorId] NVARCHAR(MAX) NULL,
        [RequestorName] NVARCHAR(MAX) NULL,
        [SubmittedBy] NVARCHAR(MAX) NULL,
        [Owner] NVARCHAR(MAX) NULL,
        [CountryBu] NVARCHAR(MAX) NULL,
        [SubBu] NVARCHAR(MAX) NULL
            CONSTRAINT CK_IntakeRequest_SubBu CHECK (ISJSON([SubBu]) = 1),
        [Region] NVARCHAR(MAX) NULL
            CONSTRAINT CK_IntakeRequest_Region CHECK (ISJSON([Region]) = 1),
        [OfferImpact] NVARCHAR(MAX) NULL
            CONSTRAINT CK_IntakeRequest_OfferImpact CHECK (ISJSON([OfferImpact]) = 1),
        [DtOfferImpact] NVARCHAR(MAX) NULL,
        [SavingsDollar] FLOAT NULL,
        [SavingsFte] FLOAT NULL,
        [FteAnnualSavings] FLOAT NULL,
        [ExpectedDelivery] NVARCHAR(MAX) NULL,
        [Team] NVARCHAR(MAX) NULL,
        [Status] NVARCHAR(MAX) NULL,
        [OpsStatus] NVARCHAR(MAX) NULL,
        [OpsUpdatedBy] NVARCHAR(MAX) NULL,
        [GptDelivery] NVARCHAR(MAX) NULL,
        [Stage] NVARCHAR(MAX) NULL,
        [SolutionType] NVARCHAR(MAX) NULL,
        [Solution] NVARCHAR(MAX) NULL,
        [DeliveryWeeks] FLOAT NULL,
        [ProblemStatement] NVARCHAR(MAX) NULL,
        [TargetDate] NVARCHAR(MAX) NULL,
        [OpportunityOverview] NVARCHAR(MAX) NULL,
        [Opportunity] NVARCHAR(MAX) NULL,
        [IncidentSavingsDollar] FLOAT NULL,
        [TimeSavingsPerMonth] FLOAT NULL,
        [Shore] NVARCHAR(MAX) NULL,
        [IncidentsSaved] FLOAT NULL,
        [TimeSavings] FLOAT NULL,
        [ClientsImpacted] FLOAT NULL,
        [FteSavingsDollar] FLOAT NULL,
        [Revenue] FLOAT NULL,
        [StatusChangedOn] NVARCHAR(MAX) NULL,
        [CompletedOn] NVARCHAR(MAX) NULL,
        [SubmittedOn] NVARCHAR(MAX) NULL,
        [Created] NVARCHAR(MAX) NULL,
        [Modified] NVARCHAR(MAX) NULL,
        [RequestType] NVARCHAR(MAX) NULL,
        [ServiceImplementation] NVARCHAR(MAX) NULL
            CONSTRAINT CK_IntakeRequest_ServiceImplementation CHECK (ISJSON([ServiceImplementation]) = 1),
        [StrategicInitiatives] NVARCHAR(MAX) NULL
            CONSTRAINT CK_IntakeRequest_StrategicInitiatives CHECK (ISJSON([StrategicInitiatives]) = 1),
        [OrgReadiness] NVARCHAR(MAX) NULL,
        [BenefitTypes] NVARCHAR(MAX) NULL
            CONSTRAINT CK_IntakeRequest_BenefitTypes CHECK (ISJSON([BenefitTypes]) = 1),
        [ProductivityLevel] NVARCHAR(MAX) NULL,
        [CostAvoidanceLevel] NVARCHAR(MAX) NULL,
        [ComplianceRiskLevel] NVARCHAR(MAX) NULL,
        [TechnicalDetailsMode] NVARCHAR(MAX) NULL,
        [TechnicalDependencies] NVARCHAR(MAX) NULL,
        [BcProcessOwner] NVARCHAR(MAX) NULL,
        [BcProjectSponsor] NVARCHAR(MAX) NULL,
        [BcProblemStatement] NVARCHAR(MAX) NULL,
        [BcGoalStatement] NVARCHAR(MAX) NULL,
        [BcScopeIn] NVARCHAR(MAX) NULL,
        [BcScopeOut] NVARCHAR(MAX) NULL,
        [BusinessCase] NVARCHAR(MAX) NULL
            CONSTRAINT CK_IntakeRequest_BusinessCase CHECK (ISJSON([BusinessCase]) = 1),
        [TimelineDate] NVARCHAR(MAX) NULL,
        [TimelineNotes] NVARCHAR(MAX) NULL,
        [ProcessName] NVARCHAR(MAX) NULL,
        [Tool] NVARCHAR(MAX) NULL,
        [SystemRequestTypes] NVARCHAR(MAX) NULL
            CONSTRAINT CK_IntakeRequest_SystemRequestTypes CHECK (ISJSON([SystemRequestTypes]) = 1),
        [SystemSource] NVARCHAR(MAX) NULL,
        [LegalDetails] NVARCHAR(MAX) NULL,
        [ComplianceDetails] NVARCHAR(MAX) NULL,
        [DeliveryModel] NVARCHAR(MAX) NULL,
        [SecurityMode] NVARCHAR(MAX) NULL,
        [SecurityRiskLevel] NVARCHAR(MAX) NULL,
        [SecurityIncidents] FLOAT NULL,
        [TimeMode] NVARCHAR(MAX) NULL,
        [CostReductionLevel] NVARCHAR(MAX) NULL,
        [MinutesSavedPerTransaction] FLOAT NULL,
        [AnnualVolume] FLOAT NULL,
        [RevenueMode] NVARCHAR(MAX) NULL,
        [RevenueImpact] FLOAT NULL,
        [RevenueGenerationLevel] NVARCHAR(MAX) NULL,
        [EfficiencyLevel] NVARCHAR(MAX) NULL,
        [BusinessValueComment] NVARCHAR(MAX) NULL,
        [BusinessValueValidated] BIT NULL,
        [CalculatedBusinessValue] FLOAT NULL,
        [DtStrategic] FLOAT NULL,
        [DtFeasibility] FLOAT NULL,
        [DtInvestment] FLOAT NULL,
        [DtSizing] NVARCHAR(MAX) NULL,
        [DtRoi] FLOAT NULL,
        [DtBenefitScore] FLOAT NULL,
        [DtTechnicalReadiness] NVARCHAR(MAX) NULL,
        [DtImplementationEffort] NVARCHAR(MAX) NULL,
        [DtTimeToValueGpt] NVARCHAR(MAX) NULL,
        [DtDevTimeDt] NVARCHAR(MAX) NULL,
        [DtOrgReadiness] NVARCHAR(MAX) NULL,
        [DtPrioritizationScore] FLOAT NULL,
        [DtCommitmentRecommendation] NVARCHAR(MAX) NULL,
        [DtRejectionReason] NVARCHAR(MAX) NULL,
        [DtDeliveryEstimate] NVARCHAR(MAX) NULL,
        [DtDelivery] NVARCHAR(MAX) NULL,
        [DtRequiredAttendees] NVARCHAR(MAX) NULL,
        [DtNotes] NVARCHAR(MAX) NULL,
        [DtEvaluator] NVARCHAR(MAX) NULL,
        [DtEvaluatedOn] NVARCHAR(MAX) NULL,
        [DtFeasibilityCriteria] NVARCHAR(MAX) NULL,
        [DtDraftSavedOn] NVARCHAR(MAX) NULL,
        [GptStrategic] FLOAT NULL,
        [GptFeasibility] FLOAT NULL,
        [GptInvestment] FLOAT NULL,
        [GptRoi] FLOAT NULL,
        [GptSizing] NVARCHAR(MAX) NULL,
        [GptBenefitScore] FLOAT NULL,
        [GptTechnicalReadiness] NVARCHAR(MAX) NULL,
        [GptImplementationEffort] NVARCHAR(MAX) NULL,
        [GptTimeToValueGpt] NVARCHAR(MAX) NULL,
        [GptDevTimeDt] NVARCHAR(MAX) NULL,
        [GptOrgReadiness] NVARCHAR(MAX) NULL,
        [GptPrioritizationScore] FLOAT NULL,
        [GptCommitmentRecommendation] NVARCHAR(MAX) NULL,
        [GptRejectionReason] NVARCHAR(MAX) NULL,
        [GptDeliveryEstimate] NVARCHAR(MAX) NULL,
        [GptNotes] NVARCHAR(MAX) NULL,
        [GptEvaluator] NVARCHAR(MAX) NULL,
        [GptEvaluatedOn] NVARCHAR(MAX) NULL,
        [GptFeasibilityCriteria] NVARCHAR(MAX) NULL,
        [GptDraftSavedOn] NVARCHAR(MAX) NULL,
        [GptRequiredAttendees] NVARCHAR(MAX) NULL,
        [ReviewOutcome] NVARCHAR(MAX) NULL,
        [ReviewerNotes] NVARCHAR(MAX) NULL,
        [EvaluatorNotes] NVARCHAR(MAX) NULL,
        [FinalReviewer] NVARCHAR(MAX) NULL,
        [ReviewDraftSavedOn] NVARCHAR(MAX) NULL,
        ExtraFields NVARCHAR(MAX) NULL
            CONSTRAINT CK_IntakeRequest_ExtraFields CHECK (ISJSON(ExtraFields) = 1),
        StatusHistoryPresent BIT NOT NULL,
        OpsStatusHistoryPresent BIT NOT NULL,
        BuInputRowsPresent BIT NOT NULL,
        AttachmentsPresent BIT NOT NULL,
        CreatedAt DATETIME2(3) NULL,
        UpdatedAt DATETIME2(3) NULL,
        [Version] INT NULL,
        CONSTRAINT UQ_IntakeRequest_OppId UNIQUE (OppId, OppIdBytes)
    );
END
GO
 
IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = N'IX_IntakeRequest_CreatedAt' AND object_id = OBJECT_ID(N'dbo.IntakeRequest'))
    CREATE INDEX IX_IntakeRequest_CreatedAt ON dbo.IntakeRequest (CreatedAt DESC, Seq);
GO

IF OBJECT_ID(N'dbo.IntakeRequestStatusHistory', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.IntakeRequestStatusHistory (
        RequestDocId CHAR(24)      NOT NULL,
        Position     INT           NOT NULL,
        [Status]     NVARCHAR(MAX) NULL,
        [Action]     NVARCHAR(MAX) NULL,
        ActorName    NVARCHAR(MAX) NULL,
        ActorEmail   NVARCHAR(MAX) NULL,
        ChangedOn    NVARCHAR(MAX) NULL,
        Note         NVARCHAR(MAX) NULL,
        CONSTRAINT PK_IntakeRequestStatusHistory PRIMARY KEY (RequestDocId, Position),
        CONSTRAINT FK_IntakeRequestStatusHistory_IntakeRequest FOREIGN KEY (RequestDocId)
            REFERENCES dbo.IntakeRequest (DocId) ON DELETE CASCADE
    );
END
GO

IF OBJECT_ID(N'dbo.IntakeRequestOpsStatusHistory', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.IntakeRequestOpsStatusHistory (
        RequestDocId CHAR(24)      NOT NULL,
        Position     INT           NOT NULL,
        [Status]     NVARCHAR(MAX) NULL,
        [Action]     NVARCHAR(MAX) NULL,
        ActorName    NVARCHAR(MAX) NULL,
        ActorEmail   NVARCHAR(MAX) NULL,
        ChangedOn    NVARCHAR(MAX) NULL,
        Note         NVARCHAR(MAX) NULL,
        CONSTRAINT PK_IntakeRequestOpsStatusHistory PRIMARY KEY (RequestDocId, Position),
        CONSTRAINT FK_IntakeRequestOpsStatusHistory_IntakeRequest FOREIGN KEY (RequestDocId)
            REFERENCES dbo.IntakeRequest (DocId) ON DELETE CASCADE
    );
END
GO

IF OBJECT_ID(N'dbo.IntakeRequestBuInputRow', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.IntakeRequestBuInputRow (
        RequestDocId CHAR(24)      NOT NULL,
        Position     INT           NOT NULL,
        Bu           NVARCHAR(MAX) NULL,
        [Source]     NVARCHAR(MAX) NULL,
        SubBu        NVARCHAR(MAX) NULL,
        Region       NVARCHAR(MAX) NULL,
        Months       NVARCHAR(MAX) NULL CONSTRAINT CK_IntakeRequestBuInputRow_Months CHECK (ISJSON(Months) = 1),
        CONSTRAINT PK_IntakeRequestBuInputRow PRIMARY KEY (RequestDocId, Position),
        CONSTRAINT FK_IntakeRequestBuInputRow_IntakeRequest FOREIGN KEY (RequestDocId)
            REFERENCES dbo.IntakeRequest (DocId) ON DELETE CASCADE
    );
END
GO

IF OBJECT_ID(N'dbo.IntakeRequestAttachmentInfo', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.IntakeRequestAttachmentInfo (
        RequestDocId CHAR(24)      NOT NULL,
        Position     INT           NOT NULL,
        [Name]       NVARCHAR(MAX) NULL,
        Size         FLOAT         NULL,
        [Type]       NVARCHAR(MAX) NULL,
        CONSTRAINT PK_IntakeRequestAttachmentInfo PRIMARY KEY (RequestDocId, Position),
        CONSTRAINT FK_IntakeRequestAttachmentInfo_IntakeRequest FOREIGN KEY (RequestDocId)
            REFERENCES dbo.IntakeRequest (DocId) ON DELETE CASCADE
    );
END
GO

IF OBJECT_ID(N'dbo.Attachment', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Attachment (
        DocId     CHAR(24)       NOT NULL CONSTRAINT PK_Attachment PRIMARY KEY,
        Seq       BIGINT         IDENTITY(1, 1) NOT NULL,
        RequestId NVARCHAR(850)  COLLATE Latin1_General_100_BIN2 NULL,
        [Name]    NVARCHAR(MAX)  NULL,
        Data      VARBINARY(MAX) NULL,
        DataText  NVARCHAR(MAX)  NULL,
        [Version] INT            NULL
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = N'IX_Attachment_RequestId' AND object_id = OBJECT_ID(N'dbo.Attachment'))
    CREATE INDEX IX_Attachment_RequestId ON dbo.Attachment (RequestId, Seq);
GO

IF OBJECT_ID(N'dbo.Counter', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Counter (
        [Name] NVARCHAR(200) COLLATE Latin1_General_100_BIN2 NOT NULL CONSTRAINT PK_Counter PRIMARY KEY,
        Seq    BIGINT        NOT NULL
    );
END
GO

IF EXISTS (SELECT 1 FROM dbo.IntakeRequest WHERE LEN(Stage) > 200 OR LEN(CountryBu) > 200)
    RAISERROR(N'dbo.IntakeRequest has a Stage or CountryBu value longer than 200 characters - check it before shrinking the column.', 16, 1);
GO

ALTER TABLE dbo.IntakeRequest ALTER COLUMN Stage NVARCHAR(200) NULL;
GO
ALTER TABLE dbo.IntakeRequest ALTER COLUMN CountryBu NVARCHAR(200) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_IntakeRequest_Stage' AND object_id = OBJECT_ID(N'dbo.IntakeRequest'))
    CREATE INDEX IX_IntakeRequest_Stage ON dbo.IntakeRequest (Stage);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_IntakeRequest_CountryBu' AND object_id = OBJECT_ID(N'dbo.IntakeRequest'))
    CREATE INDEX IX_IntakeRequest_CountryBu ON dbo.IntakeRequest (CountryBu);
GO
