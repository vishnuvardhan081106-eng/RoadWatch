import React from 'react';
import type { Coordinates, RoadReport } from '../types';
export default function AreaMap({ center }: { reports: RoadReport[]; center: Coordinates; selected?: string; onSelect: (r: RoadReport) => void }) {
  const { latitude: lat, longitude: lon } = center;
  const bounds = `${lon - 0.018},${lat - 0.014},${lon + 0.018},${lat + 0.014}`;
  return React.createElement('iframe', { title: 'Road report location on OpenStreetMap', src: `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bounds)}&layer=mapnik&marker=${lat}%2C${lon}`, style: { width: '100%', height: '100%', border: 0 }, loading: 'lazy' });
}
