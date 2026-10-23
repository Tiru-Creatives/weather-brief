import React from 'react';
import { SAMPLE_ROUTES, SampleRoute } from '../utils/sampleData';

export interface BriefingInputs {
  departure: string;
  takeoffAlt: string;
  enrouteAlt: string;
  destAlt: string;
  destination: string;
  etdDate: string; // YYYY-MM-DD
  etdTime: string; // HH:mm
  etaDate: string; // YYYY-MM-DD
  etaTime: string; // HH:mm
  timezoneMode: 'UTC' | 'Local';
}

interface BriefingControlsProps {
  inputs: BriefingInputs;
  onChange: (inputs: BriefingInputs) => void;
  onSampleRouteSelect: (route: SampleRoute) => void;
  onGetBriefing: () => void;
  validationError: string | null;
}

export const BriefingControls: React.FC<BriefingControlsProps> = ({
  inputs,
  onChange,
  onSampleRouteSelect,
  validationError,
}) => {
  const handleIcaoChange = (field: keyof BriefingInputs, value: string) => {
    const cleaned = value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
    onChange({ ...inputs, [field]: cleaned });
  };

  return (
    <div className="bg-white rounded-2xl border border-[#e3e6ea] p-5 mb-5 shadow-xs">
      {/* Sample Routes Row */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-xs text-gray-500">Try a sample route</span>
        {SAMPLE_ROUTES.map((route) => {
          const isSelected =
            inputs.departure === route.departure &&
            inputs.destination === route.destination;
          return (
            <button
              key={route.name}
              type="button"
              onClick={() => onSampleRouteSelect(route)}
              className={`px-3 py-1 text-xs font-mono font-medium rounded-md transition-colors ${
                isSelected
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100'
              }`}
            >
              {route.name}
            </button>
          );
        })}
      </div>

      {/* 5 ICAO inputs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-4">
        {/* Departure */}
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">
            Departure <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={inputs.departure}
            maxLength={4}
            placeholder="HAAB"
            onChange={(e) => handleIcaoChange('departure', e.target.value)}
            className="w-full h-10 px-3 bg-white border border-gray-200 rounded-lg font-mono text-sm uppercase text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 tracking-wider text-center"
          />
        </div>

        {/* Take-off Alternate */}
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1 truncate">
            Take-off Alternate
          </label>
          <input
            type="text"
            value={inputs.takeoffAlt}
            maxLength={4}
            placeholder="HADR"
            onChange={(e) => handleIcaoChange('takeoffAlt', e.target.value)}
            className="w-full h-10 px-3 bg-white border border-gray-200 rounded-lg font-mono text-sm uppercase text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 tracking-wider text-center"
          />
        </div>

        {/* Enroute Alternate */}
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1 truncate">
            Enroute Alternate
          </label>
          <input
            type="text"
            value={inputs.enrouteAlt}
            maxLength={4}
            placeholder="HDAM"
            onChange={(e) => handleIcaoChange('enrouteAlt', e.target.value)}
            className="w-full h-10 px-3 bg-white border border-gray-200 rounded-lg font-mono text-sm uppercase text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 tracking-wider text-center"
          />
        </div>

        {/* Destination Alternate */}
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1 truncate">
            Destination Alternate
          </label>
          <input
            type="text"
            value={inputs.destAlt}
            maxLength={4}
            placeholder="HKMO"
            onChange={(e) => handleIcaoChange('destAlt', e.target.value)}
            className="w-full h-10 px-3 bg-white border border-gray-200 rounded-lg font-mono text-sm uppercase text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 tracking-wider text-center"
          />
        </div>

        {/* Destination */}
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">
            Destination <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={inputs.destination}
            maxLength={4}
            placeholder="HKJK"
            onChange={(e) => handleIcaoChange('destination', e.target.value)}
            className="w-full h-10 px-3 bg-white border border-gray-200 rounded-lg font-mono text-sm uppercase text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 tracking-wider text-center"
          />
        </div>
      </div>

      {/* Date, Time & Timezone controls */}
      <div className="flex flex-wrap items-end gap-3 pt-1">
        {/* ETD date */}
        <div className="flex-1 min-w-[130px]">
          <label className="block text-[11px] font-medium text-gray-500 mb-1">
            ETD date
          </label>
          <input
            type="date"
            value={inputs.etdDate}
            onChange={(e) => onChange({ ...inputs, etdDate: e.target.value })}
            className="w-full h-9 px-2.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-800 focus:outline-none focus:border-blue-600"
          />
        </div>

        {/* ETD time */}
        <div className="flex-1 min-w-[100px]">
          <label className="block text-[11px] font-medium text-gray-500 mb-1">
            ETD time
          </label>
          <input
            type="time"
            value={inputs.etdTime}
            onChange={(e) => onChange({ ...inputs, etdTime: e.target.value })}
            className="w-full h-9 px-2.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-800 font-mono focus:outline-none focus:border-blue-600 text-center"
          />
        </div>

        {/* ETA date */}
        <div className="flex-1 min-w-[130px]">
          <label className="block text-[11px] font-medium text-gray-500 mb-1">
            ETA date
          </label>
          <input
            type="date"
            value={inputs.etaDate}
            onChange={(e) => onChange({ ...inputs, etaDate: e.target.value })}
            className="w-full h-9 px-2.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-800 focus:outline-none focus:border-blue-600"
          />
        </div>

        {/* ETA time */}
        <div className="flex-1 min-w-[100px]">
          <label className="block text-[11px] font-medium text-gray-500 mb-1">
            ETA time
          </label>
          <input
            type="time"
            value={inputs.etaTime}
            onChange={(e) => onChange({ ...inputs, etaTime: e.target.value })}
            className="w-full h-9 px-2.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-800 font-mono focus:outline-none focus:border-blue-600 text-center"
          />
        </div>

        {/* UTC / Local toggle */}
        <div className="self-end pb-0.5">
          <div className="inline-flex h-9 rounded-lg bg-[#f1f3f5] p-0.5 border border-gray-200">
            <button
              type="button"
              onClick={() => onChange({ ...inputs, timezoneMode: 'UTC' })}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                inputs.timezoneMode === 'UTC'
                  ? 'bg-white text-gray-900 shadow-xs border border-gray-200'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              UTC
            </button>
            <button
              type="button"
              onClick={() => onChange({ ...inputs, timezoneMode: 'Local' })}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                inputs.timezoneMode === 'Local'
                  ? 'bg-white text-gray-900 shadow-xs border border-gray-200'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Local
            </button>
          </div>
        </div>
      </div>

      {/* Validation Message */}
      {validationError && (
        <div className="mt-3 p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
          {validationError}
        </div>
      )}
    </div>
  );
};
