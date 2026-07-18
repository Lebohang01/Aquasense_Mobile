// firmware/wifi_manager.h
#ifndef WIFI_MANAGER_H
#define WIFI_MANAGER_H

#include <Arduino.h>
#include <WiFi.h>
#include "config.h"

bool connectWiFi() {
  #if DEBUG_SERIAL
  Serial.printf("[WiFi] Connecting to %s", WIFI_SSID);
  #endif

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED) {
    if (millis() - start > WIFI_TIMEOUT_MS) {
      #if DEBUG_SERIAL
      Serial.println("\n[WiFi] Timeout — entering deep sleep to retry");
      #endif
      return false;
    }
    delay(500);
    #if DEBUG_SERIAL
    Serial.print(".");
    #endif
  }

  #if DEBUG_SERIAL
  Serial.printf("\n[WiFi] Connected — IP: %s\n", WiFi.localIP().toString().c_str());
  #endif
  return true;
}

void disconnectWiFi() {
  WiFi.disconnect(true);
  WiFi.mode(WIFI_OFF);
}

#endif // WIFI_MANAGER_H
