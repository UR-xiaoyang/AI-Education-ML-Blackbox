#include <WiFi.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <Preferences.h>
#include <PubSubClient.h>
#include <algorithm>
#include <math.h>
#include <string.h>

// ---------- Default WiFi ----------
// These values are only used before you save WiFi from the web page.
const char *DEFAULT_WIFI_SSID = "YOUR_WIFI_SSID";
const char *DEFAULT_WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// ---------- ESP32 setup web page ----------
const char *AP_SSID = "PH4502C-Setup";
const char *AP_PASSWORD = "12345678";  // At least 8 characters. Change this before real deployment.
constexpr byte DNS_PORT = 53;

// ---------- MQTT ----------
const char *MQTT_HOST = "broker.emqx.io";  // Replace with your own broker in production.
const uint16_t MQTT_PORT = 1883;
const char *MQTT_USER = "";
const char *MQTT_PASSWORD = "";
const char *DEVICE_ID = "esp32-ph-001";
const char *MQTT_TOPIC = "sensors/ph/esp32-ph-001";

// ---------- PH-4502C / ESP32 ADC ----------
// Use an ADC-only pin. GPIO34, 35, 36, and 39 are good choices on most ESP32 boards.
constexpr int PH_ANALOG_PIN = 34;
constexpr uint32_t SAMPLE_INTERVAL_MS = 2000;
constexpr uint32_t PUBLISH_INTERVAL_MS = 5000;
constexpr uint32_t WIFI_RETRY_INTERVAL_MS = 15000;
constexpr uint32_t MQTT_RETRY_INTERVAL_MS = 5000;
constexpr int ADC_DIAG_PINS[] = {32, 33, 34, 35, 36, 39};
constexpr size_t ADC_DIAG_PIN_COUNT = sizeof(ADC_DIAG_PINS) / sizeof(ADC_DIAG_PINS[0]);

// If PH-4502C PO is connected directly to the ESP32 ADC, keep this at 1.0.
// If PO is reduced through a 10k/20k divider, set this to 1.5 because:
// sensorVoltage = adcVoltage * (10k + 20k) / 20k.
constexpr float VOLTAGE_DIVIDER_RATIO = 1.0f;

// Two-point calibration. Replace these with your measured sensorVoltage values.
// Put the probe in pH 7.00 buffer, wait until stable, record sensorVoltage.
constexpr float PH7_VALUE = 7.00f;
constexpr float PH7_VOLTAGE = 2.500f;

// Put the probe in pH 4.00 or pH 10.00 buffer, wait until stable, then record sensorVoltage.
constexpr float PH_SECOND_VALUE = 4.00f;
constexpr float PH_SECOND_VOLTAGE = 3.000f;

// pH probes are noisy; these settings take 30 samples and average the middle 20.
constexpr size_t SAMPLE_COUNT = 30;
constexpr size_t DISCARD_EACH_SIDE = 5;

WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);
WebServer server(80);
DNSServer dnsServer;
Preferences preferences;

String wifiSsid;
String wifiPassword;
uint32_t lastStaAttemptMs = 0;
uint32_t lastMqttAttemptMs = 0;
uint32_t lastSampleMs = 0;
uint32_t lastPublishMs = 0;

struct PhReading {
  uint16_t raw;
  float adcVoltage;
  float sensorVoltage;
  float ph;
};

PhReading lastReading = {0, 0.0f, 0.0f, NAN};
bool hasReading = false;

const char INDEX_HTML[] PROGMEM = R"rawliteral(
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>PH-4502C Monitor</title>
  <style>
    :root {
      color-scheme: light;
      font-family: Arial, sans-serif;
      background: #f4f7f9;
      color: #18222d;
    }
    * { box-sizing: border-box; }
    body { margin: 0; }
    main { max-width: 920px; margin: 0 auto; padding: 18px; }
    h1 { margin: 8px 0 16px; font-size: 28px; }
    h2 { margin: 0 0 12px; font-size: 18px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; }
    .panel {
      background: #ffffff;
      border: 1px solid #d9e1e8;
      border-radius: 8px;
      padding: 16px;
      box-shadow: 0 8px 24px rgba(16, 35, 50, 0.06);
    }
    .reading {
      font-size: 52px;
      line-height: 1;
      font-weight: 700;
      color: #0c7c59;
      margin: 12px 0 8px;
    }
    .reading.invalid { color: #b42318; }
    .meta { color: #4d5d6c; font-size: 14px; line-height: 1.8; }
    .warning-text {
      margin-top: 10px;
      min-height: 20px;
      color: #b42318;
      font-size: 13px;
      line-height: 1.45;
    }
    label { display: block; margin: 10px 0 6px; font-size: 14px; color: #344150; }
    input {
      width: 100%;
      min-height: 40px;
      padding: 9px 10px;
      border: 1px solid #c9d4de;
      border-radius: 6px;
      font-size: 15px;
    }
    button {
      min-height: 40px;
      padding: 0 14px;
      border: 0;
      border-radius: 6px;
      background: #1267a5;
      color: #ffffff;
      font-size: 15px;
      cursor: pointer;
    }
    button.secondary { background: #637381; }
    .actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 14px; }
    .scan-status { margin-top: 10px; min-height: 20px; color: #4d5d6c; font-size: 13px; }
    .scan-list { margin-top: 10px; display: grid; gap: 8px; }
    .network {
      width: 100%;
      min-height: 44px;
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 8px;
      align-items: center;
      padding: 8px 10px;
      border: 1px solid #d5dee7;
      border-radius: 6px;
      background: #f8fafc;
      color: #18222d;
      text-align: left;
    }
    .network strong {
      display: block;
      overflow-wrap: anywhere;
      font-size: 14px;
    }
    .network span { color: #5b6b7a; font-size: 12px; }
    .network:hover { border-color: #1267a5; background: #eef6fb; }
    .pin-list { display: grid; gap: 8px; margin-top: 10px; }
    .pin-row {
      display: grid;
      grid-template-columns: 72px 1fr 1fr;
      gap: 8px;
      align-items: center;
      padding: 8px 10px;
      border: 1px solid #d5dee7;
      border-radius: 6px;
      background: #f8fafc;
      font-size: 13px;
    }
    .pin-row.active { border-color: #0c7c59; background: #e9f8f2; }
    .pin-row strong { font-size: 14px; }
    .badge {
      display: inline-flex;
      align-items: center;
      min-height: 26px;
      padding: 0 9px;
      border-radius: 999px;
      background: #e8eef4;
      color: #344150;
      font-size: 13px;
      margin: 0 6px 6px 0;
    }
    .badge.ok { background: #d9f4e8; color: #0c6d4d; }
    .badge.warn { background: #fff0d1; color: #7a5200; }
    pre {
      height: 260px;
      overflow: auto;
      margin: 0;
      padding: 12px;
      border-radius: 6px;
      background: #111827;
      color: #d1fae5;
      font-size: 13px;
      line-height: 1.55;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
  <main>
    <h1>PH-4502C Live Monitor</h1>

    <div class="grid">
      <section class="panel">
        <h2>Current Reading</h2>
        <div class="reading" id="phBox"><span id="ph">--</span><small style="font-size:18px;"> pH</small></div>
        <div class="meta">
          Sensor voltage: <span id="sensorVoltage">--</span> V<br>
          ADC voltage: <span id="adcVoltage">--</span> V<br>
          Raw ADC: <span id="raw">--</span><br>
          Raw pH calculation: <span id="phRaw">--</span><br>
          Uptime: <span id="uptime">--</span>
        </div>
        <div class="warning-text" id="readingWarning"></div>
      </section>

      <section class="panel">
        <h2>Network Status</h2>
        <div id="statusBadges"></div>
        <div class="meta" id="networkText">Loading...</div>
      </section>

      <section class="panel">
        <h2>ADC Pin Check</h2>
        <div class="meta">
          Current pH input pin: GPIO<span id="currentPin">34</span><br>
          Pins above 0.20V are highlighted.
        </div>
        <div class="actions">
          <button class="secondary" type="button" id="scanAdc">Scan ADC Pins</button>
        </div>
        <div class="scan-status" id="adcScanStatus"></div>
        <div class="pin-list" id="adcPins"></div>
      </section>

      <section class="panel">
        <h2>WiFi Setup</h2>
        <form id="wifiForm">
          <label for="ssid">WiFi SSID</label>
          <input id="ssid" name="ssid" autocomplete="off" required>
          <label for="password">WiFi Password</label>
          <input id="password" name="password" type="password" autocomplete="new-password" placeholder="Leave empty for open WiFi">
          <div class="actions">
            <button type="submit">Save and Connect</button>
            <button class="secondary" type="button" id="scanWifi">Scan WiFi</button>
            <button class="secondary" type="button" id="clearWifi">Clear WiFi</button>
          </div>
        </form>
        <div class="scan-status" id="wifiScanStatus"></div>
        <div class="scan-list" id="wifiNetworks"></div>
      </section>
    </div>

    <section class="panel" style="margin-top:14px;">
      <h2>Data Log</h2>
      <pre id="log"></pre>
    </section>
  </main>

  <script>
    const logEl = document.getElementById('log');
    const ssidInput = document.getElementById('ssid');
    const scanButton = document.getElementById('scanWifi');
    const adcScanButton = document.getElementById('scanAdc');
    const scanStatusEl = document.getElementById('wifiScanStatus');
    const wifiNetworksEl = document.getElementById('wifiNetworks');
    const adcScanStatusEl = document.getElementById('adcScanStatus');
    const adcPinsEl = document.getElementById('adcPins');
    const maxLines = 80;
    const lines = [];
    let ssidTouched = false;

    function addLog(text) {
      const now = new Date().toLocaleTimeString();
      lines.unshift(`[${now}] ${text}`);
      while (lines.length > maxLines) lines.pop();
      logEl.textContent = lines.join('\n');
    }

    function secondsToText(ms) {
      const s = Math.floor(ms / 1000);
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      return `${h}h ${m}m ${s % 60}s`;
    }

    async function getJson(url, options) {
      const response = await fetch(url, options);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    }

    function renderNetworks(networks) {
      wifiNetworksEl.textContent = '';

      if (!networks.length) {
        scanStatusEl.textContent = 'No WiFi networks found.';
        return;
      }

      scanStatusEl.textContent = `${networks.length} WiFi network(s) found.`;

      for (const network of networks) {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'network';

        const name = document.createElement('strong');
        name.textContent = network.ssid || '(hidden network)';

        const detail = document.createElement('span');
        detail.textContent = `${network.rssi} dBm | CH ${network.channel} | ${network.auth}`;

        const lock = document.createElement('span');
        lock.textContent = network.open ? 'Open' : 'Secured';

        const left = document.createElement('div');
        left.appendChild(name);
        left.appendChild(detail);
        item.appendChild(left);
        item.appendChild(lock);

        item.addEventListener('click', () => {
          ssidInput.value = network.ssid;
          ssidTouched = true;
          document.getElementById('password').focus();
          addLog(`Selected WiFi SSID: ${network.ssid || '(hidden network)'}`);
        });

        wifiNetworksEl.appendChild(item);
      }
    }

    function renderAdcPins(pins) {
      adcPinsEl.textContent = '';

      if (!pins.length) {
        adcScanStatusEl.textContent = 'No ADC pin data returned.';
        return;
      }

      let best = pins[0];
      for (const pin of pins) {
        if (pin.raw > best.raw) best = pin;
      }

      adcScanStatusEl.textContent = `Highest signal: GPIO${best.pin}, ${best.voltage.toFixed(3)}V, raw=${best.raw}`;

      for (const pin of pins) {
        const row = document.createElement('div');
        row.className = `pin-row ${pin.voltage > 0.20 ? 'active' : ''}`;

        const name = document.createElement('strong');
        name.textContent = `GPIO${pin.pin}`;

        const voltage = document.createElement('span');
        voltage.textContent = `${pin.voltage.toFixed(3)} V`;

        const raw = document.createElement('span');
        raw.textContent = `raw ${pin.raw}`;

        row.appendChild(name);
        row.appendChild(voltage);
        row.appendChild(raw);
        adcPinsEl.appendChild(row);
      }
    }

    async function scanAdcPins() {
      adcScanButton.disabled = true;
      adcScanButton.textContent = 'Scanning...';
      adcScanStatusEl.textContent = 'Reading ADC pins...';
      adcPinsEl.textContent = '';

      try {
        const data = await getJson('/api/adc/scan');
        document.getElementById('currentPin').textContent = data.activePin || '34';
        renderAdcPins(data.pins || []);
        addLog('ADC pin scan complete');
      } catch (err) {
        adcScanStatusEl.textContent = `ADC scan failed: ${err.message}`;
        addLog(`ADC scan failed: ${err.message}`);
      } finally {
        adcScanButton.disabled = false;
        adcScanButton.textContent = 'Scan ADC Pins';
      }
    }

    async function scanWifi() {
      scanButton.disabled = true;
      scanButton.textContent = 'Scanning...';
      scanStatusEl.textContent = 'Scanning nearby WiFi networks...';
      wifiNetworksEl.textContent = '';

      try {
        const data = await getJson('/api/wifi/scan');
        renderNetworks(data.networks || []);
        addLog(`WiFi scan found ${(data.networks || []).length} network(s)`);
      } catch (err) {
        scanStatusEl.textContent = `WiFi scan failed: ${err.message}`;
        addLog(`WiFi scan failed: ${err.message}`);
      } finally {
        scanButton.disabled = false;
        scanButton.textContent = 'Scan WiFi';
      }
    }

    async function refreshStatus() {
      try {
        const data = await getJson('/api/status');
        if (!ssidTouched && document.activeElement !== ssidInput) {
          ssidInput.value = data.savedSsid || '';
        }
        document.getElementById('networkText').innerHTML =
          `Setup AP: ${data.apSsid}, IP: ${data.apIp}<br>` +
          `WiFi: ${data.savedSsid || 'not configured'}, IP: ${data.staIp || '--'}<br>` +
          `RSSI: ${data.rssi || '--'} dBm`;

        const badges = [];
        badges.push(`<span class="badge ${data.staConnected ? 'ok' : 'warn'}">WiFi ${data.staConnected ? 'connected' : 'offline'}</span>`);
        badges.push(`<span class="badge ${data.mqttConnected ? 'ok' : 'warn'}">MQTT ${data.mqttConnected ? 'connected' : 'offline'}</span>`);
        document.getElementById('statusBadges').innerHTML = badges.join('');
      } catch (err) {
        addLog(`Status read failed: ${err.message}`);
      }
    }

    async function refreshReading() {
      try {
        const data = await getJson('/api/reading');
        const validPh = data.ph !== null;
        document.getElementById('ph').textContent = validPh ? data.ph.toFixed(2) : 'INVALID';
        document.getElementById('phBox').classList.toggle('invalid', !validPh);
        document.getElementById('sensorVoltage').textContent = data.sensorVoltage.toFixed(3);
        document.getElementById('adcVoltage').textContent = data.adcVoltage.toFixed(3);
        document.getElementById('raw').textContent = data.raw;
        document.getElementById('phRaw').textContent = data.phRaw === null ? '--' : data.phRaw.toFixed(2);
        document.getElementById('uptime').textContent = secondsToText(data.uptimeMs);
        document.getElementById('readingWarning').textContent = data.warning || '';
        addLog(`pH=${validPh ? data.ph.toFixed(2) : 'INVALID'}, rawPH=${data.phRaw === null ? '--' : data.phRaw.toFixed(2)}, sensor=${data.sensorVoltage.toFixed(3)}V, adc=${data.adcVoltage.toFixed(3)}V, raw=${data.raw}`);
      } catch (err) {
        addLog(`Reading read failed: ${err.message}`);
      }
    }

    document.getElementById('wifiForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      try {
        const data = await getJson('/api/wifi', { method: 'POST', body: new URLSearchParams(formData) });
        ssidTouched = false;
        addLog(data.message);
        setTimeout(refreshStatus, 1000);
      } catch (err) {
        addLog(`WiFi save failed: ${err.message}`);
      }
    });

    document.getElementById('clearWifi').addEventListener('click', async () => {
      try {
        const data = await getJson('/api/wifi/reset', { method: 'POST' });
        ssidInput.value = '';
        document.getElementById('password').value = '';
        ssidTouched = false;
        addLog(data.message);
        setTimeout(refreshStatus, 1000);
      } catch (err) {
        addLog(`WiFi clear failed: ${err.message}`);
      }
    });

    ssidInput.addEventListener('input', () => {
      ssidTouched = true;
    });

    scanButton.addEventListener('click', scanWifi);
    adcScanButton.addEventListener('click', scanAdcPins);

    refreshStatus();
    refreshReading();
    setInterval(refreshStatus, 3000);
    setInterval(refreshReading, 2000);
  </script>
</body>
</html>
)rawliteral";

template <typename T>
float trimmedAverage(T *values, size_t count, size_t discardEachSide) {
  std::sort(values, values + count);

  const size_t start = discardEachSide;
  const size_t end = count - discardEachSide;
  float total = 0.0f;

  for (size_t i = start; i < end; i++) {
    total += values[i];
  }

  return total / static_cast<float>(end - start);
}

float calculatePh(float sensorVoltage) {
  if (fabsf(PH_SECOND_VOLTAGE - PH7_VOLTAGE) < 0.001f) {
    return NAN;
  }

  const float slope = (PH_SECOND_VALUE - PH7_VALUE) / (PH_SECOND_VOLTAGE - PH7_VOLTAGE);
  const float intercept = PH7_VALUE - slope * PH7_VOLTAGE;
  return slope * sensorVoltage + intercept;
}

bool isValidPh(float ph) {
  return !isnan(ph) && ph >= 0.0f && ph <= 14.0f;
}

uint16_t readRawAverage(int pin, size_t count) {
  uint32_t total = 0;

  for (size_t i = 0; i < count; i++) {
    total += analogRead(pin);
    delay(4);
  }

  return static_cast<uint16_t>(total / count);
}

float readMillivoltsAverage(int pin, size_t count) {
  uint32_t total = 0;

  for (size_t i = 0; i < count; i++) {
    total += analogReadMilliVolts(pin);
    delay(4);
  }

  return static_cast<float>(total) / static_cast<float>(count);
}

PhReading readPh() {
  uint16_t rawSamples[SAMPLE_COUNT];
  uint16_t millivoltSamples[SAMPLE_COUNT];

  for (size_t i = 0; i < SAMPLE_COUNT; i++) {
    rawSamples[i] = analogRead(PH_ANALOG_PIN);
    millivoltSamples[i] = analogReadMilliVolts(PH_ANALOG_PIN);
    delay(20);
  }

  const float raw = trimmedAverage(rawSamples, SAMPLE_COUNT, DISCARD_EACH_SIDE);
  const float adcVoltage = trimmedAverage(millivoltSamples, SAMPLE_COUNT, DISCARD_EACH_SIDE) / 1000.0f;
  const float sensorVoltage = adcVoltage * VOLTAGE_DIVIDER_RATIO;

  PhReading reading;
  reading.raw = static_cast<uint16_t>(raw);
  reading.adcVoltage = adcVoltage;
  reading.sensorVoltage = sensorVoltage;
  reading.ph = calculatePh(sensorVoltage);
  return reading;
}

bool hasStaCredentials() {
  return wifiSsid.length() > 0 && wifiSsid != "YOUR_WIFI_SSID";
}

String jsonEscape(const String &value) {
  String escaped;
  escaped.reserve(value.length() + 8);

  for (size_t i = 0; i < value.length(); i++) {
    const char c = value[i];

    switch (c) {
      case '"':
        escaped += "\\\"";
        break;
      case '\\':
        escaped += "\\\\";
        break;
      case '\n':
        escaped += "\\n";
        break;
      case '\r':
        escaped += "\\r";
        break;
      case '\t':
        escaped += "\\t";
        break;
      default:
        escaped += c;
        break;
    }
  }

  return escaped;
}

String readingToJson(const PhReading &reading) {
  char payload[512];
  const bool valid = isValidPh(reading.ph);
  const String phValue = valid ? String(reading.ph, 2) : "null";
  const String phRawValue = isnan(reading.ph) ? "null" : String(reading.ph, 2);

  snprintf(
    payload,
    sizeof(payload),
    "{\"deviceId\":\"%s\",\"ph\":%s,\"phRaw\":%s,\"valid\":%s,"
    "\"sensorVoltage\":%.3f,\"adcVoltage\":%.3f,\"raw\":%u,"
    "\"rssi\":%ld,\"uptimeMs\":%lu,\"warning\":\"%s\"}",
    DEVICE_ID,
    phValue.c_str(),
    phRawValue.c_str(),
    valid ? "true" : "false",
    reading.sensorVoltage,
    reading.adcVoltage,
    reading.raw,
    WiFi.status() == WL_CONNECTED ? static_cast<long>(WiFi.RSSI()) : 0,
    static_cast<unsigned long>(millis()),
    valid ? "" : "pH is outside 0-14. Check PO wiring, common GND, sensor power, and calibration voltages."
  );

  return String(payload);
}

void loadWiFiConfig() {
  preferences.begin("netcfg", false);
  wifiSsid = preferences.getString("ssid", DEFAULT_WIFI_SSID);
  wifiPassword = preferences.getString("pass", DEFAULT_WIFI_PASSWORD);
}

void saveWiFiConfig(const String &ssid, const String &password) {
  wifiSsid = ssid;
  wifiPassword = password;
  preferences.putString("ssid", wifiSsid);
  preferences.putString("pass", wifiPassword);
}

void clearWiFiConfig() {
  wifiSsid = "";
  wifiPassword = "";
  preferences.remove("ssid");
  preferences.remove("pass");
}

void beginStaConnection() {
  if (!hasStaCredentials()) {
    Serial.println("WiFi STA skipped: no saved credentials");
    return;
  }

  Serial.print("Connecting WiFi SSID: ");
  Serial.println(wifiSsid);

  if (wifiPassword.length() > 0) {
    WiFi.begin(wifiSsid.c_str(), wifiPassword.c_str());
  } else {
    WiFi.begin(wifiSsid.c_str());
  }

  lastStaAttemptMs = millis();
}

void maintainWiFi() {
  if (!hasStaCredentials() || WiFi.status() == WL_CONNECTED) {
    return;
  }

  const uint32_t now = millis();
  if (now - lastStaAttemptMs >= WIFI_RETRY_INTERVAL_MS) {
    beginStaConnection();
  }
}

void maintainMqtt() {
  if (WiFi.status() != WL_CONNECTED) {
    return;
  }

  if (mqtt.connected()) {
    mqtt.loop();
    return;
  }

  const uint32_t now = millis();
  if (now - lastMqttAttemptMs < MQTT_RETRY_INTERVAL_MS) {
    return;
  }
  lastMqttAttemptMs = now;

  Serial.print("Connecting MQTT...");

  char clientId[64];
  snprintf(clientId, sizeof(clientId), "%s-%08lX", DEVICE_ID, static_cast<unsigned long>(ESP.getEfuseMac()));

  bool ok;
  if (strlen(MQTT_USER) > 0) {
    ok = mqtt.connect(clientId, MQTT_USER, MQTT_PASSWORD);
  } else {
    ok = mqtt.connect(clientId);
  }

  if (ok) {
    Serial.println("connected");
  } else {
    Serial.print("failed, rc=");
    Serial.println(mqtt.state());
  }
}

void updateReadingIfDue() {
  const uint32_t now = millis();
  if (hasReading && now - lastSampleMs < SAMPLE_INTERVAL_MS) {
    return;
  }

  lastReading = readPh();
  lastSampleMs = millis();
  hasReading = true;
  Serial.println(readingToJson(lastReading));
}

void publishReadingIfDue() {
  if (!hasReading || !mqtt.connected()) {
    return;
  }

  const uint32_t now = millis();
  if (now - lastPublishMs < PUBLISH_INTERVAL_MS) {
    return;
  }

  lastPublishMs = now;
  const String payload = readingToJson(lastReading);
  mqtt.publish(MQTT_TOPIC, payload.c_str());
}

void sendJson(const String &payload) {
  server.sendHeader("Cache-Control", "no-store");
  server.send(200, "application/json; charset=utf-8", payload);
}

void handleRoot() {
  server.sendHeader("Cache-Control", "no-store");
  server.send_P(200, "text/html; charset=utf-8", INDEX_HTML);
}

void handleStatus() {
  const bool staConnected = WiFi.status() == WL_CONNECTED;
  const bool hasWifiConfig = hasStaCredentials();

  String json = "{";
  json += "\"deviceId\":\"";
  json += DEVICE_ID;
  json += "\",\"savedSsid\":\"";
  json += hasWifiConfig ? jsonEscape(wifiSsid) : "";
  json += "\",\"staConnected\":";
  json += (staConnected ? "true" : "false");
  json += ",\"staIp\":\"";
  json += (staConnected ? WiFi.localIP().toString() : "");
  json += "\",\"apSsid\":\"";
  json += AP_SSID;
  json += "\",\"apIp\":\"";
  json += WiFi.softAPIP().toString();
  json += "\",\"mqttConnected\":";
  json += (mqtt.connected() ? "true" : "false");
  json += ",\"rssi\":";
  json += (staConnected ? String(WiFi.RSSI()) : "0");
  json += ",\"uptimeMs\":";
  json += String(millis());
  json += "}";
  sendJson(json);
}

void handleReading() {
  updateReadingIfDue();
  sendJson(readingToJson(lastReading));
}

void handleAdcScan() {
  const size_t sampleCount = 12;
  String json = "{\"activePin\":";
  json += String(PH_ANALOG_PIN);
  json += ",\"pins\":[";

  for (size_t i = 0; i < ADC_DIAG_PIN_COUNT; i++) {
    const int pin = ADC_DIAG_PINS[i];
    const uint16_t raw = readRawAverage(pin, sampleCount);
    const float voltage = readMillivoltsAverage(pin, sampleCount) / 1000.0f;

    if (i > 0) {
      json += ",";
    }

    json += "{\"pin\":";
    json += String(pin);
    json += ",\"raw\":";
    json += String(raw);
    json += ",\"voltage\":";
    json += String(voltage, 3);
    json += "}";
  }

  json += "]}";
  sendJson(json);
}

const char *authModeToText(wifi_auth_mode_t authMode) {
  switch (authMode) {
    case WIFI_AUTH_OPEN:
      return "OPEN";
    case WIFI_AUTH_WEP:
      return "WEP";
    case WIFI_AUTH_WPA_PSK:
      return "WPA";
    case WIFI_AUTH_WPA2_PSK:
      return "WPA2";
    case WIFI_AUTH_WPA_WPA2_PSK:
      return "WPA/WPA2";
    case WIFI_AUTH_WPA2_ENTERPRISE:
      return "WPA2-ENT";
    default:
      return "SECURED";
  }
}

void handleWiFiScan() {
  Serial.println("Scanning WiFi networks...");
  const int networkCount = WiFi.scanNetworks(false, true);

  if (networkCount < 0) {
    server.send(500, "application/json; charset=utf-8", "{\"message\":\"wifi scan failed\"}");
    return;
  }

  const int maxNetworks = 20;
  const int resultCount = networkCount > maxNetworks ? maxNetworks : networkCount;
  String json = "{\"count\":";
  json += String(networkCount);
  json += ",\"networks\":[";

  for (int i = 0; i < resultCount; i++) {
    const wifi_auth_mode_t authMode = WiFi.encryptionType(i);

    if (i > 0) {
      json += ",";
    }

    json += "{\"ssid\":\"";
    json += jsonEscape(WiFi.SSID(i));
    json += "\",\"rssi\":";
    json += String(WiFi.RSSI(i));
    json += ",\"channel\":";
    json += String(WiFi.channel(i));
    json += ",\"auth\":\"";
    json += authModeToText(authMode);
    json += "\",\"open\":";
    json += authMode == WIFI_AUTH_OPEN ? "true" : "false";
    json += "}";
  }

  json += "]}";
  WiFi.scanDelete();
  sendJson(json);
}

void handleWiFiSave() {
  if (!server.hasArg("ssid")) {
    server.send(400, "application/json; charset=utf-8", "{\"message\":\"missing ssid\"}");
    return;
  }

  const String ssid = server.arg("ssid");
  const String password = server.arg("password");

  if (ssid.length() == 0) {
    server.send(400, "application/json; charset=utf-8", "{\"message\":\"ssid is empty\"}");
    return;
  }

  saveWiFiConfig(ssid, password);
  WiFi.disconnect(false);
  beginStaConnection();

  String json = "{\"message\":\"WiFi saved, connecting to ";
  json += jsonEscape(wifiSsid);
  json += "\"}";
  sendJson(json);
}

void handleWiFiReset() {
  clearWiFiConfig();
  WiFi.disconnect(false);
  sendJson("{\"message\":\"WiFi config cleared. Setup AP is still available.\"}");
}

void handleNotFound() {
  server.sendHeader("Location", "/", true);
  server.send(302, "text/plain", "");
}

void setupWebServer() {
  server.on("/", HTTP_GET, handleRoot);
  server.on("/api/status", HTTP_GET, handleStatus);
  server.on("/api/reading", HTTP_GET, handleReading);
  server.on("/api/adc/scan", HTTP_GET, handleAdcScan);
  server.on("/api/wifi/scan", HTTP_GET, handleWiFiScan);
  server.on("/api/wifi", HTTP_POST, handleWiFiSave);
  server.on("/api/wifi/reset", HTTP_POST, handleWiFiReset);
  server.onNotFound(handleNotFound);
  server.begin();
}

void setupWiFi() {
  WiFi.mode(WIFI_AP_STA);
  WiFi.softAP(AP_SSID, AP_PASSWORD);
  dnsServer.start(DNS_PORT, "*", WiFi.softAPIP());

  Serial.print("Setup AP SSID: ");
  Serial.println(AP_SSID);
  Serial.print("Setup AP IP: ");
  Serial.println(WiFi.softAPIP());

  beginStaConnection();
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  analogReadResolution(12);
  analogSetPinAttenuation(PH_ANALOG_PIN, ADC_11db);

  for (size_t i = 0; i < ADC_DIAG_PIN_COUNT; i++) {
    analogSetPinAttenuation(ADC_DIAG_PINS[i], ADC_11db);
  }

  loadWiFiConfig();
  setupWiFi();
  setupWebServer();
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setSocketTimeout(2);
}

void loop() {
  dnsServer.processNextRequest();
  server.handleClient();
  maintainWiFi();
  maintainMqtt();
  updateReadingIfDue();
  publishReadingIfDue();
}
