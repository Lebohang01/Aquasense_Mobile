// app/components/NodesMap.js
// Feature 5: Campus Node Map — dashboard widget
import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
import { supabase } from '@/lib/supabase';
import { C, STATUS } from '@/lib/theme';

const STATUS_COLOR = {
  SAFE: STATUS.SAFE.color, CAUTION: STATUS.CAUTION.color, UNSAFE: STATUS.UNSAFE.color, UNKNOWN: C.text2,
};

// Rough center over UJ's campuses — adjust if your nodes cluster elsewhere
const INITIAL_REGION = {
  latitude: -26.19,
  longitude: 27.99,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

async function fetchNodesWithStatus() {
  const { data: nodes } = await supabase.from('nodes').select('*');
  if (!nodes) return [];

  // Get each node's most recent reading to color the pin
  const withStatus = await Promise.all(
    nodes.map(async (node) => {
      const { data: latest } = await supabase
        .from('readings')
        .select('sans_status, created_at')
        .eq('node_id', node.node_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      return { ...node, latestStatus: latest?.sans_status || 'UNKNOWN' };
    })
  );

  return withStatus;
}

export default function NodesMap() {
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchNodesWithStatus();
      setNodes(data);
    } catch {
      setNodes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const fitToMarkers = () => {
    const valid = nodes.filter(n => n.latitude && n.longitude);
    if (valid.length > 0 && mapRef.current) {
      mapRef.current.fitToCoordinates(
        valid.map(n => ({ latitude: n.latitude, longitude: n.longitude })),
        { edgePadding: { top: 60, right: 60, bottom: 60, left: 60 }, animated: true }
      );
    }
  };

  if (loading) {
    return (
      <View style={s.card}>
        <View style={s.loadingRow}>
          <ActivityIndicator size="small" color={C.blue} />
          <Text style={s.loadingTxt}>Loading node locations...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={s.card}>
      <View style={s.header}>
        <Text style={s.title}>Campus Node Map</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity onPress={fitToMarkers} style={s.iconBtn}>
            <Text style={s.iconTxt}>🎯</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={load} style={s.iconBtn}>
            <Text style={s.iconTxt}>🔄</Text>
          </TouchableOpacity>
        </View>
      </View>

      <MapView
        ref={mapRef}
        style={s.map}
        initialRegion={INITIAL_REGION}
        userInterfaceStyle="light"
        onLayout={fitToMarkers}
      >
        {nodes
          .filter(n => n.latitude && n.longitude)
          .map(node => (
            <Marker
              key={node.node_id}
              coordinate={{ latitude: node.latitude, longitude: node.longitude }}
              pinColor={STATUS_COLOR[node.latestStatus] || STATUS_COLOR.UNKNOWN}
            >
              <Callout tooltip>
                <View style={s.callout}>
                  <Text style={s.calloutTitle}>{node.location_name}</Text>
                  <Text style={s.calloutCampus}>{node.campus}</Text>
                  <View style={[s.calloutBadge, { backgroundColor: (STATUS_COLOR[node.latestStatus] || C.text2) + '22' }]}>
                    <Text style={[s.calloutStatus, { color: STATUS_COLOR[node.latestStatus] || C.text2 }]}>
                      {node.latestStatus}
                    </Text>
                  </View>
                </View>
              </Callout>
            </Marker>
          ))}
      </MapView>

      {/* Legend */}
      <View style={s.legend}>
        {Object.entries({ SAFE: 'Safe', CAUTION: 'Caution', UNSAFE: 'Unsafe' }).map(([key, label]) => (
          <View key={key} style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: STATUS_COLOR[key] }]} />
            <Text style={s.legendTxt}>{label}</Text>
          </View>
        ))}
        <Text style={s.legendCount}>{nodes.length} node{nodes.length !== 1 ? 's' : ''}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card:        { backgroundColor: C.bg2, borderRadius: 14, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  loadingRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16 },
  loadingTxt:  { fontSize: 13, color: C.text1 },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  title:       { fontSize: 11, fontWeight: '700', color: C.text2, textTransform: 'uppercase', letterSpacing: 0.5 },
  iconBtn:     { padding: 2 },
  iconTxt:     { fontSize: 16 },
  map:         { width: '100%', height: 260 },
  callout:     { backgroundColor: C.bg2, borderRadius: 10, padding: 10, minWidth: 150, borderWidth: 1, borderColor: C.border },
  calloutTitle:{ fontSize: 13, fontWeight: '700', color: C.text0 },
  calloutCampus:{ fontSize: 11, color: C.text1, marginTop: 2, marginBottom: 6 },
  calloutBadge:{ alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  calloutStatus:{ fontSize: 10, fontWeight: '700' },
  legend:      { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: C.bg1 },
  legendItem:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:   { width: 8, height: 8, borderRadius: 4 },
  legendTxt:   { fontSize: 10, color: C.text1 },
  legendCount: { fontSize: 10, color: C.text2, marginLeft: 'auto' },
});
