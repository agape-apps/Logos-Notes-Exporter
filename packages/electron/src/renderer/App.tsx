import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { toast } from 'sonner';
import { SettingsIcon, ArrowLeftIcon } from 'lucide-react';
import { useStore } from './hooks/useStore';
import { Button } from './components/ui/button';
import { Toaster } from './components/ui/sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './components/ui/tooltip';
import { BasicMode } from './components/BasicMode';
import { AdvancedMode } from './components/AdvancedMode';
import type { ExportSettings, AppMode } from './types';
import { DEFAULT_SETTINGS } from './types';

/**
 * Main App component - Entry point for the Logos Notes Exporter Electron app
 * Provides Basic and Advanced modes for exporting Logos notes to Markdown
 */
const App: React.FC = () => {
  const {
    mode,
    setMode,
    settings,
    isExporting,
    exportProgress,
    exportMessage,
    outputPath,
    lastExportSuccess,
    logMessages,
    setExporting,
    setExportProgress,
    setExportResult,
    addLogMessage,
    clearLog,
    setSettings,
    setSelectedDatabasePath,
    selectedDatabasePath
  } = useStore();

  const [isInitialized, setIsInitialized] = useState(false);
  const [hasReceivedMainSettings, setHasReceivedMainSettings] = useState(false);

  // Initialize app on mount
  useEffect(() => {
    const initialize = async () => {
      try {
        console.log('Renderer: Initializing app');
        
        // Load settings from main process
        const savedData = await window.electronAPI.loadSettings();
        if (savedData) {
          console.log('Renderer: Loaded settings from main process');
          setSettings(savedData.settings);
          setHasReceivedMainSettings(true); // Mark that we have main process settings
          // Restore the saved app mode
          setMode(savedData.mode as AppMode);
          
          // If we have a database path in saved settings, set it immediately
          if (savedData.settings.databasePath) {
            console.log('Renderer: Restoring database path from settings:', savedData.settings.databasePath);
            setSelectedDatabasePath(savedData.settings.databasePath);
            // Don't add output log message here - let auto-detection or sync handle it
          }
        }

        // Database detection is handled by main process on startup
        // The database-detected IPC event will set the selectedDatabasePath
        setIsInitialized(true);
        console.log('Renderer: App initialization completed');
      } catch (error) {
        console.error('Renderer: Failed to initialize app:', error);
        addLogMessage('❌ Failed to initialize app');
        setIsInitialized(true);
      }
    };

    initialize();
    // Zustand store actions are stable references and don't need to be in dependencies
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hot reload recovery: Re-sync database state when main process restarts
  useEffect(() => {
    if (!isInitialized) return;
    
    // If we have a database path but main process doesn't know about it (after hot reload),
    // we need to re-notify the main process
    const handleHotReloadRecovery = () => {
      if (selectedDatabasePath) {
        console.log('Renderer: Hot reload detected - re-syncing database state');
        console.log('Renderer: Re-sending database path to main process:', selectedDatabasePath);
        
        // Use the new sync method to explicitly sync database state with main process
        window.electronAPI.syncDatabaseState(selectedDatabasePath).then((result) => {
          if (result.success) {
            console.log('Renderer: Database state synchronized successfully');
            // Don't add redundant output log message - IPC handler will handle it
          } else {
            console.log('Renderer: Database synchronization failed:', result.error);
            addLogMessage(`⚠️ Database sync failed: ${result.error}`);
            
            // Try auto-detection as fallback
            window.electronAPI.detectDatabase().catch((error) => {
              console.error('Renderer: Fallback detection also failed:', error);
            });
          }
        }).catch((error) => {
          console.error('Renderer: Failed to sync database state:', error);
          addLogMessage(`❌ Database sync error: ${error.message || error}`);
          
          // Try auto-detection as fallback
          window.electronAPI.detectDatabase().catch((fallbackError) => {
            console.error('Renderer: Fallback detection also failed:', fallbackError);
          });
        });
      } else {
        console.log('Renderer: No database path to sync, triggering auto-detection');
        // If we don't have a database path, trigger auto-detection
        window.electronAPI.detectDatabase().catch((error) => {
          console.error('Renderer: Auto-detection failed:', error);
        });
      }
    };

    // Delay slightly to allow main process to fully initialize
    const syncTimeout = setTimeout(handleHotReloadRecovery, 2000);
    return () => clearTimeout(syncTimeout);
  }, [isInitialized, selectedDatabasePath, addLogMessage]);

  // Auto-save settings when they change
  useEffect(() => {
    if (!isInitialized) return; // Don't save during initial load
    if (!hasReceivedMainSettings) {
      console.log('Skipping auto-save until main process settings are received');
      return; // Don't save until we have correct settings from main process
    }
    
    // Debounce the save operation to avoid excessive writes
    const saveTimeout = setTimeout(async () => {
      try {
        await window.electronAPI.saveSettings(settings);
        console.log('Settings auto-saved');
      } catch (error) {
        console.error('Failed to auto-save settings:', error);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(saveTimeout);
  }, [settings, isInitialized, hasReceivedMainSettings]);

  // Auto-save mode changes
  useEffect(() => {
    if (!isInitialized) return; // Don't save during initial load
    
    // Save mode changes immediately
    const saveModeChange = async () => {
      try {
        // We need to create a special IPC call for saving mode
        await window.electronAPI.saveMode(mode);
        console.log('Mode auto-saved:', mode);
      } catch (error) {
        console.error('Failed to auto-save mode:', error);
      }
    };

    saveModeChange();
  }, [mode, isInitialized]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isCtrlOrCmd = event.ctrlKey || event.metaKey;
      
      // Prevent shortcuts if user is typing in an input field
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
        return;
      }
      
      switch (event.key.toLowerCase()) {
        case 'e':
          if (isCtrlOrCmd) {
            event.preventDefault();
            if (!isExporting && selectedDatabasePath) {
              handleExport();
              addLogMessage('⌨️ Export started via keyboard shortcut (Ctrl/Cmd+E)');
            }
          }
          break;
          
        case 'o':
          if (isCtrlOrCmd) {
            event.preventDefault();
            if (lastExportSuccess && outputPath) {
              handleOpenFolder();
              addLogMessage('⌨️ Opened output folder via keyboard shortcut (Ctrl/Cmd+O)');
            }
          }
          break;
          
        case ',':
          if (isCtrlOrCmd) {
            event.preventDefault();
            if (!isExporting) {
              handleModeToggle();
              addLogMessage('⌨️ Mode toggled via keyboard shortcut (Ctrl/Cmd+,)');
            }
          }
          break;
          
        case 'escape':
          if (isExporting) {
            event.preventDefault();
            // TODO: Optional export cancellation
            addLogMessage('⌨️ Export cancellation requested (Escape key)');
            toast.info('Export cancellation not yet implemented');
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
    // Zustand store actions are stable references
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExporting, selectedDatabasePath, lastExportSuccess, outputPath, mode, settings]);

  // Set up IPC event listeners
  useEffect(() => {
    const unsubscribers = [
      window.electronAPI.onExportProgress((progress) => {
        setExportProgress(progress);
      }),
      
      window.electronAPI.onExportComplete((result) => {
        setExportResult(result);
        if (result.success) {
          toast.success('Export completed successfully!');
        } else {
          toast.error(`Export failed: ${result.error}`);
        }
      }),
      
      window.electronAPI.onExportError((error) => {
        setExporting(false);
        addLogMessage(`❌ Export error: ${error}`);
        toast.error(`Export failed: ${error}`);
      }),
      
      window.electronAPI.onOutputLog((message) => {
        addLogMessage(message);
      }),
      
      window.electronAPI.onSettingsLoaded((loadedSettings) => {
        console.log('✅ Renderer: Received correct settings from main process, output directory:', loadedSettings.outputDirectory);
        setSettings(loadedSettings);
        setHasReceivedMainSettings(true); // Mark that we now have main process settings
      }),
      
      window.electronAPI.onDatabaseDetected((path) => {
        setSelectedDatabasePath(path);
        setSettings({ databasePath: path });
        addLogMessage(`📂 Database detected: ${path}`);
      })
    ];

    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
    // Zustand store actions are stable references and don't need to be in dependencies
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExport = async () => {
    if (isExporting) return;

    try {
      setExporting(true);
      clearLog();
      
      const exportSettings: ExportSettings = {
        ...settings,
        databasePath: selectedDatabasePath || settings.databasePath
      };

      await window.electronAPI.startExport(exportSettings);
    } catch (error) {
      console.error('Export failed:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      addLogMessage(`❌ Export failed: ${errorMessage}`);
      toast.error(`Export failed: ${errorMessage}`);
      setExporting(false);
    }
  };

  const handleOpenFolder = async () => {
    if (outputPath) {
      try {
        await window.electronAPI.openOutputFolder(outputPath);
      } catch (error) {
        console.error('Failed to open folder:', error);
        toast.error('Failed to open output folder');
      }
    }
  };

  const handleSelectDatabase = async () => {
    try {
      const path = await window.electronAPI.selectDatabase();
      if (path) {
        setSelectedDatabasePath(path);
        setSettings({ databasePath: path });
        addLogMessage(`📂 Database selected: ${path}`);
        toast.success('Database selected successfully');
      }
    } catch (error) {
      console.error('Failed to select database:', error);
      toast.error('Failed to select database');
    }
  };

  const handleModeToggle = () => {
    const newMode = mode === "basic" ? "advanced" : "basic";
    setMode(newMode);
    addLogMessage(`🔄 Switched to ${newMode} mode`);
  };

  const handleSelectOutputDirectory = async () => {
    try {
      const path = await window.electronAPI.selectOutputDirectory();
      if (path) {
        setSettings({ outputDirectory: path });
        addLogMessage(`📁 Output directory selected: ${path}`);
        toast.success('Output directory selected successfully');
      }
    } catch (error) {
      console.error('Failed to select output directory:', error);
      toast.error('Failed to select output directory');
    }
  };

  const handleRestoreDefaults = () => {
    setSettings(DEFAULT_SETTINGS);
    addLogMessage('🔄 Settings restored to defaults');
    toast.success('Settings restored to defaults');
  };

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading Logos Notes Exporter...</p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        <Toaster />
        
        {/* Header */}
        <div className="border-b">
          <div className="px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleModeToggle}
                      disabled={isExporting}
                    >
                      {mode === "basic" ? (
                        <>
                          <SettingsIcon className="h-4 w-4 mr-2" />
                          Advanced
                        </>
                      ) : (
                        <>
                          <ArrowLeftIcon className="h-4 w-4 mr-2" />
                          Basic
                        </>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {mode === "basic" 
                      ? "Switch to Advanced mode for all configuration options" 
                      : "Switch to Basic mode for simplified operation"
                    }
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="text-center flex-1">
                <h1 className="text-2xl font-bold text-foreground">Logos Notes Exporter</h1>
                <p className="text-sm text-muted-foreground">Convert your Logos notes to Markdown files</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-xs text-muted-foreground">v1.2.1</div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="px-8 py-8 h-[calc(100vh-88px)]">
          {mode === "basic" ? (
            <BasicMode
              selectedDatabasePath={selectedDatabasePath || null}
              isExporting={isExporting}
              exportProgress={exportProgress}
              exportMessage={exportMessage}
              lastExportSuccess={lastExportSuccess}
              outputPath={outputPath || null}
              logMessages={logMessages}
              onExport={handleExport}
              onOpenFolder={handleOpenFolder}
              onSelectDatabase={handleSelectDatabase}
            />
          ) : (
            <AdvancedMode
              settings={settings}
              selectedDatabasePath={selectedDatabasePath || null}
              isExporting={isExporting}
              lastExportSuccess={lastExportSuccess}
              outputPath={outputPath || null}
              logMessages={logMessages}
              onSettingsChange={setSettings}
              onExport={handleExport}
              onOpenFolder={handleOpenFolder}
              onSelectDatabase={handleSelectDatabase}
              onSelectOutputDirectory={handleSelectOutputDirectory}
              onRestoreDefaults={handleRestoreDefaults}
            />
          )}
        </div>
    </div>
  </TooltipProvider>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<App />);
}