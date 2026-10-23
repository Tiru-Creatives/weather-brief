import { CloudLayer, MetarData, TafData, TafForecastGroup, OpenMeteoData, ColumnData } from '../types/briefing';

/**
 * Parses timestamp which can be epoch seconds (e.g. 1792725608), epoch ms, or ISO string.
 */
export function parseTimeToMs(val: string | number | undefined | null): number {
  if (val === undefined || val === null || val === '') return Date.now();
  if (typeof val === 'number') {
    return val < 1e11 ? val * 1000 : val;
  }
  const parsedNum = Number(val);
  if (!isNaN(parsedNum) && parsedNum > 100000000) {
    return parsedNum < 1e11 ? parsedNum * 1000 : parsedNum;
  }
  const d = new Date(val).getTime();
  return isNaN(d) ? Date.now() : d;
}

/**
 * Formats date/timestamp to UTC HHMMZ (e.g. 0900Z)
 */
export function formatTimeToZ(val: string | number | Date | undefined | null): string {
  if (!val) return '0000Z';
  const ms = val instanceof Date ? val.getTime() : parseTimeToMs(val);
  const d = new Date(ms);
  const h = String(d.getUTCHours()).padStart(2, '0');
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  return `${h}${m}Z`;
}

/**
 * Calculates relative humidity (%) using the Magnus formula from temperature and dewpoint in Celsius.
 */
export function calculateRelativeHumidity(tempC: number, dewpointC: number): number {
  if (tempC === undefined || dewpointC === undefined || isNaN(tempC) || isNaN(dewpointC)) {
    return 0;
  }
  const a = 17.625;
  const b = 243.04;
  const alphaTd = (a * dewpointC) / (b + dewpointC);
  const alphaT = (a * tempC) / (b + tempC);
  const rh = 100 * Math.exp(alphaTd - alphaT);
  return Math.min(100, Math.max(0, Math.round(rh)));
}

/**
 * Converts hPa to inHg and formats as "1018 hPa · 30.05 inHg"
 */
export function formatPressure(hPa: number): string {
  if (!hPa || isNaN(hPa)) return 'N/A';
  const inHg = (hPa * 0.0295299830714).toFixed(2);
  return `${Math.round(hPa)} hPa · ${inHg} inHg`;
}

/**
 * Computes ceiling in feet AGL: lowest BKN or OVC base.
 */
export function getCeiling(clouds?: CloudLayer[]): { text: string; isBelowLimit: boolean } {
  if (!clouds || clouds.length === 0) {
    return { text: 'No ceiling', isBelowLimit: false };
  }

  const ceilingLayers = clouds.filter(
    (c) =>
      (c.cover === 'BKN' || c.cover === 'OVC' || c.cover === 'VV') &&
      typeof c.base === 'number' &&
      !isNaN(c.base)
  );

  if (ceilingLayers.length === 0) {
    return { text: 'No ceiling', isBelowLimit: false };
  }

  const lowest = Math.min(...ceilingLayers.map((c) => c.base!));
  const isBelowLimit = lowest < 1500;
  return { text: `${lowest} ft`, isBelowLimit };
}

/**
 * Formats cloud layer list, e.g. "FEW030 SCT120"
 */
export function formatClouds(clouds?: CloudLayer[]): string {
  if (!clouds || clouds.length === 0) {
    return 'SKC';
  }
  return clouds
    .map((c) => {
      if (c.base !== undefined && c.base !== null) {
        const flightLevel = String(Math.round(c.base / 100)).padStart(3, '0');
        return `${c.cover}${flightLevel}${c.type ? c.type : ''}`;
      }
      return c.cover;
    })
    .join(' ');
}

/**
 * Decodes present weather string to human readable form and checks thunderstorm limit.
 */
export function decodeWeatherString(wx?: string | null): { text: string; isBelowLimit: boolean } {
  if (!wx || !wx.trim() || wx === 'NSW') {
    return { text: 'None reported', isBelowLimit: false };
  }

  const clean = wx.trim().toUpperCase();
  const isThunderstorm = clean.includes('TS');

  const replacements: [RegExp, string][] = [
    [/\+TSRA/g, 'Heavy thunderstorm with rain (+TSRA)'],
    [/-TSRA/g, 'Light thunderstorm with rain (-TSRA)'],
    [/TSRA/g, 'Thunderstorm with rain (TSRA)'],
    [/VCTS/g, 'Thunderstorm in vicinity (VCTS)'],
    [/TS/g, 'Thunderstorm (TS)'],
    [/\+SHRA/g, 'Heavy rain showers (+SHRA)'],
    [/-SHRA/g, 'Light rain showers (-SHRA)'],
    [/SHRA/g, 'Rain showers (SHRA)'],
    [/\+RA/g, 'Heavy rain (+RA)'],
    [/-RA/g, 'Light rain (-RA)'],
    [/RA/g, 'Moderate rain (RA)'],
    [/\+DZ/g, 'Heavy drizzle (+DZ)'],
    [/-DZ/g, 'Light drizzle (-DZ)'],
    [/DZ/g, 'Drizzle (DZ)'],
    [/\+SN/g, 'Heavy snow (+SN)'],
    [/-SN/g, 'Light snow (-SN)'],
    [/SN/g, 'Snow (SN)'],
    [/FG/g, 'Fog (FG)'],
    [/BR/g, 'Mist (BR)'],
    [/HZ/g, 'Haze (HZ)'],
  ];

  let decoded = clean;
  for (const [regex, rep] of replacements) {
    if (regex.test(clean)) {
      decoded = rep;
      break;
    }
  }

  return {
    text: decoded,
    isBelowLimit: isThunderstorm,
  };
}

/**
 * Format visibility and check limit (< 5 km or < 3 SM)
 */
export function formatVisibility(visib: string | number | undefined | null): { text: string; isBelowLimit: boolean } {
  if (visib === undefined || visib === null || visib === '') {
    return { text: 'N/A', isBelowLimit: false };
  }

  const str = String(visib).trim();

  if (str.includes('km')) {
    const num = parseFloat(str);
    const isBelow = !isNaN(num) && num < 5.0 && !str.includes('+');
    return { text: str, isBelowLimit: isBelow };
  }

  if (str === '10+' || str === '9999' || str === '6+' || str === '10') {
    return { text: '10 km+', isBelowLimit: false };
  }

  const num = parseFloat(str);
  if (isNaN(num)) {
    return { text: str, isBelowLimit: false };
  }

  // If number is large (> 50), it is meters (e.g. 3500 -> 3.5 km, 7000 -> 7.0 km)
  if (num > 50) {
    const km = (num / 1000).toFixed(1);
    const isBelowLimit = num < 5000;
    return { text: `${km} km`, isBelowLimit };
  }

  // Else it is in statute miles or km
  const kmVal = (num * 1.60934).toFixed(1);
  const isBelowLimit = num < 3.0 || parseFloat(kmVal) < 5.0;
  return { text: `${kmVal} km`, isBelowLimit };
}

/**
 * Formats wind and gust, checks gust > 25 kt
 */
export function formatWind(
  wdir?: number | null,
  wspd?: number | null,
  wgst?: number | null
): { text: string; isBelowLimit: boolean } {
  if (wspd === undefined || wspd === null) {
    return { text: 'N/A', isBelowLimit: false };
  }

  const dirStr = wdir !== undefined && wdir !== null ? `${String(wdir).padStart(3, '0')}°` : 'VRB';
  const speedStr = `${wspd} kt`;
  const gustStr = wgst && wgst > 0 ? ` G${wgst}` : '';
  const isBelowLimit = Boolean(wgst && wgst > 25);

  return {
    text: `${dirStr} / ${speedStr}${gustStr}`,
    isBelowLimit,
  };
}

/**
 * Finds applicable Open-Meteo hourly model forecast for target time
 */
export function getModelForecastForTime(modelData: OpenMeteoData | null | undefined, targetTime: Date) {
  if (!modelData?.hourly || !modelData.hourly.time?.length) {
    return null;
  }

  const times = modelData.hourly.time;
  let bestIdx = 0;
  let minDiff = Infinity;
  const targetMs = targetTime.getTime();

  for (let i = 0; i < times.length; i++) {
    const tMs = parseTimeToMs(times[i]);
    const diff = Math.abs(tMs - targetMs);
    if (diff < minDiff) {
      minDiff = diff;
      bestIdx = i;
    }
  }

  const h = modelData.hourly;
  return {
    temp: Math.round(h.temperature_2m[bestIdx] ?? 18),
    dewp: Math.round(h.dew_point_2m[bestIdx] ?? 9),
    humidity: Math.round(h.relative_humidity_2m[bestIdx] ?? 50),
    pressure: Math.round(h.surface_pressure[bestIdx] ?? 1016),
    precip: h.precipitation[bestIdx] ?? 0,
  };
}

/**
 * Finds applicable TAF forecast group for target time
 */
export function findTafGroupForTime(taf: TafData | null | undefined, targetTime: Date): TafForecastGroup | null {
  if (!taf?.fcsts || taf.fcsts.length === 0) return null;

  const targetMs = targetTime.getTime();

  const validGroups = taf.fcsts.filter((g) => {
    const fromMs = parseTimeToMs(g.timeFrom);
    const toMs = parseTimeToMs(g.timeTo);
    return targetMs >= fromMs && targetMs <= toMs;
  });

  if (validGroups.length === 0) {
    return taf.fcsts[0] || null;
  }

  const tempo = validGroups.find((g) => g.fcstChange === 'TEMPO' || g.fcstChange === 'PROB');
  if (tempo) return tempo;

  const becmg = validGroups.find((g) => g.fcstChange === 'BECMG');
  if (becmg) return becmg;

  return validGroups[validGroups.length - 1];
}

/**
 * Builds column data for a given target time, METAR, TAF, and Model forecast
 */
export function buildColumnData(
  label: string,
  targetTime: Date,
  isBaseTime: boolean,
  metar: MetarData | null,
  taf: TafData | null,
  modelData: OpenMeteoData | null
): ColumnData {
  const now = new Date();
  const targetMs = targetTime.getTime();
  const isPastOrNow = targetMs <= now.getTime() + 20 * 60 * 1000;
  const timeLabel = formatTimeToZ(targetTime);

  if (isPastOrNow && metar) {
    const obsTimeMs = parseTimeToMs(metar.obsTime || metar.reportTime || metar.receiptTime);
    const minutesDiffFromMetar = Math.round(Math.abs(targetMs - obsTimeMs) / 60000);

    const temp = metar.temp !== undefined && metar.temp !== null ? `${metar.temp}°` : 'N/A';
    const dewp = metar.dewp !== undefined && metar.dewp !== null ? `${metar.dewp}°` : 'N/A';
    const tempDewpText = (temp !== 'N/A' || dewp !== 'N/A') ? `${temp} / ${dewp}` : 'N/A';

    const humidityVal = (metar.temp !== undefined && metar.dewp !== undefined)
      ? `${calculateRelativeHumidity(metar.temp, metar.dewp)} %`
      : 'N/A';

    const wind = formatWind(metar.wdir, metar.wspd, metar.wgst);
    const ceiling = getCeiling(metar.clouds);
    const visib = formatVisibility(metar.visib);
    const cloudCover = formatClouds(metar.clouds);
    const rain = decodeWeatherString(metar.wxString);
    const pressure = metar.altim ? formatPressure(metar.altim) : 'N/A';

    return {
      label,
      timeLabel,
      targetTime,
      isBaseTime,
      minutesDiffFromMetar,
      tempDewp: { text: tempDewpText, isModel: false },
      windGust: wind,
      ceiling,
      visibility: visib,
      cloudCover: { text: cloudCover },
      humidity: { text: humidityVal, isModel: false },
      rain,
      airPressure: { text: pressure, isModel: false },
    };
  }

  // Future column or missing METAR
  const tafGroup = findTafGroupForTime(taf, targetTime);
  const model = getModelForecastForTime(modelData, targetTime);

  let mTempText = 'N/A';
  let isTempModel = false;
  if (model) {
    mTempText = `${model.temp}° / ${model.dewp}°`;
    isTempModel = true;
  } else if (metar?.temp !== undefined && metar?.dewp !== undefined) {
    mTempText = `${metar.temp}° / ${metar.dewp}°`;
  }

  let mHumText = 'N/A';
  let isHumModel = false;
  if (model) {
    mHumText = `${model.humidity} %`;
    isHumModel = true;
  } else if (metar?.temp !== undefined && metar?.dewp !== undefined) {
    mHumText = `${calculateRelativeHumidity(metar.temp, metar.dewp)} %`;
  }

  let mPressText = 'N/A';
  let isPressModel = false;
  if (model) {
    mPressText = formatPressure(model.pressure);
    isPressModel = true;
  } else if (metar?.altim) {
    mPressText = formatPressure(metar.altim);
  }

  const wdir = tafGroup?.wdir ?? metar?.wdir;
  const wspd = tafGroup?.wspd ?? metar?.wspd;
  const wgst = tafGroup?.wgst ?? metar?.wgst;
  const wind = formatWind(wdir, wspd, wgst);

  const clouds = (tafGroup?.clouds && tafGroup.clouds.length > 0) ? tafGroup.clouds : metar?.clouds;
  const ceiling = clouds ? getCeiling(clouds) : { text: 'N/A', isBelowLimit: false };
  const cloudCover = clouds ? formatClouds(clouds) : 'N/A';

  const visibRaw = tafGroup?.visib ?? metar?.visib;
  const visibility = visibRaw !== undefined && visibRaw !== null
    ? formatVisibility(visibRaw)
    : { text: 'N/A', isBelowLimit: false };

  const wx = tafGroup?.wxString ?? (model && model.precip > 0.5 ? '-RA' : metar?.wxString);
  const rain = decodeWeatherString(wx);

  return {
    label,
    timeLabel,
    targetTime,
    isBaseTime,
    tempDewp: { text: mTempText, isModel: isTempModel },
    windGust: wind,
    ceiling,
    visibility,
    cloudCover: { text: cloudCover },
    humidity: { text: mHumText, isModel: isHumModel },
    rain,
    airPressure: { text: mPressText, isModel: isPressModel },
  };
}
