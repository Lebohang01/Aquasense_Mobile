// firmware/aquasense.ino
// AquaSense UJ — ESP32 Sensor Node
// University of Johannesburg · SANS 241:2015 Water Quality Monitor
//
// Required libraries (install via Arduino IDE Library Manager):
//   - OneWire by Paul Stoffregen
//   - DallasTemperature by Miles Burton
//   - ArduinoJson by Benoit Blanchon (optional — not used, using String concat)
//
// Board: ESP32 by Espressif Systems (install via Boards Manager)
// Board selection: "ESP32 Dev Module" or "ESP32-WROOM-32"

#include <Arduino.h>
#include "config.h"
#include "sans241.h"
#include "sensors.h"
#include "wifi_manager.h"
#include "supabase_client.h"

// ── Boot count (persists across deep sleep via RTC memory) ───
RTC_DATA_ATTR int bootCount = 0;

// ── Forward declarations ──────────────────────────────
void deepSleep();
void printReading(SensorReading &r);

// ── Setup — runs on every wake from deep sleep ─────────
void setup() {
  #if DEBUG_SERIAL
  Serial.begin(115200);
  delay(200);
  bootCount++;
  Serial.printf("\n=== AquaSense UJ Boot #%d ===\n", bootCount);
  Serial.printf("Wake reason: %d\n", esp_sleep_get_wakeup_cause());
  #endif

  // ── 1. Initialize sensors ──────────────────────────
  initSensors();

  // ── 2. Read temperature first (needed for TDS compensation) ──
  float tempC = readTemperature();

  // ── 3. Read all sensors with median filtering ──────
  SensorReading reading;
  reading.temperature = tempC;
  reading.tds         = readTDS(tempC);
  reading.ph          = readPH();
  reading.turbidity   = readTurbidity();

  // ── 4. Evaluate against SANS 241:2015 ─────────────
  evaluateSANS241(reading);

  #if DEBUG_SERIAL
  printReading(reading);
  #endif

  // ── 5. Connect to WiFi ────────────────────────────
  bool wifiOk = connectWiFi();
  if (!wifiOk) {
    #if DEBUG_SERIAL
    Serial.println("[Main] WiFi failed — will retry after sleep");
    #endif
    deepSleep();
    return;
  }

  // ── 6. Post to Supabase ───────────────────────────
  int attempts = 0;
  int httpCode = 0;
  while (attempts < 3 && httpCode != 201) {
    httpCode = postToSupabase(reading);
    if (httpCode != 201) {
      attempts++;
      delay(2000); // wait 2s before retry
    }
  }

  if (httpCode == 201) {
    updateNodeHeartbeat();
  }

  // ── 7. Disconnect WiFi to save power ─────────────
  disconnectWiFi();

  // ── 8. Enter deep sleep ───────────────────────────
  deepSleep();
}

// ── Loop — never reached (deep sleep resets to setup()) ──
void loop() {}

// ── Deep sleep helper ─────────────────────────────────
void deepSleep() {
  #if defined(POWER_MODE_SOLAR)
  #if DEBUG_SERIAL
  Serial.printf("[Main] Entering deep sleep for %.0f minutes...\n",
    (float)SLEEP_INTERVAL_US / 60000000.0f);
  Serial.flush();
  #endif
  esp_sleep_enable_timer_wakeup(SLEEP_INTERVAL_US);
  esp_deep_sleep_start();
  #else
  // USB/always-on mode: just delay instead of deep sleep
  #if DEBUG_SERIAL
  Serial.printf("[Main] USB mode — waiting %.0f minutes before next reading...\n",
    (float)SLEEP_INTERVAL_US / 60000000.0f);
  #endif
  delay(SLEEP_INTERVAL_US / 1000); // convert to ms
  #endif
}

// ── Debug print ───────────────────────────────────────
void printReading(SensorReading &r) {
  Serial.println("─────────────────────────────");
  Serial.printf("  pH:          %.2f\n",   r.ph);
  Serial.printf("  TDS:         %.1f mg/L\n", r.tds);
  Serial.printf("  Turbidity:   %.2f NTU\n",  r.turbidity);
  Serial.printf("  Temperature: %.2f°C\n",    r.temperature);
  Serial.printf("  SANS 241:    %s\n",         r.statusStr);
  Serial.println("─────────────────────────────");
}
