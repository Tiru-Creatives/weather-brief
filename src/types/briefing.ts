export interface CloudLayer {
  cover: 'FEW' | 'SCT' | 'BKN' | 'OVC' | 'VV' | 'CLR' | 'SKC' | string;
  base?: number; // feet AGL
  type?: string; // CB, TCU
}

export interface MetarData {
  icaoId: string;
  obsTime?: string | number;
  reportTime?: string | number;
  receiptTime?: string;
  temp?: number; // Celsius
  dewp?: number; // Celsius
  wdir?: number; // Degrees
  wspd?: number; // Knots
  wgst?: number; // Knots
  visib?: string | number; // statute miles or km or string like "10+"
  altim?: number; // hPa
  clouds?: CloudLayer[];
  wxString?: string;
  rawOb?: string;
  name?: string;
  lat?: number;
  lon?: number;
  elev?: number;
}

export interface TafForecastGroup {
  timeGroup?: number;
  timeFrom: string | number;
  timeTo: string | number;
  timeBec?: string | number | null;
  fcstChange?: 'FM' | 'BECMG' | 'TEMPO' | 'PROB' | string | null;
  probability?: number | null;
  wdir?: number | null;
  wspd?: number | null;
  wgst?: number | null;
  visib?: string | number | null;
  wxString?: string | null;
  clouds?: CloudLayer[];
  notDecoded?: string | null;
}

export interface TafData {
  icaoId: string;
  issueTime?: string | number;
  bulletinTime?: string | number;
  validTimeFrom?: string | number;
  validTimeTo?: string | number;
  rawTAF?: string;
  name?: string;
  lat?: number;
  lon?: number;
  fcsts?: TafForecastGroup[];
}

export interface OpenMeteoHourly {
  time: string[];
  temperature_2m: number[];
  dew_point_2m: number[];
  relative_humidity_2m: number[];
  surface_pressure: number[];
  precipitation: number[];
}

export interface OpenMeteoData {
  hourly?: OpenMeteoHourly;
}

export type AerodromeRole =
  | 'DEPARTURE AERODROME'
  | 'TAKE-OFF ALTERNATE AERODROME'
  | 'ENROUTE ALTERNATE AERODROME'
  | 'DESTINATION ALTERNATE AERODROME'
  | 'DESTINATION AERODROME';

export interface AerodromeConfig {
  id: string;
  role: AerodromeRole;
  icao: string;
  timeBasis: 'ETD' | 'ETA';
  defaultWindowHours: number; // 1 for departure/alternates, 2 for destination
  isRequired: boolean;
}

export interface ColumnData {
  label: string;
  timeLabel: string;
  targetTime: Date;
  isBaseTime: boolean;
  minutesDiffFromMetar?: number;
  tempDewp: {
    text: string;
    isModel: boolean;
  };
  windGust: {
    text: string;
    isBelowLimit: boolean;
  };
  ceiling: {
    text: string;
    isBelowLimit: boolean;
  };
  visibility: {
    text: string;
    isBelowLimit: boolean;
  };
  cloudCover: {
    text: string;
  };
  humidity: {
    text: string;
    isModel: boolean;
  };
  rain: {
    text: string;
    isBelowLimit: boolean;
  };
  airPressure: {
    text: string;
    isModel: boolean;
  };
}
