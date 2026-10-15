// app/components/AquaLogo.js
// Shared brand mark — droplet + campus skyline + UJ tag.
// Used on login, dashboard header, and anywhere else the icon appears,
// so there's one definition instead of copies drifting out of sync.
import Svg, { Path, Rect, Text as SvgText, Defs, LinearGradient, Stop, G } from 'react-native-svg';

export default function AquaLogo({ size = 88 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Defs>
        <LinearGradient id="dropbg1" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#eaf6fc" />
          <Stop offset="100%" stopColor="#0b6fb8" />
        </LinearGradient>
      </Defs>
      <Rect width="200" height="200" rx="46" fill="url(#dropbg1)" />
      <Path d="M100 28 C130 78 152 108 152 132 C152 160 128 178 100 178 C72 178 48 160 48 132 C48 108 70 78 100 28 Z" fill="#1798d6" />
      <Path d="M92 46 C80 66 68 84 68 100 C68 112 78 118 88 112 C82 96 86 70 92 46 Z" fill="#bfe9f7" opacity={0.85} />
      <Path d="M55 128 Q100 148 152 126 L152 132 C152 160 128 178 100 178 C72 178 48 160 48 132 Z" fill="#0d5c94" />
      <G fill="#0b3a5c">
        <Rect x="70" y="96" width="16" height="40" />
        <Rect x="88" y="82" width="18" height="54" />
        <Rect x="108" y="90" width="16" height="46" />
        <Rect x="126" y="70" width="20" height="66" />
      </G>
      <Rect x="103" y="98" width="16" height="12" rx="2" fill="#eaf6fc" />
      <SvgText x="111" y="107" fontSize="8" fill="#0b3a5c" textAnchor="middle" fontWeight="500">UJ</SvgText>
    </Svg>
  );
}
