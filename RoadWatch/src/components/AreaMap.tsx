import React, { useEffect, useRef } from 'react';
import MapView, { Marker } from 'react-native-maps';
import type { Coordinates, RoadReport } from '../types';
export default function AreaMap({ reports, center, selected, onSelect }: { reports: RoadReport[]; center: Coordinates; selected?: string; onSelect: (r: RoadReport) => void }) {
  const map = useRef<MapView>(null);
  useEffect(() => { map.current?.animateToRegion({ ...center, latitudeDelta: 0.035, longitudeDelta: 0.035 }, 500); }, [center.latitude, center.longitude]);
  return <MapView ref={map} style={{ flex: 1 }} initialRegion={{ ...center, latitudeDelta: 0.035, longitudeDelta: 0.035 }} showsUserLocation={false}>
    {reports.map(r => <Marker key={r.id} coordinate={r.coordinates} title={r.title} description={r.address} pinColor={r.prediction.severity === 'High' ? '#B74529' : '#536139'} onPress={() => onSelect(r)} opacity={selected && selected !== r.id ? 0.5 : 1} />)}
  </MapView>;
}
