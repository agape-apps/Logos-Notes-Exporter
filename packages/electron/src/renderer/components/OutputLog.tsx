import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Textarea } from './ui/textarea';

interface OutputLogProps {
  logMessages: string[];
}

/**
 * OutputLog Component - Displays real-time export progress and messages
 */
export const OutputLog: React.FC<OutputLogProps> = ({ logMessages }) => {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Output Log</CardTitle>
      </CardHeader>
      <CardContent className="h-full">
        <Textarea
          value={logMessages.join('\n')}
          readOnly
          className="h-full resize-none font-mono text-sm"
          placeholder="Ready to export..."
        />
      </CardContent>
    </Card>
  );
};