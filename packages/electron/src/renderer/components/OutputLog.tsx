import React from 'react';
import { Textarea } from './ui/textarea';

interface OutputLogProps {
  logMessages: string[];
}

/**
 * OutputLog Component - Displays real-time export progress and messages
 */
export const OutputLog: React.FC<OutputLogProps> = ({ logMessages }) => {
  return (
    <Textarea
      value={logMessages.join('\n')}
      readOnly
      className="h-full resize-none font-mono text-sm"
      placeholder="Ready to export..."
    />
  );
};