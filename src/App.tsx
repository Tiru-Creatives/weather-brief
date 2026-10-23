import { useState, useEffect, useCallback } from 'react';
import { BriefingControls, BriefingInputs } from './components/BriefingControls';
import { AerodromeCard } from './components/AerodromeCard';
import { AerodromeConfig, MetarData, TafData, OpenMeteoData } from './types/briefing';
import { AIRPORT_NAMES, AIRPORT_COORDS, SampleRoute } from './utils/sampleData';
import { Printer, RefreshCw } from 'lucide-react';

const STORAGE_KEY = 'flight_wx_briefing_inputs_v1';

export default function App() {
  const today = new Date();
  const dateStr = today.toISOString().substring(0, 10);

  const [inputs, setInputs] = useState<BriefingInputs>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    return {
      departure: 'HAAB',
      takeoffAlt: 'HADR',
      enrouteAlt: 'HDAM',
      destAlt: 'HKMO',
      destination: 'HKJK',
      etdDate: dateStr,
      etdTime: '09:00',
      etaDate: dateStr,
      etaTime: '12:15',
      timezoneMode: 'UTC',
    };
  });

  const [validationError, setValidationError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string>('06:00Z');
  const [isLiveSource, setIsLiveSource] = useState<boolean>(false);

  // Weather data maps keyed by ICAO
  const [metarMap, setMetarMap] = useState<Record<string, MetarData>>({});
  const [tafMap, setTafMap] = useState<Record<string, TafData>>({});
  const [forecastMap, setForecastMap] = useState<Record<string, OpenMeteoData>>({});
  const [errorMap, setErrorMap] = useState<Record<string, string>>({});

  // Save to localStorage whenever inputs change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs));
  }, [inputs]);

  // Convert inputs into base ETD / ETA Date objects (in UTC)
  const getEtdEtaDates = useCallback(() => {
    const etdDateParts = (inputs.etdDate || dateStr).split('-');
    const [etdYear, etdMonth, etdDay] = etdDateParts.map(Number);
    const [etdHour, etdMinute] = (inputs.etdTime || '09:00').split(':').map(Number);

    const etaDateParts = (inputs.etaDate || dateStr).split('-');
    const [etaYear, etaMonth, etaDay] = etaDateParts.map(Number);
    const [etaHour, etaMinute] = (inputs.etaTime || '12:15').split(':').map(Number);

    let etdDate: Date;
    let etaDate: Date;

    if (inputs.timezoneMode === 'UTC') {
      etdDate = new Date(Date.UTC(etdYear, (etdMonth || 1) - 1, etdDay || 1, etdHour || 0, etdMinute || 0));
      etaDate = new Date(Date.UTC(etaYear, (etaMonth || 1) - 1, etaDay || 1, etaHour || 0, etaMinute || 0));
    } else {
      etdDate = new Date(etdYear, (etdMonth || 1) - 1, etdDay || 1, etdHour || 0, etdMinute || 0);
      etaDate = new Date(etaYear, (etaMonth || 1) - 1, etaDay || 1, etaHour || 0, etaMinute || 0);
    }

    return { etdDate, etaDate };
  }, [inputs, dateStr]);

  // Validate inputs
  const validate = (): boolean => {
    if (!inputs.departure || inputs.departure.length !== 4) {
      setValidationError('Departure ICAO must be a 4-letter code.');
      return false;
    }
    if (!inputs.destination || inputs.destination.length !== 4) {
      setValidationError('Destination ICAO must be a 4-letter code.');
      return false;
    }
    if (inputs.takeoffAlt && inputs.takeoffAlt.length !== 4) {
      setValidationError('Take-off Alternate must be 4 letters if provided.');
      return false;
    }
    if (inputs.enrouteAlt && inputs.enrouteAlt.length !== 4) {
      setValidationError('Enroute Alternate must be 4 letters if provided.');
      return false;
    }
    if (inputs.destAlt && inputs.destAlt.length !== 4) {
      setValidationError('Destination Alternate must be 4 letters if provided.');
      return false;
    }

    const { etdDate, etaDate } = getEtdEtaDates();
    if (etaDate.getTime() <= etdDate.getTime()) {
      setValidationError('ETA must be later than ETD.');
      return false;
    }

    setValidationError(null);
    return true;
  };

  // Fetch weather data for unique ICAOs
  const fetchWeatherData = async () => {
    if (!validate()) return;

    setLoading(true);
    const uniqueIcaos = Array.from(
      new Set(
        [
          inputs.departure,
          inputs.takeoffAlt,
          inputs.enrouteAlt,
          inputs.destAlt,
          inputs.destination,
        ]
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean)
      )
    );

    const newMetarMap: Record<string, MetarData> = {};
    const newTafMap: Record<string, TafData> = {};
    const newForecastMap: Record<string, OpenMeteoData> = {};
    const newErrorMap: Record<string, string> = {};

    try {
      // 1. Fetch METARs in batch
      try {
        const metarRes = await fetch(`/api/metar?ids=${uniqueIcaos.join(',')}`);
        if (metarRes.ok) {
          const json = await metarRes.json();
          if (json.data && Array.isArray(json.data)) {
            for (const item of json.data) {
              if (item.icaoId) {
                newMetarMap[item.icaoId.toUpperCase()] = item;
              }
            }
          }
          if (json.fetchedAtUtc) {
            const d = new Date(json.fetchedAtUtc);
            setLastUpdated(`${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}Z`);
            setIsLiveSource(true);
          }
        } else {
          const errJson = await metarRes.json().catch(() => ({}));
          const errMsg = errJson.error || `METAR fetch error (HTTP ${metarRes.status})`;
          for (const icao of uniqueIcaos) {
            newErrorMap[icao] = (newErrorMap[icao] ? newErrorMap[icao] + ' · ' : '') + errMsg;
          }
        }
      } catch (e: any) {
        for (const icao of uniqueIcaos) {
          newErrorMap[icao] = (newErrorMap[icao] ? newErrorMap[icao] + ' · ' : '') + `METAR request error: ${e.message || 'connection failed'}`;
        }
      }

      // Check which stations had no METAR returned
      for (const icao of uniqueIcaos) {
        if (!newMetarMap[icao] && !newErrorMap[icao]) {
          newErrorMap[icao] = 'No current METAR reported by NOAA AWC for this station';
        }
      }

      // 2. Fetch TAFs in batch
      try {
        const tafRes = await fetch(`/api/taf?ids=${uniqueIcaos.join(',')}`);
        if (tafRes.ok) {
          const json = await tafRes.json();
          if (json.data && Array.isArray(json.data)) {
            for (const item of json.data) {
              if (item.icaoId) {
                newTafMap[item.icaoId.toUpperCase()] = item;
              }
            }
          }
        } else {
          const errJson = await tafRes.json().catch(() => ({}));
          const errMsg = errJson.error || `TAF fetch error (HTTP ${tafRes.status})`;
          for (const icao of uniqueIcaos) {
            newErrorMap[icao] = (newErrorMap[icao] ? newErrorMap[icao] + ' · ' : '') + errMsg;
          }
        }
      } catch (e: any) {
        for (const icao of uniqueIcaos) {
          newErrorMap[icao] = (newErrorMap[icao] ? newErrorMap[icao] + ' · ' : '') + `TAF request error: ${e.message || 'connection failed'}`;
        }
      }

      // 3. For each unique ICAO, fetch Open-Meteo model forecast using coordinates
      await Promise.all(
        uniqueIcaos.map(async (icao) => {
          try {
            const metar = newMetarMap[icao];
            const coords = AIRPORT_COORDS[icao];
            const lat = metar?.lat || coords?.lat;
            const lon = metar?.lon || coords?.lon;

            if (lat !== undefined && lon !== undefined) {
              const forecastRes = await fetch(`/api/forecast?lat=${lat}&lon=${lon}`);
              if (forecastRes.ok) {
                const fJson = await forecastRes.json();
                newForecastMap[icao] = fJson.data;
              } else {
                const errJson = await forecastRes.json().catch(() => ({}));
                console.warn(`Forecast failed for ${icao}:`, errJson);
              }
            }
          } catch (e) {
            console.warn(`Forecast fetch error for ${icao}:`, e);
          }
        })
      );

      setMetarMap(newMetarMap);
      setTafMap(newTafMap);
      setForecastMap(newForecastMap);
      setErrorMap(newErrorMap);
    } catch (globalErr: any) {
      console.error('Fatal briefing error:', globalErr);
      for (const icao of uniqueIcaos) {
        newErrorMap[icao] = `Briefing loading error: ${globalErr.message || String(globalErr)}`;
      }
      setErrorMap(newErrorMap);
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchWeatherData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSampleRouteSelect = (route: SampleRoute) => {
    setInputs((prev) => ({
      ...prev,
      departure: route.departure,
      takeoffAlt: route.takeoffAlt,
      enrouteAlt: route.enrouteAlt,
      destAlt: route.destAlt,
      destination: route.destination,
      etdTime: route.etdTime,
      etaTime: route.etaTime,
    }));
    setValidationError(null);
  };

  const handlePrint = () => {
    window.print();
  };

  const { etdDate, etaDate } = getEtdEtaDates();

  const aerodromes: AerodromeConfig[] = [
    {
      id: 'dep',
      role: 'DEPARTURE AERODROME',
      icao: inputs.departure.trim().toUpperCase(),
      timeBasis: 'ETD',
      defaultWindowHours: 1,
      isRequired: true,
    },
    {
      id: 'tkoff-alt',
      role: 'TAKE-OFF ALTERNATE AERODROME',
      icao: inputs.takeoffAlt.trim().toUpperCase(),
      timeBasis: 'ETD',
      defaultWindowHours: 1,
      isRequired: false,
    },
    {
      id: 'enroute-alt',
      role: 'ENROUTE ALTERNATE AERODROME',
      icao: inputs.enrouteAlt.trim().toUpperCase(),
      timeBasis: 'ETA',
      defaultWindowHours: 1,
      isRequired: false,
    },
    {
      id: 'dest-alt',
      role: 'DESTINATION ALTERNATE AERODROME',
      icao: inputs.destAlt.trim().toUpperCase(),
      timeBasis: 'ETA',
      defaultWindowHours: 1,
      isRequired: false,
    },
    {
      id: 'dest',
      role: 'DESTINATION AERODROME',
      icao: inputs.destination.trim().toUpperCase(),
      timeBasis: 'ETA',
      defaultWindowHours: 2,
      isRequired: true,
    },
  ];

  return (
    <div className="min-h-screen bg-[#fafbfc] text-[#1f2328] font-sans antialiased pb-16">
      <div className="max-w-[1080px] mx-auto px-4 sm:px-6 pt-8">
        {/* Top Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 gap-4 border-b border-gray-100 mb-6">
          <div>
            <div className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
              Flight Planning · Weather
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 mt-0.5">
              Flight Weather Briefing
            </h1>
          </div>

          <div className="flex items-center gap-3 no-print">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-800 text-sm font-medium rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4 text-gray-500" />
              Print form
            </button>
            <button
              type="button"
              onClick={fetchWeatherData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#2563eb] hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer disabled:opacity-75"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Get briefing
            </button>
          </div>
        </header>

        {/* Inputs Card */}
        <div className="no-print">
          <BriefingControls
            inputs={inputs}
            onChange={setInputs}
            onSampleRouteSelect={handleSampleRouteSelect}
            onGetBriefing={fetchWeatherData}
            validationError={validationError}
          />
        </div>

        {/* Legend Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-gray-500 mb-5 px-1 gap-2">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-gray-900 inline-block"></span>
              Official METAR / TAF (NOAA AWC)
            </span>
            <span className="inline-flex items-center gap-1.5 text-gray-500 italic">
              <span className="not-italic text-gray-400">○</span>
              Model forecast (Open-Meteo), not official
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-xs bg-[#fef3c7] border border-[#fde68a] inline-block"></span>
              Below common limits
            </span>
          </div>
          <div className="text-gray-400 font-mono text-[11px] self-start sm:self-auto">
            {isLiveSource ? 'Live data' : 'Sample data'} · updated {lastUpdated}
          </div>
        </div>

        {/* Aerodrome Blocks List */}
        <main className="space-y-6">
          {aerodromes.map((aero) => {
            if (!aero.isRequired && !aero.icao) {
              return null;
            }

            const baseTime = aero.timeBasis === 'ETD' ? etdDate : etaDate;
            const airportName = AIRPORT_NAMES[aero.icao] || '';

            return (
              <AerodromeCard
                key={aero.id}
                role={aero.role}
                icao={aero.icao}
                airportName={airportName}
                timeBasis={aero.timeBasis}
                baseTime={baseTime}
                defaultWindowHours={aero.defaultWindowHours}
                metar={metarMap[aero.icao] || null}
                taf={tafMap[aero.icao] || null}
                modelForecast={forecastMap[aero.icao] || null}
                loading={loading}
                error={errorMap[aero.icao] || null}
              />
            );
          })}
        </main>

        {/* Bottom Disclaimer */}
        <footer className="mt-12 pt-6 border-t border-gray-200 text-[11px] text-gray-500 leading-relaxed">
          Sources: NOAA Aviation Weather Center (METAR, TAF) · Open-Meteo (model values where a TAF has none). For training and situational awareness only. Not an official briefing. Always verify with your official AIS/MET service before flight.
        </footer>
      </div>
    </div>
  );
}
