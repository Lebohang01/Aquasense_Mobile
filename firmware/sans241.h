// firmware/sans241.h
// SANS 241:2015 — South Africa's mandatory drinking water standard
// Classifies readings as SAFE / CAUTION / UNSAFE

#ifndef SANS241_H
#define SANS241_H

#include <Arduino.h>

// ── SANS 241:2015 Thresholds ──────────────────────────
// Operational limits (CAUTION above these)
#define SANS_PH_MIN         5.0f
#define SANS_PH_MAX         9.7f
#define SANS_TDS_MAX        1200.0f   // mg/L
#define SANS_TURBIDITY_MAX  5.0f      // NTU
#define SANS_TEMP_MIN       5.0f      // °C
#define SANS_TEMP_MAX       25.0f     // °C

// Absolute limits (UNSAFE above these)
#define SANS_PH_UNSAFE_MIN  4.0f
#define SANS_PH_UNSAFE_MAX  11.0f
#define SANS_TDS_UNSAFE     2400.0f
#define SANS_TURBIDITY_UNSAFE 10.0f

typedef enum {
  SANS_SAFE    = 0,
  SANS_CAUTION = 1,
  SANS_UNSAFE  = 2
} SansStatus;

typedef struct {
  float     ph;
  float     tds;
  float     turbidity;
  float     temperature;
  SansStatus status;
  char      statusStr[10]; // "SAFE" | "CAUTION" | "UNSAFE"
} SensorReading;

// Evaluate a reading against SANS 241:2015 thresholds
SansStatus evaluateSANS241(SensorReading &r) {
  bool unsafe =
    (r.ph < SANS_PH_UNSAFE_MIN)  ||
    (r.ph > SANS_PH_UNSAFE_MAX)  ||
    (r.tds > SANS_TDS_UNSAFE)    ||
    (r.turbidity > SANS_TURBIDITY_UNSAFE);

  if (unsafe) {
    r.status = SANS_UNSAFE;
    strcpy(r.statusStr, "UNSAFE");
    return SANS_UNSAFE;
  }

  bool caution =
    (r.ph < SANS_PH_MIN)              ||
    (r.ph > SANS_PH_MAX)              ||
    (r.tds > SANS_TDS_MAX)            ||
    (r.turbidity > SANS_TURBIDITY_MAX)||
    (r.temperature < SANS_TEMP_MIN)   ||
    (r.temperature > SANS_TEMP_MAX);

  if (caution) {
    r.status = SANS_CAUTION;
    strcpy(r.statusStr, "CAUTION");
    return SANS_CAUTION;
  }

  r.status = SANS_SAFE;
  strcpy(r.statusStr, "SAFE");
  return SANS_SAFE;
}

#endif // SANS241_H
