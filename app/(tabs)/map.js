// app/app/(tabs)/map.js
import { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Callout } from 'react-native-maps';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { evaluateReading, CAMPUS_LABELS } from '@/utils/sans241';

const C = {
  bg0:'#0a0e1a', bg1:'#0f1525', bg2:'#151c30',
  blue:'#3b82f6', blueLight:'#60a5fa',
  green:'#22c55e', red:'#ef4444', amber:'#f59e0b',
  text0:'#f1f5f9', text1:'#94a3b8', text2:'#475569',
  border:'#1e2d47',
};

// Accurate UJ campus coordinates
const CAMPUS_REGIONS = {
  'All':    { latitude:-26.210000, longitude:28.010000, latitudeDelta:0.18,  longitudeDelta:0.18  },
  'UJ APK': { latitude:-26.18192,  longitude:27.99831,  latitudeDelta:0.008, longitudeDelta:0.008 },
  'UJ APB': { latitude:-26.19042,  longitude:28.01931,  latitudeDelta:0.008, longitudeDelta:0.008 },
  'UJ DFC': { latitude:-26.19239,  longitude:28.05803,  latitudeDelta:0.008, longitudeDelta:0.008 },
  'UJ SWC': { latitude:-26.25953,  longitude:27.92397,  latitudeDelta:0.008, longitudeDelta:0.008 },
};



function markerColor(status) {
  if (status === 'UNSAFE')  return C.red;
  if (status === 'CAUTION') return C.amber;
  return C.green;
}

export default function MapScreen() {
  const router = useRouter();
  const mapRef = useRef(null);
  const [nodes,         setNodes]        = useState([]);
  const [nodeReadings,  setNodeReadings]  = useState({});
  const [loading,       setLoading]       = useState(true);
  const [selectedCampus,setSelectedCampus]= useState('All');

  useEffect(() => {
    // Fetch all nodes
    supabase.from('nodes').select('*').order('campus')
      .then(({ data }) => {
        setNodes(data || []);
        setLoading(false);

        // Fetch latest reading for each node
        (data || []).forEach(async (node) => {
          const { data: readings } = await supabase
            .from('readings')
            .select('*')
            .eq('node_id', node.node_id)
            .order('created_at', { ascending: false })
            .limit(1);
          if (readings && readings.length > 0) {
            setNodeReadings(prev => ({ ...prev, [node.node_id]: readings[0] }));
          }
        });
      });
  }, []);

  const campuses = ['All', 'UJ APK', 'UJ APB', 'UJ SWC', 'UJ DFC'];

  const handleCampusSelect = (campus) => {
    setSelectedCampus(campus);
    const region = CAMPUS_REGIONS[campus] || CAMPUS_REGIONS['All'];
    mapRef.current?.animateToRegion(region, 600);
  };

  const filtered = selectedCampus === 'All'
    ? nodes
    : nodes.filter(n => n.campus === selectedCampus);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Campus Map</Text>
        <Text style={s.headerSub}>{filtered.length} monitoring nodes</Text>
      </View>

      {/* Campus selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.chipsWrap}
        contentContainerStyle={{ paddingHorizontal: 14, gap: 6 }}
      >
        {campuses.map(c => (
          <TouchableOpacity
            key={c}
            style={[s.chip, selectedCampus === c && s.chipActive]}
            onPress={() => handleCampusSelect(c)}
          >
            <Text style={[s.chipTxt, selectedCampus === c && s.chipTxtActive]}>
              {c === 'All' ? 'All Campuses' : c}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Map */}
      <View style={s.mapWrap}>
        {loading ? (
          <View style={s.mapLoading}>
            <ActivityIndicator size="large" color={C.blue} />
            <Text style={{ color: C.text2, marginTop: 10 }}>Loading campus nodes...</Text>
          </View>
        ) : (
          <MapView
            ref={mapRef}
            style={s.map}
            initialRegion={CAMPUS_REGIONS['All']}
            userInterfaceStyle="dark"
          >
            {filtered.map(node => {
              if (!node.latitude || !node.longitude) return null;
              const reading = nodeReadings[node.node_id];
              const eval_   = reading ? evaluateReading(reading) : null;
              const color   = node.status !== 'online'
                ? C.text2
                : eval_ ? markerColor(eval_.status) : C.blue;

              return (
                <Marker
                  key={node.node_id}
                  coordinate={{ latitude: node.latitude, longitude: node.longitude }}
                  onPress={() => router.push(`/node/${node.node_id}`)}
                >
                  <View style={[s.markerPin, { backgroundColor: color }]}>
                    <Text style={{ fontSize: 16 }}>💧</Text>
                  </View>
                  <Callout onPress={() => router.push(`/node/${node.node_id}`)}>
                    <View style={s.callout}>
                      <Text style={s.calloutName}>{node.location_name}</Text>
                      <Text style={s.calloutCampus}>
                        {node.campus} · {CAMPUS_LABELS[node.campus] || ''}
                      </Text>
                      {eval_ && (
                        <Text style={[s.calloutStatus, { color: eval_.color }]}>
                          {eval_.emoji} {eval_.status}
                        </Text>
                      )}
                      {reading && (
                        <Text style={s.calloutMeta}>
                          pH {reading.ph?.toFixed(1)} · TDS {Math.round(reading.tds)} mg/L
                        </Text>
                      )}
                      <Text style={s.calloutTap}>Tap to view details →</Text>
                    </View>
                  </Callout>
                </Marker>
              );
            })}
          </MapView>
        )}
      </View>

      {/* Legend */}
      <View style={s.legend}>
        {[
          { color: C.green, label: 'SAFE'    },
          { color: C.amber, label: 'CAUTION' },
          { color: C.red,   label: 'UNSAFE'  },
          { color: C.text2, label: 'Offline' },
        ].map(item => (
          <View key={item.label} style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: item.color }]} />
            <Text style={s.legendTxt}>{item.label}</Text>
          </View>
        ))}
        <Text style={s.legendNote}>SANS 241:2015</Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: C.bg0 },
  header:     { backgroundColor: C.bg1, paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  headerTitle:{ fontSize: 20, fontWeight: '700', color: C.text0 },
  headerSub:  { fontSize: 12, color: C.text1, marginTop: 2 },
  chipsWrap:  { paddingVertical: 8, maxHeight: 50 },
  chip:       { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: C.bg2, borderWidth: 1, borderColor: C.border },
  chipActive: { backgroundColor: 'rgba(59,130,246,0.2)', borderColor: 'rgba(59,130,246,0.5)' },
  chipTxt:    { fontSize: 12, fontWeight: '600', color: C.text1 },
  chipTxtActive: { color: C.blueLight },
  mapWrap:    { flex: 1 },
  map:        { flex: 1 },
  mapLoading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg1 },
  markerPin:  { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'white', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 4, elevation: 5 },
  callout:    { width: 200, padding: 12 },
  calloutName:  { fontSize: 14, fontWeight: '700', color: '#1e293b', marginBottom: 3 },
  calloutCampus:{ fontSize: 11, color: '#64748b', marginBottom: 5 },
  calloutStatus:{ fontSize: 13, fontWeight: '700', marginBottom: 4 },
  calloutMeta:  { fontSize: 11, color: '#64748b', marginBottom: 5 },
  calloutTap:   { fontSize: 11, color: '#3b82f6', fontWeight: '600' },
  legend:     { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, backgroundColor: C.bg1, borderTopWidth: 1, borderTopColor: C.border },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:  { width: 8, height: 8, borderRadius: 4 },
  legendTxt:  { fontSize: 11, color: C.text1, fontWeight: '500' },
  legendNote: { fontSize: 10, color: C.text2, marginLeft: 'auto' },
});
