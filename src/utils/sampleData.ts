export interface SampleRoute {
  name: string;
  departure: string;
  takeoffAlt: string;
  enrouteAlt: string;
  destAlt: string;
  destination: string;
  etdTime: string; // "09:00"
  etaTime: string; // "12:15"
}

export const SAMPLE_ROUTES: SampleRoute[] = [
  {
    name: 'HAAB → HKJK',
    departure: 'HAAB',
    takeoffAlt: 'HADR',
    enrouteAlt: 'HDAM',
    destAlt: 'HKMO',
    destination: 'HKJK',
    etdTime: '09:00',
    etaTime: '12:15',
  },
  {
    name: 'EGLL → LFPG',
    departure: 'EGLL',
    takeoffAlt: 'EGKK',
    enrouteAlt: 'LFQQ',
    destAlt: 'LFPO',
    destination: 'LFPG',
    etdTime: '10:30',
    etaTime: '11:45',
  },
];

export const AIRPORT_NAMES: Record<string, string> = {
  HAAB: 'Addis Ababa Bole Intl',
  HADR: 'Dire Dawa Intl',
  HDAM: 'Djibouti Ambouli Intl',
  HKMO: 'Mombasa Moi Intl',
  HKJK: 'Nairobi Jomo Kenyatta Intl',
  EGLL: 'London Heathrow Airport',
  EGKK: 'London Gatwick Airport',
  LFQQ: 'Lille Lesquin Airport',
  LFPO: 'Paris Orly Airport',
  LFPG: 'Paris Charles de Gaulle',
};

export const AIRPORT_COORDS: Record<string, { lat: number; lon: number }> = {
  HAAB: { lat: 8.9779, lon: 38.7993 },
  HADR: { lat: 9.6247, lon: 41.8542 },
  HDAM: { lat: 11.5473, lon: 43.1594 },
  HKMO: { lat: -4.0348, lon: 39.5942 },
  HKJK: { lat: -1.3192, lon: 36.9278 },
  EGLL: { lat: 51.4700, lon: -0.4543 },
  EGKK: { lat: 51.1537, lon: -0.1821 },
  LFQQ: { lat: 50.5619, lon: 3.0894 },
  LFPO: { lat: 48.7262, lon: 2.3652 },
  LFPG: { lat: 49.0097, lon: 2.5479 },
};
