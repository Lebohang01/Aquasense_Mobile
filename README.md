# 💧 AquaSense UJ — Technical Architecture V2

**University of Johannesburg · Year-Long Innovation Project**
Water quality monitoring across UJ campuses, benchmarked against SANS 241:2015.

---

## System Layers

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Hardware | ESP32-WROOM-32 + sensors | pH, TDS, Turbidity, Temperature |
| Firmware | Arduino C/C++ | Sensor reading, SANS 241 eval, deep sleep |
| Backend | Supabase (PostgreSQL + Realtime + Edge Functions + Auth) | Cloud processing, alerts |
| Mobile App | React Native + Expo (Vanilla JS) + Expo Router | Student-facing dashboard |

---

## Quick Start

### 1. Supabase Backend
```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push                          # apply schema migration
supabase functions deploy evaluate-reading
supabase functions deploy send-push-alert
supabase functions deploy daily-aggregation
```
## Running the App

### Start the development server

```bash
npx expo start --dev-client
```

### Android Emulator

Launch an emulator and run the app normally.

### Physical Android Device (USB)

If the app cannot connect to the Metro server:

```bash
adb reverse tcp:8081 tcp:8081
```

Verify the device is connected:

```bash
adb devices
```

### 2. Mobile App
```bash
cd app
npm install
cp .env.example .env                      # add Supabase URL + anon key
npx expo start                            # Expo Go for dev
npx eas build --platform android          # production APK
```

### 3. Firmware
- Open `firmware/aquasense.ino` in Arduino IDE
- Install board: ESP32 by Espressif (Boards Manager)
- Install libraries: OneWire, DallasTemperature, ArduinoJson, HTTPClient
- Set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `NODE_ID`, WiFi credentials in `firmware/config.h`
- Flash via USB

---

## Data Flow
```
ESP32 wakes (15 min timer)
  → reads pH, TDS, turbidity, temp (30 samples, median filter)
  → evaluates SANS 241 locally
  → HTTPS POST → Supabase REST API (readings table)
  → Database Webhook → evaluate-reading Edge Function
  → if CAUTION/UNSAFE → insert alert → send-push-alert Edge Function
  → Expo Push Notification → student phone (< 5 seconds)
  → Supabase Realtime WebSocket → live dashboard update
```

---

## Phase 1 Budget — Single Node

| Item | Cost |
|------|------|
| ESP32-WROOM-32 | R250 |
| pH Sensor Module | R350 |
| TDS Sensor (Keystudio V1.0) | R150 |
| Turbidity Sensor | R200 |
| DS18B20 Temperature | R75 |
| IP66 Enclosure | R150 |
| PCBs, wiring, connectors | R100 |
| Supabase Free Tier | R0 |
| Expo / React Native | R0 |
| Lab validation (SANS 241) | R1,500 |
| Miscellaneous | R500 |
| **TOTAL** | **≈ R3,275** |

---

## SANS 241:2015 Thresholds

| Parameter | Safe Range | Unit |
|-----------|-----------|------|
| pH | 5.0 – 9.7 | — |
| TDS | ≤ 1200 | mg/L |
| Turbidity | ≤ 5 | NTU |
| Temperature | 5 – 25 | °C |
