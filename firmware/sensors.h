// firmware/sensors.h
#ifndef SENSORS_H
#define SENSORS_H

#include <Arduino.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include "config.h"

// ── DS18B20 setup ─────────────────────────────────────
extern OneWire           oneWire;
extern DallasTemperature ds18b20;

void     initSensors();
float    readTemperature();
float    readTDS(float tempC);
float    readPH();
float    readTurbidity();

// ── Median sort helper ────────────────────────────────
int bubbleSortMedian(int *buf, int n);

#endif // SENSORS_H
