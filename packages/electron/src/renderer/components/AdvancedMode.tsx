import React, { useState } from 'react';
import { HelpCircleIcon } from 'lucide-react';
import type { ExportSettings } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Switch } from './ui/switch';
import { Checkbox } from './ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { OutputLog } from './OutputLog';

interface AdvancedModeProps {
  settings: ExportSettings;
  selectedDatabasePath: string | null;
  isExporting: boolean;
  lastExportSuccess: boolean;
  outputPath: string | null;
  logMessages: string[];
  onSettingsChange: (updates: Partial<ExportSettings>) => void;
  onExport: () => void;
  onOpenFolder: () => void;
  onSelectDatabase: () => void;
  onSelectOutputDirectory: () => void;
  onRestoreDefaults: () => void;
}

/**
 * AdvancedMode Component - Full configuration interface for advanced users
 */
export const AdvancedMode: React.FC<AdvancedModeProps> = ({
  settings,
  selectedDatabasePath,
  isExporting,
  lastExportSuccess,
  outputPath,
  logMessages,
  onSettingsChange,
  onExport,
  onOpenFolder,
  onSelectDatabase,
  onSelectOutputDirectory,
  onRestoreDefaults,
}) => {
  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false);

  return (
    <div className="flex gap-8 h-full">
      {/* Left Column - Advanced Settings */}
      <div className="w-96 flex-shrink-0 space-y-4 overflow-y-auto">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Export with Advanced Settings</CardTitle>
              <Dialog open={isHelpDialogOpen} onOpenChange={setIsHelpDialogOpen}>
                <DialogTrigger asChild>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <HelpCircleIcon className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Show help and documentation (not implemented yet)</TooltipContent>
                  </Tooltip>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Advanced Mode Help & Documentation</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 text-sm">
                    <div>
                      <h3 className="font-semibold mb-2">Database Settings</h3>
                      <ul className="space-y-1 text-muted-foreground ml-4">
                        <li>• <strong>Auto-detect:</strong> Automatically finds your Logos database in standard locations</li>
                        <li>• <strong>Custom path:</strong> Choose a specific database file manually</li>
                        <li>• Standard locations: macOS ~/Library/Application Support/Logos4/Documents/*/NotesToolManager/notestool.db</li>
                      </ul>
                    </div>
                    
                    <div>
                      <h3 className="font-semibold mb-2">Output Settings</h3>
                      <ul className="space-y-1 text-muted-foreground ml-4">
                        <li>• <strong>Output Directory:</strong> Where your exported Markdown files will be saved</li>
                        <li>• <strong>Export Subfolder Name:</strong> Subfolder created under output directory to organize exported files</li>
                        <li>• <strong>Organize by notebooks:</strong> Creates folders matching your Logos notebook structure</li>
                        <li>• <strong>Include date folders:</strong> Groups notes by creation date within notebooks</li>
                        <li>• <strong>Skip highlights:</strong> Only exports text notes and annotations, not highlight-only notes</li>
                        <li>• <strong>Create index files:</strong> Generates README.md files for easy navigation</li>
                      </ul>
                    </div>
                    
                    <div>
                      <h3 className="font-semibold mb-2">Markdown Settings</h3>
                      <ul className="space-y-1 text-muted-foreground ml-4">
                        <li>• <strong>Include frontmatter:</strong> Adds YAML metadata at the top of each file</li>
                        <li>• <strong>Show metadata in content:</strong> Also displays metadata in the markdown body</li>
                        <li>• <strong>Include dates:</strong> Shows when notes were created and last modified</li>
                        <li>• <strong>Include notebook info:</strong> Shows which notebook and section each note belongs to</li>
                        <li>• <strong>Include note IDs:</strong> Adds unique identifiers for cross-referencing</li>
                        <li>• <strong>Date format:</strong> Choose how dates are displayed (ISO, locale-specific, or short format)</li>
                      </ul>
                    </div>
                    
                    <div>
                      <h3 className="font-semibold mb-2">Testing</h3>
                      <ul className="space-y-1 text-muted-foreground ml-4">
                        <li>• <strong>Dry run mode:</strong> Preview what would be exported without creating any files</li>
                        <li>• Useful for testing settings before doing a full export</li>
                        <li>• Shows the same output as a real export in the log</li>
                      </ul>
                    </div>
                    
                    <div>
                      <h3 className="font-semibold mb-2">Keyboard Shortcuts</h3>
                      <ul className="space-y-1 text-muted-foreground ml-4">
                        <li>• <strong>Ctrl/Cmd + E:</strong> Start export</li>
                        <li>• <strong>Ctrl/Cmd + O:</strong> Open output folder (after successful export)</li>
                        <li>• <strong>Ctrl/Cmd + ,:</strong> Toggle between Basic and Advanced modes</li>
                        <li>• <strong>Escape:</strong> Cancel export (if running)</li>
                      </ul>
                    </div>
                    
                    <div className="border-t pt-4">
                      <h3 className="font-semibold mb-2">Tips</h3>
                      <ul className="space-y-1 text-muted-foreground ml-4">
                        <li>• Start with a dry run to preview your export before creating files</li>
                        <li>• Use the default settings for most situations - they work well for most users</li>
                        <li>• The auto-detect database feature works for standard Logos installations</li>
                        <li>• All operations are read-only - your original Logos data is never modified</li>
                        <li>• Existing exported files will be overwritten if you export to the same location</li>
                      </ul>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {/* Database Settings Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold border-b pb-1">Database Settings</h3>
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Choose how to locate your Logos database
                </p>
                
                {/* Auto-detect toggle */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium">Auto-detect database</label>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Switch
                        checked={settings.autoDetectDatabase}
                        onCheckedChange={(checked) => onSettingsChange({ autoDetectDatabase: checked })}
                      />
                    </TooltipTrigger>
                    <TooltipContent>Automatic database detection in standard Logos locations</TooltipContent>
                  </Tooltip>
                </div>

                {/* Custom database path */}
                {!settings.autoDetectDatabase && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Custom Database Path</label>
                    <div className="flex gap-2">
                      <Input
                        value={selectedDatabasePath || ''}
                        placeholder="Select database file..."
                        readOnly
                        className="flex-1"
                      />
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={onSelectDatabase}
                          >
                            Browse...
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Choose a different Logos database file</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                )}

                {/* Database Status */}
                <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                  <div className={`w-2 h-2 rounded-full ${selectedDatabasePath ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                  <span className="text-xs font-medium">
                    {selectedDatabasePath ? 'Connected' : 'Not connected'}
                  </span>
                  {selectedDatabasePath && (
                    <span className="text-xs text-muted-foreground ml-auto">
                      {selectedDatabasePath.split('/').pop()}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Output Settings Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold border-b pb-1">Output Settings</h3>
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Configure where and how files are organized
                </p>
                
                {/* Output Directory */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Output Directory</label>
                  <div className="flex gap-2">
                    <Input
                      value={settings.outputDirectory}
                      onChange={(e) => onSettingsChange({ outputDirectory: e.target.value })}
                      placeholder="~/Documents"
                      className="flex-1"
                    />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={onSelectOutputDirectory}
                        >
                          Browse...
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Choose where to save the exported files</TooltipContent>
                    </Tooltip>
                  </div>
                </div>

                {/* Export Subfolder Name */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Export Subfolder Name</label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Input
                        value={settings.exportSubfolderName}
                        onChange={(e) => onSettingsChange({ exportSubfolderName: e.target.value })}
                        placeholder="Logos-Exported-Notes"
                        className="w-full"
                      />
                    </TooltipTrigger>
                    <TooltipContent>Subfolder name created under the output directory to organize exported files</TooltipContent>
                  </Tooltip>
                  <p className="text-xs text-muted-foreground">
                    Files will be exported to: {settings.outputDirectory}/{settings.exportSubfolderName}
                  </p>
                </div>

                {/* Organization Options */}
                <div className="space-y-3">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">File Organization</h4>
                  
                  {/* Organize by notebooks */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <label className="text-sm font-medium">Organize by notebooks</label>
                      <p className="text-xs text-muted-foreground">Group notes by their notebook organization</p>
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Checkbox
                          checked={settings.organizeByNotebooks}
                          onCheckedChange={(checked) => onSettingsChange({ organizeByNotebooks: !!checked })}
                        />
                      </TooltipTrigger>
                      <TooltipContent>Group notes by their notebook organization</TooltipContent>
                    </Tooltip>
                  </div>

                  {/* Include date folders */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <label className="text-sm font-medium">Include date folders</label>
                      <p className="text-xs text-muted-foreground">Create subfolders organized by note creation dates</p>
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Checkbox
                          checked={settings.includeDateFolders}
                          onCheckedChange={(checked) => onSettingsChange({ includeDateFolders: !!checked })}
                        />
                      </TooltipTrigger>
                      <TooltipContent>Create subfolders organized by note creation dates</TooltipContent>
                    </Tooltip>
                  </div>

                  {/* Skip highlights */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <label className="text-sm font-medium">Skip highlights</label>
                      <p className="text-xs text-muted-foreground">Export only text notes, not highlights</p>
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Checkbox
                          checked={settings.skipHighlights}
                          onCheckedChange={(checked) => onSettingsChange({ skipHighlights: !!checked })}
                        />
                      </TooltipTrigger>
                      <TooltipContent>Export only text notes, not highlights</TooltipContent>
                    </Tooltip>
                  </div>

                  {/* Create index files */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <label className="text-sm font-medium">Create index files</label>
                      <p className="text-xs text-muted-foreground">Generate README.md files in each folder</p>
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Checkbox
                          checked={settings.createIndexFiles}
                          onCheckedChange={(checked) => onSettingsChange({ createIndexFiles: !!checked })}
                        />
                      </TooltipTrigger>
                      <TooltipContent>Generate README.md files in each folder for navigation</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </div>
            </div>

            {/* Markdown Settings Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold border-b pb-1">Markdown Settings</h3>
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Control how notes are converted to Markdown
                </p>
                
                {/* Frontmatter and content options */}
                <div className="space-y-3">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Content Options</h4>
                  
                  {/* Include frontmatter */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <label className="text-sm font-medium">Include frontmatter</label>
                      <p className="text-xs text-muted-foreground">Add YAML metadata to the top of each file</p>
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Checkbox
                          checked={settings.includeFrontmatter}
                          onCheckedChange={(checked) => onSettingsChange({ includeFrontmatter: !!checked })}
                        />
                      </TooltipTrigger>
                      <TooltipContent>Add YAML metadata to the top of each file</TooltipContent>
                    </Tooltip>
                  </div>

                  {/* Show metadata in content */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <label className="text-sm font-medium">Show metadata in content</label>
                      <p className="text-xs text-muted-foreground">Include metadata in the markdown body</p>
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Checkbox
                          checked={settings.includeMetadata}
                          onCheckedChange={(checked) => onSettingsChange({ includeMetadata: !!checked })}
                        />
                      </TooltipTrigger>
                      <TooltipContent>Include metadata in the markdown content instead of only in frontmatter</TooltipContent>
                    </Tooltip>
                  </div>

                  {/* Include dates */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <label className="text-sm font-medium">Include dates</label>
                      <p className="text-xs text-muted-foreground">Include creation and modification dates</p>
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Checkbox
                          checked={settings.includeDates}
                          onCheckedChange={(checked) => onSettingsChange({ includeDates: !!checked })}
                        />
                      </TooltipTrigger>
                      <TooltipContent>Include creation and modification dates in exported notes</TooltipContent>
                    </Tooltip>
                  </div>

                  {/* Include notebook info */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <label className="text-sm font-medium">Include notebook info</label>
                      <p className="text-xs text-muted-foreground">Include notebook and section information</p>
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Checkbox
                          checked={settings.includeNotebook}
                          onCheckedChange={(checked) => onSettingsChange({ includeNotebook: !!checked })}
                        />
                      </TooltipTrigger>
                      <TooltipContent>Include notebook and section information in exported notes</TooltipContent>
                    </Tooltip>
                  </div>

                  {/* Include note IDs */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <label className="text-sm font-medium">Include note IDs</label>
                      <p className="text-xs text-muted-foreground">Include unique note identifiers</p>
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Checkbox
                          checked={settings.includeId}
                          onCheckedChange={(checked) => onSettingsChange({ includeId: !!checked })}
                        />
                      </TooltipTrigger>
                      <TooltipContent>Include unique note identifiers for reference</TooltipContent>
                    </Tooltip>
                  </div>
                </div>

                {/* Date format selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Date format</label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Select
                        value={settings.dateFormat}
                        onValueChange={(value: "iso" | "locale" | "short") => onSettingsChange({ dateFormat: value })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select date format" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="iso">ISO (2025-07-22T09:30:04.000Z)</SelectItem>
                          <SelectItem value="locale">Locale (7/22/2025)</SelectItem>
                          <SelectItem value="short">Short (2025-07-22)</SelectItem>
                        </SelectContent>
                      </Select>
                    </TooltipTrigger>
                    <TooltipContent>Choose how dates are formatted in exported notes</TooltipContent>
                  </Tooltip>
                </div>

                {/* Processing options */}
                <div className="space-y-3 pt-3 border-t">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Processing</h4>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <label className="text-sm font-medium">HTML sub/superscript</label>
                      <p className="text-xs text-muted-foreground">Use HTML tags instead of Pandoc-style ~text~ and ^text^</p>
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Switch
                          checked={settings.htmlSubSuperscript}
                          onCheckedChange={(checked) => onSettingsChange({ htmlSubSuperscript: checked })}
                        />
                      </TooltipTrigger>
                      <TooltipContent>Use &lt;sub&gt; and &lt;sup&gt; tags instead of Pandoc-style ~text~ and ^text^</TooltipContent>
                    </Tooltip>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <label className="text-sm font-medium">Use indents instead of blockquotes</label>
                      <p className="text-xs text-muted-foreground">Use &amp;nbsp; indentation instead of converting to blockquotes</p>
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Switch
                          checked={settings.indentsNotQuotes}
                          onCheckedChange={(checked) => onSettingsChange({ indentsNotQuotes: checked })}
                        />
                      </TooltipTrigger>
                      <TooltipContent>Use &amp;nbsp; indentation instead of converting indent levels to blockquotes (&gt;)</TooltipContent>
                    </Tooltip>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <label className="text-sm font-medium">Dry run mode</label>
                      <p className="text-xs text-muted-foreground">Preview what would be exported without creating files</p>
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Switch
                          checked={settings.dryRun}
                          onCheckedChange={(checked) => onSettingsChange({ dryRun: checked })}
                        />
                      </TooltipTrigger>
                      <TooltipContent>Preview what would be exported without creating files</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 pt-4 border-t">
              <div className="flex gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" className="flex-1 min-w-0" onClick={onRestoreDefaults}>
                      <span className="text-xs">🔄 Restore Defaults</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Reset all settings to their default values</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" className="flex-1" onClick={onExport} disabled={isExporting || !selectedDatabasePath}>
                      {settings.dryRun ? '🔍 Preview Export' : '📤 Export'}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {settings.dryRun 
                      ? 'Preview what would be exported without creating files' 
                      : 'Convert your Logos notes to Markdown files'
                    }
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="flex gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" className="flex-1" onClick={onOpenFolder} disabled={!lastExportSuccess || !outputPath}>
                      📁 Open Notes Folder
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Open the folder containing exported notes</TooltipContent>
                </Tooltip>
              </div>
            </div>
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