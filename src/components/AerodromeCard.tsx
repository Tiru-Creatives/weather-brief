import React, { useState } from 'react';
import { AerodromeRole, MetarData, TafData, OpenMeteoData } from '../types/briefing';
import {
  buildColumnData,
  formatVisibility,
  formatPressure,
  decodeWeatherString,
  formatTimeToZ,
  parseTimeToMs,
} from '../utils/aviation';
import { ExternalLink, AlertTriangle, AlertCircle, Loader2 } from 'lucide-react';

interface AerodromeCardProps {
  role: AerodromeRole;
  icao: string;
  airportName: string;
  timeBasis: 'ETD' | 'ETA';
  baseTime: Date;
  defaultWindowHours: number;
  metar: MetarData | null;
  taf: TafData | null;
  modelForecast: OpenMeteoData | null;
  loading: boolean;
  error: string | null;
}

export const AerodromeCard: React.FC<AerodromeCardProps> = ({
  role,
  icao,
  airportName,
  timeBasis,
  baseTime,
  defaultWindowHours,
  metar,
  taf,
  modelForecast,
  loading,
  error,
}) => {
  const [windowHours, setWindowHours] = useState<number>(defaultWindowHours);
  const [viewMode, setViewMode] = useState<'raw' | 'decoded'>('raw');

  // Compute times for the 3 columns:
  // Col 1: baseTime - windowHours
  // Col 2: baseTime
  // Col 3: baseTime + windowHours
  const timeBefore = new Date(baseTime.getTime() - windowHours * 60 * 60 * 1000);
  const timeBase = new Date(baseTime.getTime());
  const timeLater = new Date(baseTime.getTime() + windowHours * 60 * 60 * 1000);

  const colBefore = buildColumnData(
    `${windowHours} hour before`,
    timeBefore,
    false,
    metar,
    taf,
    modelForecast
  );

  const colBase = buildColumnData(
    timeBasis,
    timeBase,
    true,
    metar,
    taf,
    modelForecast
  );

  const colLater = buildColumnData(
    `${windowHours} hour later`,
    timeLater,
    false,
    metar,
    taf,
    modelForecast
  );

  const columns = [colBefore, colBase, colLater];

  // Check if any condition is below limits
  const hasBelowLimit = columns.some(
    (col) =>
      col.windGust.isBelowLimit ||
      col.ceiling.isBelowLimit ||
      col.visibility.isBelowLimit ||
      col.rain.isBelowLimit
  );

  // Extract observation & issue times
  const metarObsTimeZ = metar
    ? formatTimeToZ(metar.obsTime || metar.reportTime || metar.receiptTime)
    : 'None';

  const tafIssueTimeZ = taf
    ? formatTimeToZ(taf.issueTime || taf.bulletinTime)
    : 'None';

  return (
    <div className="bg-white rounded-2xl border border-[#e3e6ea] p-6 mb-6 shadow-xs hover:border-gray-300 transition-colors print-card">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-100 gap-3">
        <div>
          <div className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
            {role}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xl font-bold font-mono tracking-tight text-gray-900">
              {icao}
            </span>
            <span className="text-sm font-normal text-gray-600">
              {airportName || metar?.name || `${icao} Airport`}
            </span>
            {hasBelowLimit && (
              <span className="inline-flex items-center gap-1 bg-[#fef3c7] text-[#92400e] text-xs font-medium px-2 py-0.5 rounded-md border border-[#fde68a]">
                <AlertTriangle className="w-3 h-3 text-[#b45309]" />
                Check conditions
              </span>
            )}
            {loading && (
              <span className="inline-flex items-center gap-1 text-xs text-blue-600 font-medium ml-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Updating...
              </span>
            )}
          </div>
        </div>

        {/* Window Selector */}
        <div className="flex items-center gap-2 self-start sm:self-center no-print">
          <span className="text-xs text-gray-500 font-medium">Window ±</span>
          <div className="inline-flex rounded-lg bg-[#f1f3f5] p-0.5 border border-gray-200">
            {[1, 2, 3].map((hours) => (
              <button
                key={hours}
                type="button"
                onClick={() => setWindowHours(hours)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                  windowHours === hours
                    ? 'bg-white text-gray-900 shadow-xs border border-gray-200'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {hours}h
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Upstream Error Message Banner */}
      {error && (
        <div className="py-2.5 px-3.5 my-3 bg-red-50 rounded-xl border border-red-200 text-red-700 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong>Weather Data Notice for {icao}:</strong> {error}
          </div>
        </div>
      )}

      {/* Main Weather Table */}
      <div className="overflow-x-auto mt-2">
        <table className="w-full text-left text-sm print-table border-collapse">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="py-3 pr-4 text-xs font-medium text-gray-400 w-1/4"></th>
              {columns.map((col, idx) => (
                <th key={idx} className="py-3 px-3 w-1/4 text-left">
                  <div className="text-[11px] font-medium text-gray-500 leading-tight">
                    {col.label}
                  </div>
                  <div
                    className={`text-sm font-mono tracking-tight ${
                      col.isBaseTime ? 'text-[#2563eb] font-bold' : 'text-gray-900 font-medium'
                    }`}
                  >
                    {col.timeLabel}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 text-[13px]">
            {/* Row: Temp / Dew P. */}
            <tr>
              <td className="py-2.5 pr-4 text-xs font-normal text-gray-500 whitespace-nowrap">
                Temp / Dew P.
              </td>
              {columns.map((col, idx) => (
                <td key={idx} className="py-2.5 px-3">
                  <span
                    className={`font-mono ${
                      col.tempDewp.isModel ? 'text-gray-500 italic' : 'text-gray-800'
                    }`}
                  >
                    {col.tempDewp.isModel && <span className="not-italic text-gray-400">○ </span>}
                    {col.tempDewp.text}
                  </span>
                </td>
              ))}
            </tr>

            {/* Row: Wind / Gust */}
            <tr>
              <td className="py-2.5 pr-4 text-xs font-normal text-gray-500 whitespace-nowrap">
                Wind / Gust
              </td>
              {columns.map((col, idx) => (
                <td key={idx} className="py-2.5 px-3">
                  <span
                    className={`font-mono ${
                      col.windGust.isBelowLimit
                        ? 'bg-[#fef3c7] text-[#92400e] px-1.5 py-0.5 rounded font-medium border border-[#fde68a]'
                        : 'text-gray-800'
                    }`}
                  >
                    {col.windGust.text}
                  </span>
                </td>
              ))}
            </tr>

            {/* Row: Ceiling */}
            <tr>
              <td className="py-2.5 pr-4 text-xs font-normal text-gray-500 whitespace-nowrap">
                Ceiling
              </td>
              {columns.map((col, idx) => (
                <td key={idx} className="py-2.5 px-3">
                  <span
                    className={`font-mono ${
                      col.ceiling.isBelowLimit
                        ? 'bg-[#fef3c7] text-[#92400e] px-1.5 py-0.5 rounded font-medium border border-[#fde68a]'
                        : 'text-gray-800'
                    }`}
                  >
                    {col.ceiling.text}
                  </span>
                </td>
              ))}
            </tr>

            {/* Row: Visibility */}
            <tr>
              <td className="py-2.5 pr-4 text-xs font-normal text-gray-500 whitespace-nowrap">
                Visibility
              </td>
              {columns.map((col, idx) => (
                <td key={idx} className="py-2.5 px-3">
                  <span
                    className={`font-mono ${
                      col.visibility.isBelowLimit
                        ? 'bg-[#fef3c7] text-[#92400e] px-1.5 py-0.5 rounded font-medium border border-[#fde68a]'
                        : 'text-gray-800'
                    }`}
                  >
                    {col.visibility.text}
                  </span>
                </td>
              ))}
            </tr>

            {/* Row: Cloud cover */}
            <tr>
              <td className="py-2.5 pr-4 text-xs font-normal text-gray-500 whitespace-nowrap">
                Cloud cover
              </td>
              {columns.map((col, idx) => (
                <td key={idx} className="py-2.5 px-3">
                  <span className="font-mono text-gray-800 text-xs">
                    {col.cloudCover.text}
                  </span>
                </td>
              ))}
            </tr>

            {/* Row: Humidity */}
            <tr>
              <td className="py-2.5 pr-4 text-xs font-normal text-gray-500 whitespace-nowrap">
                Humidity
              </td>
              {columns.map((col, idx) => (
                <td key={idx} className="py-2.5 px-3">
                  <span
                    className={`font-mono ${
                      col.humidity.isModel ? 'text-gray-500 italic' : 'text-gray-800'
                    }`}
                  >
                    {col.humidity.isModel && <span className="not-italic text-gray-400">○ </span>}
                    {col.humidity.text}
                  </span>
                </td>
              ))}
            </tr>

            {/* Row: Rain */}
            <tr>
              <td className="py-2.5 pr-4 text-xs font-normal text-gray-500 whitespace-nowrap">
                Rain
              </td>
              {columns.map((col, idx) => (
                <td key={idx} className="py-2.5 px-3">
                  <span
                    className={`${
                      col.rain.isBelowLimit
                        ? 'bg-[#fef3c7] text-[#92400e] px-1.5 py-0.5 rounded font-medium border border-[#fde68a]'
                        : 'text-gray-800'
                    }`}
                  >
                    {col.rain.text}
                  </span>
                </td>
              ))}
            </tr>

            {/* Row: Air pressure */}
            <tr>
              <td className="py-2.5 pr-4 text-xs font-normal text-gray-500 whitespace-nowrap">
                Air pressure
              </td>
              {columns.map((col, idx) => (
                <td key={idx} className="py-2.5 px-3">
                  <span
                    className={`font-mono text-xs ${
                      col.airPressure.isModel ? 'text-gray-500 italic' : 'text-gray-800'
                    }`}
                  >
                    {col.airPressure.isModel && <span className="not-italic text-gray-400">○ </span>}
                    {col.airPressure.text}
                  </span>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Card Footer: Raw / Decoded box */}
      <div className="mt-5 bg-[#f8fafc] border border-gray-100 rounded-xl p-4 print-card-footer">
        <div className="flex items-center justify-between pb-3 flex-wrap gap-2">
          {/* Raw / Decoded Segmented Button */}
          <div className="inline-flex rounded-lg bg-[#e2e8f0]/60 p-0.5 border border-gray-200/80 no-print">
            <button
              type="button"
              onClick={() => setViewMode('raw')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                viewMode === 'raw'
                  ? 'bg-white text-gray-900 shadow-xs border border-gray-200'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Raw
            </button>
            <button
              type="button"
              onClick={() => setViewMode('decoded')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                viewMode === 'decoded'
                  ? 'bg-white text-gray-900 shadow-xs border border-gray-200'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Decoded
            </button>
          </div>

          {/* FAA NOTAM link */}
          <a
            href="https://notams.aim.faa.gov/notamSearch/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors no-print"
          >
            Check NOTAMs on the official FAA site
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {viewMode === 'raw' ? (
          <div className="space-y-3">
            {/* METAR Raw */}
            <div>
              <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                METAR · observed {metarObsTimeZ}
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-2.5 font-mono text-xs text-gray-800 break-all leading-relaxed shadow-2xs select-all">
                {metar?.rawOb || 'No METAR reported'}
              </div>
            </div>

            {/* TAF Raw */}
            <div>
              <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                TAF · issued {tafIssueTimeZ}
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-2.5 font-mono text-xs text-gray-800 break-all leading-relaxed shadow-2xs select-all">
                {taf?.rawTAF || 'No TAF issued'}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-xs text-gray-700 bg-white border border-gray-200 rounded-lg p-3.5">
            <div>
              <h4 className="font-semibold text-gray-900 mb-1">METAR Decoded:</h4>
              <p>
                <strong>Station:</strong> {icao} ({airportName || metar?.name || 'N/A'})
              </p>
              <p>
                <strong>Observed:</strong> {metar?.obsTime ? new Date(parseTimeToMs(metar.obsTime)).toUTCString() : 'No METAR reported'}
              </p>
              <p>
                <strong>Wind:</strong> {metar?.wdir !== undefined && metar?.wdir !== null ? `${metar.wdir}°` : 'VRB'} at {metar?.wspd ?? 0} kt
                {metar?.wgst ? ` gusting to ${metar.wgst} kt` : ''}
              </p>
              <p>
                <strong>Visibility:</strong> {formatVisibility(metar?.visib).text}
              </p>
              <p>
                <strong>Clouds:</strong> {metar?.clouds?.length ? metar.clouds.map(c => `${c.cover} at ${c.base ?? 0} ft`).join(', ') : 'Clear'}
              </p>
              <p>
                <strong>Temperature / Dew Point:</strong> {metar?.temp ?? 'N/A'}°C / {metar?.dewp ?? 'N/A'}°C
              </p>
              <p>
                <strong>Altimeter:</strong> {metar?.altim ? formatPressure(metar.altim) : 'N/A'}
              </p>
            </div>

            <div className="pt-2 border-t border-gray-100">
              <h4 className="font-semibold text-gray-900 mb-1">TAF Decoded:</h4>
              <p>
                <strong>Issued:</strong> {taf?.issueTime ? new Date(parseTimeToMs(taf.issueTime)).toUTCString() : 'No TAF issued'}
              </p>
              {taf?.fcsts && taf.fcsts.length > 0 ? (
                <ul className="list-disc pl-4 space-y-1 mt-1">
                  {taf.fcsts.map((fc, i) => (
                    <li key={i}>
                      <span className="font-medium text-gray-800">
                        {fc.fcstChange ? `${fc.fcstChange} ` : ''}
                        {formatTimeToZ(fc.timeFrom)} - {formatTimeToZ(fc.timeTo)}:
                      </span>{' '}
                      Wind {fc.wdir !== undefined && fc.wdir !== null ? `${fc.wdir}°` : 'VRB'}/{fc.wspd ?? 0}kt
                      {fc.wgst ? ` G${fc.wgst}kt` : ''},
                      Vis {formatVisibility(fc.visib).text},
                      Clouds {fc.clouds?.map(c => `${c.cover}${c.base ? Math.round(c.base/100) : ''}`).join(' ') || 'None'}
                      {fc.wxString ? `, Wx: ${decodeWeatherString(fc.wxString).text}` : ''}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500 italic">No forecast periods available</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
