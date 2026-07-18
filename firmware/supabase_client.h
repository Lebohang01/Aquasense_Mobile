// firmware/supabase_client.h
#ifndef SUPABASE_CLIENT_H
#define SUPABASE_CLIENT_H

#include <Arduino.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include "config.h"
#include "sans241.h"

// Post a sensor reading to Supabase REST API (readings table)
// Returns HTTP status code (201 = success)
int postToSupabase(SensorReading &r) {
  WiFiClientSecure client;
  client.setInsecure(); // For production: use proper CA cert verification

  HTTPClient http;
  String url = String(SUPABASE_URL) + "/rest/v1/readings";
  http.begin(client, url);

  // Supabase REST API headers
  http.addHeader("apikey",         SUPABASE_ANON_KEY);
  http.addHeader("Authorization",  "Bearer " + String(SUPABASE_ANON_KEY));
  http.addHeader("Content-Type",   "application/json");
  http.addHeader("Prefer",         "return=minimal");

  // Build JSON payload
  // ArduinoJson alternative: use String concatenation to avoid library overhead on ESP32
  String body = "{";
  body += "\"node_id\":\"" + String(NODE_ID) + "\",";
  body += "\"ph\":"         + String(r.ph, 3)          + ",";
  body += "\"tds\":"        + String(r.tds, 1)         + ",";
  body += "\"turbidity\":"  + String(r.turbidity, 2)   + ",";
  body += "\"temperature\":" + String(r.temperature, 2) + ",";
  body += "\"sans_status\":\"" + String(r.statusStr)   + "\"";
  body += "}";

  #if DEBUG_SERIAL
  Serial.printf("[Supabase] POST %s\n", url.c_str());
  Serial.printf("[Supabase] Body: %s\n", body.c_str());
  #endif

  int httpCode = http.POST(body);

  #if DEBUG_SERIAL
  if (httpCode == 201) {
    Serial.println("[Supabase] ✓ Reading posted successfully");
  } else {
    Serial.printf("[Supabase] ✗ HTTP %d — %s\n", httpCode, http.getString().c_str());
  }
  #endif

  http.end();
  return httpCode;
}

// Update node last_seen timestamp (called after successful post)
void updateNodeHeartbeat() {
  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  String url = String(SUPABASE_URL) + "/rest/v1/nodes?node_id=eq." + String(NODE_ID);
  http.begin(client, url);

  http.addHeader("apikey",        SUPABASE_ANON_KEY);
  http.addHeader("Authorization", "Bearer " + String(SUPABASE_ANON_KEY));
  http.addHeader("Content-Type",  "application/json");
  http.addHeader("Prefer",        "return=minimal");

  String body = "{\"last_seen\":\"now()\",\"status\":\"online\"}";
  http.sendRequest("PATCH", body);
  http.end();
}

#endif // SUPABASE_CLIENT_H
