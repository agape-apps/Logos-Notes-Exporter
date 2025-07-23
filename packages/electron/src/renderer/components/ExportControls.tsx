import React from 'react';
import { FolderIcon, FileIcon, InfoIcon } from 'lucide-react';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

interface ExportControlsProps {
  selectedDatabasePath: string | null;
  isExporting: boolean;
  exportProgress: number;
  exportMessage: string;
  lastExportSuccess: boolean;
  outputPath: string | null;
  onExport: () => void;
  onOpenFolder: () => void;
  onSelectDatabase: () => void;
}

/**
 * ExportControls Component - Basic mode export controls and database status
 */
export const ExportControls: React.FC<ExportControlsProps> = ({
  selectedDatabasePath,
  isExporting,
  exportProgress,
  exportMessage,
  lastExportSuccess,
  outputPath,
  onExport,
  onOpenFolder,
  onSelectDatabase,
}) => {
  return (
    <div className="space-y-4">      
      {/* Database Status */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${selectedDatabasePath ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
          <span className="text-sm font-medium">
            {selectedDatabasePath ? `Connected: ${selectedDatabasePath.split('/').pop()}` : 'Not connected'}
          </span>
        </div>
      </div>

      {/* Export Progress */}
      {isExporting && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Progress</span>
            <span className="text-sm text-muted-foreground">{exportProgress}%</span>
          </div>
          <Progress value={exportProgress} className="w-full" />
          <p className="text-xs text-muted-foreground">{exportMessage}</p>
        </div>
      )}
      
      {/* Action Buttons */}
      <div className="space-y-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className="w-full"
              onClick={onExport}
              disabled={isExporting || !selectedDatabasePath}
            >
              {isExporting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Exporting...
                </>
              ) : (
                <>
                  <FileIcon className="h-4 w-4 mr-2" />
                  Export Notes
                </>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Export your Logos notes as Markdown files</TooltipContent>
        </Tooltip>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              className="w-full"
              onClick={onOpenFolder}
              disabled={!lastExportSuccess || !outputPath}
            >
              <FolderIcon className="h-4 w-4 mr-2" />
              Open Notes Folder
            </Button>
          </TooltipTrigger>
          <TooltipContent>Open the folder containing exported notes</TooltipContent>
        </Tooltip>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="secondary"
              className="w-full"
              onClick={onSelectDatabase}
              disabled={!!selectedDatabasePath}
            >
              <InfoIcon className="h-4 w-4 mr-2" />
              Select Database
            </Button>
          </TooltipTrigger>
          <TooltipContent>Choose a different Logos database file</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};