import React from 'react';
import { useAppStore } from '../hooks/useAppStore';
import { DEFAULT_SETTINGS } from '../types';
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
  const { settings } = useAppStore();
  
  // Helper function to check if settings have been changed from defaults
  const hasCustomSettings = () => {
    return Object.keys(DEFAULT_SETTINGS).some(key => {
      const settingsKey = key as keyof typeof DEFAULT_SETTINGS;
      return settings[settingsKey] !== DEFAULT_SETTINGS[settingsKey];
    });
  };

  return (
    <div className="flex gap-8 h-full">
      {/* Left Column - Controls */}
      <div className="w-96 flex-shrink-0 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Export Your Logos Notes</CardTitle>
            <p className="text-sm text-muted-foreground">
              {hasCustomSettings() ? 'With Custom Settings' : 'With Default Settings'}
            </p>
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

      {/* Right Column - Output Log */}
      <div className="flex-1">
        <OutputLog logMessages={logMessages} />
      </div>
    </div>
  );
};