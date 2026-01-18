import React from 'react';
import { TournamentSettings } from '../types';

interface SettingsProps {
  settings: TournamentSettings;
  onSettingsChange: (settings: TournamentSettings) => void;
  disabled?: boolean;
}

export const Settings: React.FC<SettingsProps> = ({
  settings,
  onSettingsChange,
  disabled = false
}) => {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Tournament Settings</h2>

      <div className="bg-white rounded-lg p-6 space-y-6">
        <div>
          <label htmlFor="pointsToWin" className="block text-sm font-medium text-gray-700 mb-2">
            Points to Win
          </label>
          <input
            id="pointsToWin"
            type="number"
            min="3"
            max="21"
            value={settings.pointsToWin}
            onChange={(e) => onSettingsChange({ ...settings, pointsToWin: Number(e.target.value) })}
            disabled={disabled}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
          <p className="text-xs text-gray-500 mt-1">
            First team to reach this score wins (e.g., 7 means first to 7 points). Max game could be 7-6.
          </p>
        </div>

        <div>
          <label htmlFor="finalsFormat" className="block text-sm font-medium text-gray-700 mb-2">
            Finals Format
          </label>
          <select
            id="finalsFormat"
            value={settings.finalsFormat}
            onChange={(e) => onSettingsChange({ ...settings, finalsFormat: e.target.value as 'traditional' | 'semifinal' })}
            disabled={disabled}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            <option value="traditional">Traditional (1st+4th vs 2nd+3rd)</option>
            <option value="semifinal">Semifinals (1v4, 2v3, then final)</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            How the finals should be structured
          </p>
        </div>

        {disabled && (
          <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
            <p className="text-sm text-blue-700">
              Settings cannot be changed once the tournament has started. Reset the tournament to change settings.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
