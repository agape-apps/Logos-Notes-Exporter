import React from 'react';
import { Progress } from './ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface ProgressDisplayProps {
  isExporting: boolean;
  exportProgress: number;
  exportMessage: string;
}

/**
 * ProgressDisplay Component - Shows export progress in a dedicated card
 */
export const ProgressDisplay: React.FC<ProgressDisplayProps> = ({
  isExporting,
  exportProgress,
  exportMessage,
}) => {
  if (!isExporting) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Export Progress</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Progress</span>
            <span className="text-sm text-muted-foreground">{exportProgress}%</span>
          </div>
          <Progress value={exportProgress} className="w-full" />
          <p className="text-xs text-muted-foreground">{exportMessage}</p>
        </div>
      </CardContent>
    </Card>
  );
};