import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { ExportControls } from './ExportControls';
import { OutputLog } from './OutputLog';

interface BasicModeProps {
  selectedDatabasePath: string | null;
  isExporting: boolean;
  exportProgress: number;
  exportMessage: string;
  lastExportSuccess: boolean;
  outputPath: string | null;
  logMessages: string[];
  onExport: () => void;
  onOpenFolder: () => void;
  onSelectDatabase: () => void;
}

/**
 * BasicMode Component - Simplified interface for basic note export functionality
 */
export const BasicMode: React.FC<BasicModeProps> = ({
  selectedDatabasePath,
  isExporting,
  exportProgress,
  exportMessage,
  lastExportSuccess,
  outputPath,
  logMessages,
  onExport,
  onOpenFolder,
  onSelectDatabase,
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 h-[calc(100vh-200px)]">
      {/* Left Column - Controls (40%) */}
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Export Your Logos Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <ExportControls
              selectedDatabasePath={selectedDatabasePath}
              isExporting={isExporting}
              exportProgress={exportProgress}
              exportMessage={exportMessage}
              lastExportSuccess={lastExportSuccess}
              outputPath={outputPath}
              onExport={onExport}
              onOpenFolder={onOpenFolder}
              onSelectDatabase={onSelectDatabase}
            />
          </CardContent>
        </Card>
      </div>

      {/* Right Column - Output Log (60%) */}
      <div className="lg:col-span-3">
        <OutputLog logMessages={logMessages} />
      </div>
    </div>
  );
};