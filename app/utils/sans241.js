// app/utils/sans241.js
// SANS 241:2015 — South Africa's mandatory drinking water standard
import { STATUS } from '@/lib/theme';

const THRESHOLDS = {
  ph:          { min: 5.0, max: 9.7  },
  tds:         { max: 1200 },
  turbidity:   { max: 5   },
  temperature: { min: 5.0, max: 25.0 },
};

const UNSAFE_LIMITS = {
  ph:        { min: 4.0, max: 11.0 },
  tds:       { max: 2400 },
  turbidity: { max: 10  },
};

export function evaluateReading(r) {
  const issues = [];

  if (r.ph !== undefined && r.ph !== null) {
    if (r.ph < THRESHOLDS.ph.min || r.ph > THRESHOLDS.ph.max) issues.push('pH');
  }
  if (r.tds !== undefined && r.tds !== null && r.tds > THRESHOLDS.tds.max)
    issues.push('TDS');
  if (r.turbidity !== undefined && r.turbidity !== null && r.turbidity > THRESHOLDS.turbidity.max)
    issues.push('Turbidity');
  if (r.temperature !== undefined && r.temperature !== null) {
    if (r.temperature < THRESHOLDS.temperature.min || r.temperature > THRESHOLDS.temperature.max)
      issues.push('Temperature');
  }

  if (issues.length === 0) {
    return { status:'SAFE',    issues:[], color: STATUS.SAFE.color,    bg: STATUS.SAFE.bg,    emoji:'✅' };
  }

  const severe =
    (r.ph !== undefined && r.ph !== null && (r.ph < UNSAFE_LIMITS.ph.min || r.ph > UNSAFE_LIMITS.ph.max)) ||
    (r.tds !== undefined && r.tds !== null && r.tds > UNSAFE_LIMITS.tds.max) ||
    (r.turbidity !== undefined && r.turbidity !== null && r.turbidity > UNSAFE_LIMITS.turbidity.max);

  if (severe) {
    return { status:'UNSAFE',  issues, color: STATUS.UNSAFE.color,  bg: STATUS.UNSAFE.bg,  emoji:'🚨' };
  }
  return   { status:'CAUTION', issues, color: STATUS.CAUTION.color, bg: STATUS.CAUTION.bg, emoji:'⚠️' };
}

export const PARAMETER_UNITS = {
  ph:          { unit:'',     label:'pH',         range:'5.0–9.7', icon:'⚗️' },
  tds:         { unit:'mg/L', label:'TDS',         range:'≤ 1200',  icon:'⚡' },
  turbidity:   { unit:'NTU',  label:'Turbidity',   range:'≤ 5',     icon:'💡' },
  temperature: { unit:'°C',   label:'Temperature', range:'5–25',    icon:'🌡️' },
};

// Updated to match the 4 UJ campuses exactly
export const CAMPUS_LABELS = {
  'UJ APK': 'Auckland Park Kingsway',
  'UJ APB': 'Auckland Park Bunting Road',
  'UJ SWC': 'Soweto Campus',
  'UJ DFC': 'Doornfontein Campus',
};
