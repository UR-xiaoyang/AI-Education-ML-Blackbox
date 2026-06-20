# ESP32 + PH-4502C pH 传感器网页监测 / MQTT 上报

这个示例让 ESP32 读取 PH-4502C 板子的 `PO` 模拟输出，并提供两个能力：

- ESP32 自带网页：修改 WiFi、查看实时 pH 数据、把数据打印在网页日志里。
- MQTT 上报：ESP32 连上路由器 WiFi 后，把读数发布到 MQTT 主题。

## 需要的库

在 Arduino IDE 的 Library Manager 安装：

- `PubSubClient`

下面这些库来自 ESP32 Arduino Core，通常不需要单独安装：

- `WiFi`
- `WebServer`
- `DNSServer`
- `Preferences`

开发板选择常见的 `ESP32 Dev Module` 即可。

## 接线

推荐只使用 PH-4502C 的模拟输出：

| PH-4502C | ESP32 |
| --- | --- |
| `GND` | `GND` |
| `V+` | `3V3` 或 `5V` |
| `PO` | `GPIO34` |

注意：ESP32 ADC 引脚最高只能承受 `3.3V`。如果 PH-4502C 使用 `5V` 供电，`PO` 可能超过 `3.3V`，不能直接接 ESP32。

5V 供电时建议加分压：

```text
PH-4502C PO ---- 10kΩ ---- GPIO34
                         |
                        20kΩ
                         |
                        GND
```

使用这个 10kΩ/20kΩ 分压后，把代码里的：

```cpp
constexpr float VOLTAGE_DIVIDER_RATIO = 1.0f;
```

改成：

```cpp
constexpr float VOLTAGE_DIVIDER_RATIO = 1.5f;
```

## 网页使用方式

1. 烧录 `esp32_ph4502c_mqtt.ino`。
2. ESP32 启动后会创建热点：

```text
WiFi 名称：PH4502C-Setup
WiFi 密码：12345678
```

3. 手机或电脑连接这个热点。
4. 浏览器打开：

```text
http://192.168.4.1
```

5. 网页里可以看到实时 pH、传感器电压、ADC 电压、原始 ADC，并会持续打印数据日志。
6. 在网页的 `WiFi Setup` 区域点击 `Scan WiFi`，选择附近的 WiFi，输入密码后点击 `Save and Connect`。

ESP32 会一直保留 `PH4502C-Setup` 配置热点，所以 WiFi 密码填错也可以重新进入网页修改。

如果 ESP32 成功连上路由器，网页的 `Network Status` 会显示路由器分配的 `STA IP`。之后你也可以在同一个局域网里打开这个 IP 访问网页。

## 代码配置

MQTT 默认配置在代码顶部：

```cpp
const char *MQTT_HOST = "broker.emqx.io";
const uint16_t MQTT_PORT = 1883;
const char *MQTT_USER = "";
const char *MQTT_PASSWORD = "";
const char *DEVICE_ID = "esp32-ph-001";
const char *MQTT_TOPIC = "sensors/ph/esp32-ph-001";
```

`broker.emqx.io` 是公共测试服务器，只适合临时调试。正式项目建议换成自己的 MQTT 服务器或物联网平台地址。

配置热点密码在这里：

```cpp
const char *AP_PASSWORD = "12345678";
```

正式使用时建议改成你自己的密码。

## API 接口

网页内部使用这些接口：

```text
GET  /api/status
GET  /api/reading
GET  /api/adc/scan
GET  /api/wifi/scan
POST /api/wifi
POST /api/wifi/reset
```

`/api/reading` 返回示例：

```json
{
  "deviceId": "esp32-ph-001",
  "ph": 6.86,
  "sensorVoltage": 2.523,
  "adcVoltage": 2.523,
  "raw": 3120,
  "rssi": -52,
  "uptimeMs": 15000
}
```

## 校准

pH 传感器必须校准，否则读数只能当参考。

1. 上传代码，打开串口监视器，波特率 `115200`。
2. 把探头放入 pH 7.00 标准缓冲液，等待读数稳定，记录网页或串口里的 `sensorVoltage`。
3. 把这个电压写入：

```cpp
constexpr float PH7_VALUE = 7.00f;
constexpr float PH7_VOLTAGE = 2.500f;
```

4. 清洗探头后放入 pH 4.00 或 pH 10.00 标准缓冲液，等待稳定，记录 `sensorVoltage`。
5. 把第二个校准点写入：

```cpp
constexpr float PH_SECOND_VALUE = 4.00f;
constexpr float PH_SECOND_VOLTAGE = 3.000f;
```

如果你使用 pH 10.00 缓冲液，就写成：

```cpp
constexpr float PH_SECOND_VALUE = 10.00f;
constexpr float PH_SECOND_VOLTAGE = 你的实测电压;
```

## 常见问题

- pH 一直是 `21.15` 或显示 `INVALID`：这通常说明 `sensorVoltage` 太低，当前默认公式下 `21.15` 大约对应 `0.14V`。请优先检查 `PO` 是否接到 `GPIO34`、是否和 ESP32 共地、PH-4502C 是否正确供电、是否误接了 `DO` 而不是 `PO`。网页里的 `ADC Pin Check` 可以扫描 GPIO32/33/34/35/36/39，帮助确认传感器实际接到了哪个 ADC 引脚。正常校准附近，pH 7.00 对应的 `sensorVoltage` 应接近你代码里的 `PH7_VOLTAGE`，默认是 `2.500V`。
- 如果 PH-4502C 用 `5V` 供电，不要把 `PO` 直接接 ESP32 ADC。需要分压，或者确认 `PO` 永远不会超过 `3.3V`。
- 可以用万用表直接量 PH-4502C 的 `PO` 到 `GND`。如果万用表也是约 `0.14V`，问题在传感器板/探头/校准电位器；如果万用表正常而网页很低，问题在 ESP32 引脚或接线。
- pH 值跳动：增加采样次数、缩短探头线、保证 GND 共地，探头远离水泵、继电器等干扰源。
- 读数一直不准：先用 pH 7.00 和 pH 4.00/10.00 缓冲液重新校准，不要只改一个 offset。
- ADC 读数满量程：检查 `PO` 是否超过 `3.3V`，必要时使用分压。
- 打不开网页：先确认手机/电脑连接的是 `PH4502C-Setup` 热点，再访问 `http://192.168.4.1`。
