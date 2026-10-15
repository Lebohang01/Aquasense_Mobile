// app/components/AppHeader.js
// Shared branded header: logo + "AquaSense UJ" + right-side action.
// Pass `stats` (dashboard only) to include the nodes/online/alerts/
// campuses row. Pass `rightSlot` to replace the default alert icon with
// custom content (e.g. Community's message + new-post buttons).
import { Animated, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AquaLogo from './AquaLogo';
import * as theme from '@/lib/theme';

const C = theme.C;
// Falls back to these if lib/theme.js hasn't been updated with HEADER yet
const HEADER = theme.HEADER || { bar: { logo: 30, padTop: 4, padBottom: 8 }, hero: { content: 128 } };

// Header height = status-bar inset + content. Screens call this hook so
// their content padding always matches the header exactly.
const CONTENT_SLIM  = 54;   // 6 top gap + 34 logo row + 12 bottom + 2 spare
const CONTENT_STATS = 128;  // slim + 14 gap + stats row (~60)
// Only Home (floating, collapsing header) needs reserved space. Every other
// call returns 0, so older screen files that still add header padding
// can no longer create a gap under the static header.
export function useHeaderHeight(mode) {
  const { top } = useSafeAreaInsets();
  if (mode === 'home')  return Math.max(top, 24) + CONTENT_SLIM;
  if (mode === 'stats') return Math.max(top, 24) + CONTENT_STATS;
  return 0;
}

// Stats strip (Nodes / Online / Alerts / Campuses). Home renders this inside
// its scroll content so only the slim title bar slides in and out, instead of
// a tall header covering the buttons when the user scrolls up.
export function StatsBar({ stats }) {
  return (
    <View style={st.statsBar}>
      <View style={st.statsRow0}>
        {stats.map(s_ => (
          <View key={s_.label} style={st.statItem}>
            <Text style={st.statVal}>{s_.val}</Text>
            <Text style={st.statLbl} numberOfLines={1}>{s_.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function AppHeader({
  translateY,
  collapsible = false,   // Home only: floats over content and slides away
  subtitle,
  stats,          // optional: [{ label, val }, ...] — dashboard only
  alertCount = 0,
  onRightPress,
  rightSlot,      // optional: custom ReactNode replacing the default icon
  rightEmoji = '⚠️',
}) {
  const { top } = useSafeAreaInsets();
  const collapsing = collapsible && !!translateY;
  const height = useHeaderHeight(stats ? 'stats' : 'home');
  const padTop = Math.max(top, 24) + (collapsing ? 6 : HEADER.bar.padTop);

  // Static (default): sits in normal layout flow, so screens need no extra
  // top padding. Collapsing (Home): absolutely positioned and slid away.
  const wrapStyle = collapsing
    ? [st.wrap, { height, paddingTop: padTop, transform: [{ translateY }] }]
    : [st.bar, { paddingTop: padTop }];

  return (
    <Animated.View style={wrapStyle}>
      <View style={st.topRow}>
        <View style={collapsing ? st.logoBox : st.logoBoxBar}><AquaLogo size={collapsing ? 34 : HEADER.bar.logo} /></View>

        <View style={st.titleBlock}>
          <Text style={st.title} numberOfLines={1}>AquaSense UJ</Text>
          {subtitle ? <Text style={st.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
        </View>

        {rightSlot ? rightSlot : (
          <TouchableOpacity style={st.rightBtn} onPress={onRightPress}>
            <Text style={{ fontSize: 18 }}>{rightEmoji}</Text>
            {alertCount > 0 && (
              <View style={st.badge}><Text style={st.badgeTxt}>{alertCount > 99 ? '99+' : alertCount}</Text></View>
            )}
          </TouchableOpacity>
        )}
      </View>

      {stats && (
        <View style={st.statsRow}>
          {stats.map(st_ => (
            <View key={st_.label} style={st.statItem}>
              <Text style={st.statVal}>{st_.val}</Text>
              <Text style={st.statLbl} numberOfLines={1}>{st_.label}</Text>
            </View>
          ))}
        </View>
      )}
    </Animated.View>
  );
}

const st = StyleSheet.create({
  wrap:       { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50, backgroundColor: C.navy, paddingHorizontal: 16, paddingBottom: 12, overflow: 'hidden' },
  bar:        { backgroundColor: C.navy, paddingHorizontal: 16, paddingBottom: HEADER.bar.padBottom, zIndex: 50 },
  logoBoxBar: { width: HEADER.bar.logo, height: HEADER.bar.logo, borderRadius: 8, overflow: 'hidden' },
  statsBar:   { backgroundColor: C.navy, paddingHorizontal: 16, paddingBottom: 14 },
  statsRow0:  { flexDirection: 'row', gap: 8 },
  topRow:     { flexDirection: 'row', alignItems: 'center' },
  logoBox:    { width: 34, height: 34, borderRadius: 9, overflow: 'hidden' },
  titleBlock: { flex: 1, alignItems: 'center', marginHorizontal: 10 },
  title:      { fontSize: 15, fontWeight: '700', color: '#ffffff', letterSpacing: -0.3 },
  subtitle:   { fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 1 },
  rightBtn:   { width: 34, height: 34, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  badge:      { position: 'absolute', top: -4, right: -4, backgroundColor: C.red, borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeTxt:   { fontSize: 9, fontWeight: '700', color: 'white' },
  statsRow:   { flexDirection: 'row', gap: 8, marginTop: 14 },
  statItem:   { flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  statVal:    { fontSize: 18, fontWeight: '700', color: '#ffffff' },
  statLbl:    { fontSize: 9, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
});
