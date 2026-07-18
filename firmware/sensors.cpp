// firmware/sensors.cpp
#include "sensors.h"
#include <math.h>

OneWire           oneWire(DS18B20_PIN);
DallasTemperature ds18b20(&oneWire);

void initSensors() {
  // Set ADC pins as input
  pinMode(PH_PIN,        INPUT);
  pinMode(TDS_PIN,       INPUT);
  pinMode(TURBIDITY_PIN, INPUT);

  // Start DS18B20
  ds18b20.begin();

  // Allow ADC to settle
  delay(100);

  #if DEBUG_SERIAL
  Serial.println("[Sensors] Initialized");
  #endif
}

// ── Median sort (bubble sort, take middle value) ───────
int bubbleSortMedian(int *buf, int n) {
  for (int i = 0; i < n - 1; i++) {
    for (int j = 0; j < n - i - 1; j++) {
      if (buf[j] > buf[j + 1]) {
        int tmp  = buf[j];
        buf[j]   = buf[j + 1];
        buf[j+1] = tmp;
      }
    }
  }
  return buf[n / 2];
}

// ── Temperature (DS18B20 OneWire) ─────────────────────
float readTemperature() {
  ds18b20.requestTemperatures();
  float t = ds18b20.getTempCByIndex(0);
  if (t == DEVICE_DISCONNECTED_C) {
    #if DEBUG_SERIAL
    Serial.println("[Sensors] DS18B20 disconnected — using 25°C fallback");
    #endif
    return 25.0f; // fallback for TDS compensation
  }
  #if DEBUG_SERIAL
  Serial.printf("[Sensors] Temperature: %.2f°C\n", t);
  #endif
  return t;
}

// ── TDS (Keystudio V1.0) with median filter + temp compensation ─
// Formula from Keystudio TDS sensor documentation
float readTDS(float tempC) {
  int buf[SAMPLE_COUNT];
  for (int i = 0; i < SAMPLE_COUNT; i++) {
    buf[i] = analogRead(TDS_PIN);
    delay(SAMPLE_DELAY_MS);
  }

  int   median     = bubbleSortMedian(buf, SAMPLE_COUNT);
  float voltage    = median * (ADC_VREF / ADC_RESOLUTION);

  // Temperature compensation coefficient
  float tempCoeff  = 1.0f + 0.02f * (tempC - 25.0f);
  float compVoltage = voltage / tempCoeff;

  // Keystudio conversion polynomial
  float tds = (133.42f * powf(compVoltage, 3)
             - 255.86f * powf(compVoltage, 2)
             + 857.39f * compVoltage) * 0.5f;

  tds = max(0.0f, tds); // clamp negative values

  #if DEBUG_SERIAL
  Serial.printf("[Sensors] TDS: %.1f mg/L (raw ADC median: %d)\n", tds, median);
  #endif
  return tds;
}

// ── pH sensor (analog) ────────────────────────────────
// Two-point calibration using pH 4 and pH 7 buffer solutions
// Adjust PH_NEUTRAL_VOLTAGE and PH_ACID_VOLTAGE in config.h after calibration
float readPH() {
  int buf[SAMPLE_COUNT];
  for (int i = 0; i < SAMPLE_COUNT; i++) {
    buf[i] = analogRead(PH_PIN);
    delay(SAMPLE_DELAY_MS);
  }

  int   median  = bubbleSortMedian(buf, SAMPLE_COUNT);
  float voltage = median * (ADC_VREF / ADC_RESOLUTION);

  // Linear interpolation between two calibration points
  // At pH 7: voltage = PH_NEUTRAL_VOLTAGE
  // At pH 4: voltage = PH_ACID_VOLTAGE
  // Slope (mV per pH unit) at 25°C ≈ 59.16 mV
  float slope = (7.0f - 4.0f) / (PH_NEUTRAL_VOLTAGE - PH_ACID_VOLTAGE);
  float ph    = 7.0f + slope * (PH_NEUTRAL_VOLTAGE - voltage);

  // Clamp to valid range
  ph = constrain(ph, 0.0f, 14.0f);

  #if DEBUG_SERIAL
  Serial.printf("[Sensors] pH: %.2f (voltage: %.3fV)\n", ph, voltage);
  #endif
  return ph;
}

// ── Turbidity (analog) ────────────────────────────────
// Higher voltage = clearer water; lower voltage = more turbid
// Sensor output is inverted — calibrate against NTU standard solutions
float readTurbidity() {
  int buf[SAMPLE_COUNT];
  for (int i = 0; i < SAMPLE_COUNT; i++) {
    buf[i] = analogRead(TURBIDITY_PIN);
    delay(SAMPLE_DELAY_MS);
  }

  int   median  = bubbleSortMedian(buf, SAMPLE_COUNT);
  float voltage = median * (ADC_VREF / ADC_RESOLUTION);

  // Approximate conversion (calibrate with NTU standard solutions)
  // At 3.3V (clear water) ≈ 0 NTU; at ~2.5V ≈ high turbidity
  float ntu = 0.0f;
  if (voltage >= 2.5f) {
    ntu = 0.0f;
  } else if (voltage >= 1.5f) {
    ntu = (2.5f - voltage) / (2.5f - 1.5f) * 100.0f; // linear approx 0-100 NTU
  } else {
    ntu = 100.0f + (1.5f - voltage) * 200.0f; // extended range
  }

  ntu = max(0.0f, ntu);

  #if DEBUG_SERIAL
  Serial.printf("[Sensors] Turbidity: %.2f NTU (voltage: %.3fV)\n", ntu, voltage);
  #endif
  return ntu;
}
