CREATE TABLE Info (
					Version int not null
				);
CREATE TABLE Notes (
					NoteId integer primary key autoincrement,
					ExternalId text not null,
					RevisionToken text,
					ImportId text,
					CreatedDate text not null,
					ModifiedDate text,
					CreatedBy text,
					ModifiedBy text,
					IsDeleted bool not null default 0,
					IsTrashed bool not null default 0,
					IsSyncing bool not null default 0,
					Kind int not null,
					ContentRichText text,
					FoldedContent text,
					NoteIndicatorId int,
					NoteColorId int,
					NoteStyleId int,
					AnchorsJson text,
					AnchorDataTypeId int,
					AnchorLanguageId int,
					AnchorResourceIdId int,
					AnchorBibleBook int,
					AnchorWorkflowTemplateIdId int,
					AnchorWorkflowKeyId int,
					AnchorGuideSectionId int,
					AnchorInputIdId int,
					TagsJson text,
					NotebookExternalId text not null,
					Rank integer not null default 0,
					Indent int not null default 0,
					LabelsJson text,
					ClippingTitleRichText text,
					ClippingExcerptRichText text,
					Role int not null default 1
				);
CREATE TABLE sqlite_sequence(name,seq);
CREATE INDEX Notes_ExternalId_IsDeleted on Notes(ExternalId, IsDeleted);
CREATE INDEX Notes_IsDeleted_IsTrashed_NotebookExternalId on Notes(IsDeleted, IsTrashed, NotebookExternalId);
CREATE INDEX Notes_Kind on Notes(Kind);
CREATE INDEX Notes_CreatedDate on Notes(CreatedDate);
CREATE INDEX Notes_ModifiedDate on Notes(ModifiedDate);
CREATE INDEX Notes_CreatedBy on Notes(CreatedBy);
CREATE INDEX Notes_AnchorIds on Notes(AnchorGuideSectionId, AnchorDataTypeId, AnchorLanguageId, AnchorResourceIdId, AnchorWorkflowTemplateIdId, AnchorInputIdId);
CREATE TABLE Notebooks (
					NotebookId integer primary key autoincrement,
					ExternalId text not null,
					RevisionToken text,
					CreatedDate text not null,
					ModifiedDate text,
					CreatedBy text,
					ModifiedBy text,
					IsDeleted bool not null default 0,
					IsTrashed bool not null default 0,
					IsSyncing bool not null default 0,
					Title text,
					ImportId text,
					Role int not null default 1
				);
CREATE INDEX Notebooks_ExternalId_IsDeleted_IsTrashed on Notebooks(ExternalId, IsDeleted, IsTrashed);
CREATE INDEX Notebooks_IsDeleted_IsTrashed on Notebooks(IsDeleted, IsTrashed);
CREATE TABLE SyncItems (
					SyncItemId integer primary key autoincrement,
					NoteId integer,
					NotebookId integer,
					Kind int not null,
					SyncDocId text,
					LastUploadId text,
					IsDeleted bool not null default 0,
					RevisionNumber integer,
					Epoch int,
					LastEditorId int,
					SyncState int not null default 0,
					ModifiedUtc text,
					ExtraJson text
				);
CREATE UNIQUE INDEX SyncItems_SyncDocId_Kind on SyncItems(SyncDocId, Kind);
CREATE INDEX SyncItems_SyncState on SyncItems(SyncState);
CREATE INDEX SyncItems_NoteId_Kind on SyncItems(NoteId, Kind);
CREATE INDEX SyncItems_NotebookId_Kind on SyncItems(NotebookId, Kind);
CREATE TABLE NoteTags (
					NoteId integer not null,
					TagId int not null
				);
CREATE INDEX NoteTags_NoteId_TagId on NoteTags(NoteId, TagId);
CREATE INDEX NoteTags_TagId_NoteId on NoteTags(TagId, NoteId);
CREATE TABLE Tags (
					TagId integer primary key autoincrement,
					Text text not null,
					FoldedText text not null
				);
CREATE UNIQUE INDEX Tags_Text on Tags(Text);
CREATE TABLE NoteAnchorTextRanges (
					NoteAnchorTextRangeId integer primary key autoincrement,
					ResourceIdId int not null,
					ResourceVersionId integer not null,
					Offset int not null,
					PastEnd int not null,
					NoteId integer not null,
					AnchorIndex int not null,
					WordNumberCount int not null default -1,
					WordNumbers blob
				);
CREATE INDEX NoteAnchorTextRanges_NoteId_ResourceIdId on NoteAnchorTextRanges(NoteId, ResourceIdId);
CREATE INDEX NoteAnchorTextRanges_ResourceVersionId_Offset_PastEnd on NoteAnchorTextRanges(ResourceVersionId, Offset, PastEnd);
CREATE TABLE NoteAnchorReferences (
					NoteAnchorReferenceId integer primary key autoincrement,
					DataTypeId int not null,
					StartSortKey blob not null,
					PastEndSortKey blob not null,
					NoteId integer not null,
					AnchorIndex int not null
				);
CREATE INDEX NoteAnchorReferences_NoteId on NoteAnchorReferences(NoteId);
CREATE INDEX NoteAnchorReferences_DataTypeId on NoteAnchorReferences(DataTypeId);
CREATE TABLE NoteAnchorHeadwords (
					NoteAnchorHeadwordId integer primary key autoincrement,
					LanguageId int not null,
					FoldedHeadword text not null,
					NoteId integer not null,
					AnchorIndex int not null
				);
CREATE INDEX NoteAnchorHeadwords_NoteId on NoteAnchorHeadwords(NoteId);
CREATE INDEX NoteAnchorHeadwords_LanguageId on NoteAnchorHeadwords(LanguageId);
CREATE TABLE NoteAnchorFacetReferences (
					NoteAnchorFacetReferenceId integer primary key autoincrement,
					NoteId integer not null,
					AnchorIndex int not null,
					DataTypeId int not null,
					BibleBook int,
					SortKey blob not null,
					Reference text not null
				);
CREATE INDEX NoteAnchorFacetReferences_NoteId on NoteAnchorFacetReferences(NoteId);
CREATE TABLE NoteIndicators (
					NoteIndicatorId integer primary key autoincrement,
					Name text not null
				);
CREATE UNIQUE INDEX NoteIndicators_Name on NoteIndicators(Name);
CREATE TABLE NoteColors (
					NoteColorId integer primary key autoincrement,
					Name text not null
				);
CREATE UNIQUE INDEX NoteColors_Name on NoteColors(Name);
CREATE TABLE NoteStyles (
					NoteStyleId integer primary key autoincrement,
					Name text not null
				);
CREATE UNIQUE INDEX NoteStyles_Name on NoteStyles(Name);
CREATE TABLE DataTypes (
					DataTypeId integer primary key autoincrement,
					Name text not null
				);
CREATE UNIQUE INDEX DataTypes_Name on DataTypes(Name);
CREATE TABLE Languages (
					LanguageId integer primary key autoincrement,
					Name text not null
				);
CREATE UNIQUE INDEX Languages_Name on Languages(Name);
CREATE TABLE ResourceIds (
					ResourceIdId integer primary key autoincrement,
					ResourceId text not null
				);
CREATE UNIQUE INDEX ResourceIds_ResourceId on ResourceIds(ResourceId);
CREATE TABLE ResourceVersions (
					ResourceVersionId integer primary key autoincrement,
					ResourceId text not null,
					Version text not null,
					IsCurrent bool not null default 0
				);
CREATE UNIQUE INDEX ResourceVersions_ResourceId_Version on ResourceVersions(ResourceId, Version);
CREATE TABLE WorkflowTemplateIds (
					WorkflowTemplateIdId integer primary key autoincrement,
					WorkflowTemplateId text not null
				);
CREATE UNIQUE INDEX WorkflowTemplateIds_WorkflowTemplateId on WorkflowTemplateIds(WorkflowTemplateId);
CREATE TABLE WorkflowKeys (
					WorkflowKeyId integer primary key autoincrement,
					WorkflowKey text not null
				);
CREATE UNIQUE INDEX WorkflowKeys_WorkflowKey on WorkflowKeys(WorkflowKey);
CREATE TABLE GuideSections (
					GuideSectionId integer primary key autoincrement,
					GuideSection text not null
				);
CREATE UNIQUE INDEX GuideSections_GuideSection on GuideSections(GuideSection);
CREATE TABLE InputIds (
					InputIdId integer primary key autoincrement,
					InputId text not null
				);
CREATE UNIQUE INDEX InputIds_InputId on InputIds(InputId);
CREATE TABLE NeedsAnchorUpdateNotes (
					NoteId integer primary key,
					RefCount int not null
				);
CREATE TABLE SyncingNotes (
					NoteId integer not null
				);
CREATE TABLE SyncingNotebooks (
					NotebookId integer not null
				);
CREATE TABLE SyncProperties (
					SyncPropertyId integer primary key autoincrement,
					Key text not null,
					Value text not null
				);
CREATE UNIQUE INDEX SyncProperties_Key on SyncProperties(Key);
CREATE TABLE SyncUploads (
					SyncUploadId integer primary key autoincrement,
					UploadId text not null,
					UtcDateTime text not null
				);
CREATE TABLE BibleDataTypeInfo (
					BibleDataTypeNames text not null
				);
