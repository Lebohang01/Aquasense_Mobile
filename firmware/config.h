// firmware/config.h
// ── WiFi ──────────────────────────────────────────────
#define WIFI_SSID        "YOUR_WIFI_SSID"
#define WIFI_PASSWORD    "YOUR_WIFI_PASSWORD"
#define WIFI_TIMEOUT_MS  15000

// ── Supabase ──────────────────────────────────────────
#define SUPABASE_URL     "https://YOUR_PROJECT.supabase.co"
#define SUPABASE_ANON_KEY "YOUR_ANON_KEY"

// ── Node identity ─────────────────────────────────────
// Unique UUID per physical sensor node — generate at https://uuidgenerator.net
#define NODE_ID          "YOUR_NODE_UUID"

// ── GPIO pins ─────────────────────────────────────────
#define PH_PIN           34   // ADC1_CH6 — analog pH sensor
#define TDS_PIN          35   // ADC1_CH7 — Keystudio TDS V1.0
#define TURBIDITY_PIN    32   // ADC1_CH4 — analog turbidity sensor
#define DS18B20_PIN      4    // OneWire — DS18B20 waterproof temp sensor

// ── Sampling ──────────────────────────────────────────
#define SAMPLE_COUNT     30   // median filter samples
#define SAMPLE_DELAY_MS  40   // delay between samples (ms)

// ── Deep sleep ────────────────────────────────────────
// 15 minutes = 900 seconds = 900,000,000 microseconds
#define SLEEP_INTERVAL_US  900000000ULL

// ── Power mode (comment out one) ─────────────────────
// #define POWER_MODE_USB      // Indoor: USB 5V — no deep sleep
#define POWER_MODE_SOLAR   // Outdoor: solar + battery — deep sleep

// ── ADC reference voltage ─────────────────────────────
#define ADC_VREF         3.3f
#define ADC_RESOLUTION   4095

// ── pH calibration (adjust per probe) ────────────────
// Use two-point calibration with pH 4.0 and pH 7.0 buffers
#define PH_NEUTRAL_VOLTAGE   1.50f  // voltage at pH 7 (calibrate!)
#define PH_ACID_VOLTAGE      2.03f  // voltage at pH 4 (calibrate!)

// ── Debug serial (set 0 to disable for production) ───
#define DEBUG_SERIAL     1
