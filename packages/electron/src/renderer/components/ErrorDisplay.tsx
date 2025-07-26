import React from 'react';
import { AlertTriangle, X, ChevronDown, ChevronUp, Info, AlertCircle } from 'lucide-react';
import type { StructuredError } from '../types';
import { Button } from './ui/button';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

interface ErrorDisplayProps {
  error: StructuredError;
  onDismiss: () => void;
  showDetails: boolean;
  onToggleDetails: (show: boolean) => void;
}

/**
 * Enhanced error display component with structured error information
 */
export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  onDismiss,
  showDetails,
  onToggleDetails,
}) => {
  const getIcon = () => {
    switch (error.severity) {
      case 'fatal':
      case 'error':
        return <AlertTriangle className="h-4 w-4" />;
      case 'warn':
        return <AlertCircle className="h-4 w-4" />;
      case 'info':
        return <Info className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getVariant = () => {
    switch (error.severity) {
      case 'fatal':
      case 'error':
        return 'destructive' as const;
      case 'warn':
        return 'default' as const;
      case 'info':
        return 'default' as const;
      default:
        return 'destructive' as const;
    }
  };

  return (
    <Alert variant={getVariant()} className="mb-4">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-2 flex-1">
          {getIcon()}
          <div className="flex-1 min-w-0">
            <AlertTitle className="flex items-center justify-between">
              <span className="capitalize">{error.severity} in {error.category.replace('_', ' ')}</span>
              {error.suggestions.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-1 h-auto"
                  onClick={() => onToggleDetails(!showDetails)}
                >
                  {showDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  <span className="sr-only">Toggle error details</span>
                </Button>
              )}
            </AlertTitle>
            <AlertDescription className="mt-1">
              {error.message}
            </AlertDescription>
            
            {error.suggestions.length > 0 && showDetails && (
              <div className="mt-3 space-y-2">
                <p className="text-sm font-medium">💡 Suggestions:</p>
                <ul className="text-sm space-y-1 ml-4">
                  {error.suggestions.map((suggestion, index) => (
                    <li key={index} className="list-disc">
                      {suggestion}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="p-1 h-auto ml-2 shrink-0"
          onClick={onDismiss}
        >
          <X className="h-3 w-3" />
          <span className="sr-only">Dismiss error</span>
        </Button>
      </div>
    </Alert>
  );
};