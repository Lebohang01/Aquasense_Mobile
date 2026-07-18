// app/components/LineChart.js
// Pure React Native SVG chart — no victory-native, no skia, no conflicts
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Line, Text as SvgText, Rect, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

const C = {
  bg2:    '#151c30',
  text0:  '#f1f5f9',
  text1:  '#94a3b8',
  text2:  '#475569',
  border: '#1e2d47',
  blue:   '#3b82f6',
  green:  '#22c55e',
  amber:  '#f59e0b',
  red:    '#ef4444',
  purple: '#8b5cf6',
  cyan:   '#06b6d4',
};

const METRIC_COLORS = {
  ph:          C.blue,
  tds:         C.amber,
  turbidity:   C.purple,
  temperature: C.cyan,
};

// SANS 241 safe limits — drawn as a reference line
const SANS_LIMITS = {
  ph:          { max: 9.7,  min: 5.0 },
  tds:         { max: 1200, min: 0   },
  turbidity:   { max: 5,    min: 0   },
  temperature: { max: 25,   min: 5   },
};

/**
 * LineChart — pure SVG, no external chart library needed
 *
 * @param {Array}  data        — array of { x: Date, y: number }
 * @param {string} metric      — 'ph'|'tds'|'turbidity'|'temperature'
 * @param {number} width       — chart width in px (default 300)
 * @param {number} height      — chart height in px (default 160)
 * @param {string} color       — line color (overrides metric default)
 * @param {string} label       — y-axis label
 * @param {string} unit        — unit string shown on tooltip/axis
 */
export function LineChart({
  data = [],
  metric = 'ph',
  width = 300,
  height = 160,
  color,
  label = '',
  unit = '',
}) {
  const strokeColor = color || METRIC_COLORS[metric] || C.blue;
  const limit       = SANS_LIMITS[metric];

  const PAD = { top: 10, right: 12, bottom: 32, left: 44 };
  const W   = width  - PAD.left - PAD.right;
  const H   = height - PAD.top  - PAD.bottom;

  if (!data || data.length < 2) {
    return (
      <View style={[styles.empty, { width, height }]}>
        <Text style={styles.emptyTxt}>Not enough data yet</Text>
      </View>
    );
  }

  const ys     = data.map(d => d.y);
  const rawMin = Math.min(...ys);
  const rawMax = Math.max(...ys);

  // Expand range to include SANS limits so they're visible
  const domainMin = limit ? Math.min(rawMin, limit.min) : rawMin;
  const domainMax = limit ? Math.max(rawMax, limit.max) : rawMax;
  const range     = domainMax - domainMin || 1;

  const toX = (i)  => PAD.left + (i / (data.length - 1)) * W;
  const toY = (v)  => PAD.top  + H - ((v - domainMin) / range) * H;

  // Build SVG path
  const pathD = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(d.y).toFixed(1)}`)
    .join(' ');

  // Fill area under the line
  const areaD =
    `${pathD} L${toX(data.length - 1).toFixed(1)},${(PAD.top + H).toFixed(1)} ` +
    `L${PAD.left.toFixed(1)},${(PAD.top + H).toFixed(1)} Z`;

  // Y-axis ticks (5 evenly spaced)
  const ticks = Array.from({ length: 5 }, (_, i) => {
    const v = domainMin + (range * i) / 4;
    return { v, y: toY(v) };
  });

  // X-axis labels (show first, middle, last)
  const xLabels = [0, Math.floor(data.length / 2), data.length - 1].map(i => ({
    i,
    x: toX(i),
    label: formatXLabel(data[i].x),
  }));

  // SANS limit lines
  const limitLines = limit
    ? [
        limit.max !== undefined && { y: toY(limit.max), color: C.amber, label: `Max ${limit.max}` },
        limit.min !== undefined && limit.min > 0 && { y: toY(limit.min), color: C.amber, label: `Min ${limit.min}` },
      ].filter(Boolean)
    : [];

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id={`grad-${metric}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0"   stopColor={strokeColor} stopOpacity="0.25" />
          <Stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
        </LinearGradient>
      </Defs>

      {/* Y-axis grid lines + labels */}
      {ticks.map((t, i) => (
        <React.Fragment key={i}>
          <Line
            x1={PAD.left} y1={t.y.toFixed(1)}
            x2={PAD.left + W} y2={t.y.toFixed(1)}
            stroke={C.border} strokeWidth="1" strokeDasharray="3,3"
          />
          <SvgText
            x={(PAD.left - 4).toFixed(1)} y={(t.y + 4).toFixed(1)}
            fontSize="9" fill={C.text2} textAnchor="end"
          >
            {formatValue(t.v, metric)}
          </SvgText>
        </React.Fragment>
      ))}

      {/* SANS 241 limit lines */}
      {limitLines.map((line, i) => (
        <React.Fragment key={i}>
          <Line
            x1={PAD.left} y1={line.y.toFixed(1)}
            x2={PAD.left + W} y2={line.y.toFixed(1)}
            stroke={C.amber} strokeWidth="1.5" strokeDasharray="6,3" opacity="0.7"
          />
          <SvgText
            x={(PAD.left + W - 2).toFixed(1)} y={(line.y - 3).toFixed(1)}
            fontSize="8" fill={C.amber} textAnchor="end" opacity="0.8"
          >
            SANS limit
          </SvgText>
        </React.Fragment>
      ))}

      {/* Area fill */}
      <Path d={areaD} fill={`url(#grad-${metric})`} />

      {/* Line */}
      <Path
        d={pathD}
        fill="none"
        stroke={strokeColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Data point dots (first and last only, to keep clean) */}
      {[0, data.length - 1].map(i => (
        <Circle
          key={i}
          cx={toX(i).toFixed(1)}
          cy={toY(data[i].y).toFixed(1)}
          r="3"
          fill={strokeColor}
          stroke={C.bg2}
          strokeWidth="1.5"
        />
      ))}

      {/* X-axis labels */}
      {xLabels.map((xl, i) => (
        <SvgText
          key={i}
          x={xl.x.toFixed(1)}
          y={(PAD.top + H + 18).toFixed(1)}
          fontSize="9"
          fill={C.text2}
          textAnchor="middle"
        >
          {xl.label}
        </SvgText>
      ))}

      {/* Y-axis line */}
      <Line
        x1={PAD.left} y1={PAD.top}
        x2={PAD.left} y2={PAD.top + H}
        stroke={C.border} strokeWidth="1"
      />

      {/* X-axis line */}
      <Line
        x1={PAD.left} y1={PAD.top + H}
        x2={PAD.left + W} y2={PAD.top + H}
        stroke={C.border} strokeWidth="1"
      />
    </Svg>
  );
}

/**
 * BarChart — simple bar chart, used on dashboard
 */
export function BarChart({ data = [], labels = [], color = C.blue, width = 300, height = 80 }) {
  if (!data.length) return null;

  const max  = Math.max(...data) || 1;
  const barW = (width / data.length) * 0.6;
  const gap  = width / data.length;

  return (
    <Svg width={width} height={height + 20}>
      {data.map((v, i) => {
        const barH  = Math.max(4, ((v / max) * height));
        const x     = i * gap + (gap - barW) / 2;
        const y     = height - barH;
        const alpha = 0.4 + (i / (data.length - 1 || 1)) * 0.6;
        const isLast = i === data.length - 1;
        return (
          <React.Fragment key={i}>
            <Rect
              x={x.toFixed(1)} y={y.toFixed(1)}
              width={barW.toFixed(1)} height={barH.toFixed(1)}
              rx="3"
              fill={isLast ? color : color}
              opacity={isLast ? 1 : alpha.toFixed(2)}
            />
            {labels[i] && (
              <SvgText
                x={(x + barW / 2).toFixed(1)}
                y={(height + 14).toFixed(1)}
                fontSize="9" fill={C.text2} textAnchor="middle"
              >
                {labels[i]}
              </SvgText>
            )}
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

// ── Helpers ────────────────────────────────────────────
function formatValue(v, metric) {
  if (v > 1000) return `${(v / 1000).toFixed(1)}k`;
  if (metric === 'ph') return v.toFixed(1);
  return Math.round(v).toString();
}

function formatXLabel(x) {
  if (!x) return '';
  const d = x instanceof Date ? x : new Date(x);
  if (isNaN(d.getTime())) return '';
  const now  = Date.now();
  const diff = now - d.getTime();
  if (diff < 25 * 3600000) {
    return d.getHours().toString().padStart(2, '0') + ':00';
  }
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

const styles = StyleSheet.create({
  empty:    { alignItems: 'center', justifyContent: 'center' },
  emptyTxt: { fontSize: 12, color: C.text2 },
});
