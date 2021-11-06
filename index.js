  var Noble = require('@abandonware/noble');
  var aesjs = require("aes-js");
  var Service, Characteristic;

  module.exports = function(homebridge) {
      Service = homebridge.hap.Service;
      Characteristic = homebridge.hap.Characteristic;
      homebridge.registerAccessory("homebridge-sunset-lamp-ble", "SunsetLamp", sunset_lamp);
  }

  function sunset_lamp(log, config) {
      this.log = log;
      this.config = config;
      this.name = config['name'] || 'Sunset Lamp';
      this.address = config['ble_address'];
      this.peripheral_selected = null;
      this.scanning = false;
      this.write_characteristic = null;

      // doesn't support reading status so default to off
      this.power_state = false;
      this.hue = 0;
      this.saturation = 0;
      this.brightness = 0;

      this.light_service = new Service.Lightbulb(this.name);

      this.light_service
          .getCharacteristic(Characteristic.On)
          .on('set', this.set_power_state.bind(this))
          .on('get', this.get_power_state.bind(this));
      this.light_service
          .addCharacteristic(new Characteristic.Brightness())
          .on('set', this.set_brightness.bind(this))
          .on('get', this.get_brightness.bind(this));
      this.light_service
          .addCharacteristic(new Characteristic.Saturation())
          .on('set', this.set_saturation.bind(this))
          .on('get', this.get_saturation.bind(this));
      this.light_service
          .addCharacteristic(new Characteristic.Hue())
          .on('set', this.set_hue.bind(this))
          .on('get', this.get_hue.bind(this));

      Noble.on('stateChange', this.noble_state_change.bind(this));
      Noble.on('scanStop', this.noble_scan_stop.bind(this));
  }

  sunset_lamp.prototype.get_information_service = function() {
      var informationService = new Service.AccessoryInformation();
      informationService
          .setCharacteristic(Characteristic.Name, this.name)
          .setCharacteristic(Characteristic.SerialNumber, this.address);
      return informationService;
  }

  sunset_lamp.prototype.getServices = function() {
      return [this.light_service, this.get_information_service()];
  }

  sunset_lamp.prototype.set_power_state = function(power_state, callback) {
      this.log.debug("Set Power State: " + power_state);
      this.power_state = power_state;
      this.write_to_lamp(function() {
          callback(null);
      });
  }

  sunset_lamp.prototype.set_brightness = function(value, callback) {
      this.brightness = value;
      this.write_to_lamp(function() {
          callback(null);
      });
  }

  sunset_lamp.prototype.set_saturation = function(value, callback) {
      this.saturation = value;
      this.write_to_lamp(function() {
          callback(null);
      });
  }

  sunset_lamp.prototype.set_hue = function(value, callback) {
      this.hue = value;
      this.write_to_lamp(function() {
          callback(null);
      });
  }

  sunset_lamp.prototype.get_power_state = function(callback) {
      callback(null, this.power_state);
  }

  sunset_lamp.prototype.get_brightness = function(callback) {
      callback(null, this.brightness);
  }

  sunset_lamp.prototype.get_saturation = function(callback) {
      callback(null, this.saturation);
  }

  sunset_lamp.prototype.get_hue = function(callback) {
      callback(null, this.hue);
  }

  sunset_lamp.prototype.noble_state_change = function(state) {
      if (state == "poweredOn") {
          this.log.debug("Starting BLE scan");
          Noble.on("discover", this.noble_discovered.bind(this));
          this.start_scanning_with_timeout();
          this.scanning = true;
      } else {
          this.log.debug("BLE state change to " + state + "; stopping scan.");
          Noble.removeAllListeners('scanStop');
          Noble.stopScanning();
          this.scanning = false;
      }
  }

  sunset_lamp.prototype.noble_discovered = function(accessory) {
      var peripheral = accessory;

      if (peripheral && peripheral.advertisement) {
          this.log.info("Discovered: ", peripheral.advertisement.localName, " (" + peripheral.address + ")");
      }

      if (this.peripheral_selected == null) {
          this.log.debug("Peripheral Empty");
          if (peripheral.address == this.address) {
              this.log.debug("Device Found Starting Connection");
              this.peripheral_selected = peripheral;
              this.stop_scanning();
              this.scanning = false;

              accessory.connect(function(error) {
                  this.noble_connected(error, accessory);
              }.bind(this));
          }
      } else {
          this.log.debug("Peripheral Not Empty");
          if (peripheral.address == this.address) {
              this.log.info("Reconnected to lamp");
              this.peripheral_selected = peripheral;

              if (this.peripheral_selected.state != "connected") {
                  Noble.stopScanning();
                  this.scanning = false;

                  accessory.connect(function(error) {
                      this.noble_connected(error, accessory);
                  }.bind(this));
              }
          }
      }
  }

  sunset_lamp.prototype.noble_connected = function(error, accessory) {
      if (error) {
          return this.log.error("Noble connection failed: " + error);
      }
      this.log.debug("Connection success, discovering services");
      Noble.stopScanning();
      accessory.discoverServices(["0000ac501212efde1523785fedbeda25"], this.noble_services_discovered.bind(this));

      accessory.on('disconnect', function(error) {
          this.noble_disconnected(error, accessory);
      }.bind(this));
  }

  sunset_lamp.prototype.noble_services_discovered = function(error, services) {
      if (error) {
          return this.log.error("BLE services discovery failed: " + error);
      }
      for (var service of services) {
          service.discoverCharacteristics(["0000ac521212efde1523785fedbeda25"], this.noble_characteristics_discovered.bind(this));
      }
  }

  sunset_lamp.prototype.noble_characteristics_discovered = function(error, characteristics) {
      if (error) {
          return this.log.error("BLE characteristic discovery failed: " + error);
      }

      for (var characteristic of characteristics) {
          this.log.debug("Found Characteristic: " + characteristic.uuid);

          if (characteristic.uuid == "0000ac521212efde1523785fedbeda25") {
              this.log.debug("Found Write Characteristic: " + characteristic.uuid);
              this.write_characteristic = characteristic;
              this.log.info("Ready to go! :)")
              Noble.stopScanning();
          }
      }
  }

  sunset_lamp.prototype.start_scanning_with_timeout = function() {
      Noble.startScanning();

      setTimeout(function() {
          if (Noble.listenerCount('discover') == 0) {
              return;
          }
          this.log.debug('Discovery timeout');
          Noble.stopScanning();
          this.scanning = false;
      }.bind(this), 12500);
  }

  sunset_lamp.prototype.noble_disconnected = function(error, accessory) {
      this.log.debug("Disconnected from " + accessory.address + ": " + (error ? error : "(No error)"));
      this.write_characteristic = null;
      accessory.removeAllListeners('disconnect');
      this.log.debug("Restarting BLE scan");
      Noble.startScanning([], false);
  }

  sunset_lamp.prototype.noble_scan_stop = function() {
      this.log.debug("Scan Stop received");
      this.scanning = false;
  }

  sunset_lamp.prototype.stop_scanning = function() {
      Noble.removeListener('discover', this.noble_discovered.bind(this));

      if (Noble.listenerCount('discover') == 0) {
          Noble.removeAllListeners('scanStop');
          Noble.stopScanning();
      }
  }

  sunset_lamp.prototype.write_to_lamp = function(callback) {
      this.log.info("Writing to lamp");

      if (this.write_characteristic == null) {
          this.log.warn("Characteristic not yet found. Skipping..");
          callback(false);
          return;
      }

      if (this.power_state) {
          var rgb = this.hsv_2_rgb(this.hue, this.saturation, this.brightness);
          const colorBuff = Buffer.from(this.light_color_message(rgb.red, rgb.green, rgb.blue));
          this.log.debug("Sending " + colorBuff.toString('hex') + " color buff to light");
          this.write_characteristic.write(colorBuff, true);
          const brightBuff = Buffer.from(this.light_brightness_message(this.brightness));
          this.log.debug("Sending " + brightBuff.toString('hex') + " brightness buff to light");
          this.write_characteristic.write(brightBuff, true);
      } else {
          const offBuff = Buffer.from(this.light_color_message(0, 0, 0));
          this.log.debug("Sending " + offBuff.toString('hex') + " off buff to light");
          this.write_characteristic.write(offBuff, true);
      }

      callback();
  }

  sunset_lamp.prototype.light_color_message = function(red, green, blue) {
      var aes = new aesjs.ModeOfOperation.ecb(new Uint8Array([0x34, 0x52, 0x2a, 0x5b, 0x7a, 0x6e, 0x49, 0x2c, 0x08, 0x09, 0x0a, 0x9d, 0x8d, 0x2a, 0x23, 0xf8]));
      return aes.encrypt(new Uint8Array([84, 82, 0, 87, 2, 1, 0, red, green, blue, 100, 100, 0, 0, 0, 0]));
  }

  sunset_lamp.prototype.light_brightness_message = function(brightness) {
      var aes = new aesjs.ModeOfOperation.ecb(new Uint8Array([0x34, 0x52, 0x2a, 0x5b, 0x7a, 0x6e, 0x49, 0x2c, 0x08, 0x09, 0x0a, 0x9d, 0x8d, 0x2a, 0x23, 0xf8]));
      return aes.encrypt(new Uint8Array([84, 82, 0, 87, 7, 1, brightness, 0, 0, 0, 0, 0, 0, 0, 0, 0]));
  }

  sunset_lamp.prototype.hsv_2_rgb = function(h, s, v) {
      var r, g, b;
      var i;
      var f, p, q, t;

      h = Math.max(0, Math.min(360, h));
      s = Math.max(0, Math.min(100, s));
      v = Math.max(0, Math.min(100, v));
      s /= 100;
      v /= 100;

      if (s == 0) {
          r = g = b = v;
          return {
              red: Math.round(r * 255),
              green: Math.round(g * 255),
              blue: Math.round(b * 255)
          };
      }

      h /= 60;
      i = Math.floor(h);
      f = h - i;
      p = v * (1 - s);
      q = v * (1 - s * f);
      t = v * (1 - s * (1 - f));

      switch (i) {
          case 0:
              r = v;
              g = t;
              b = p;
              break;
          case 1:
              r = q;
              g = v;
              b = p;
              break;
          case 2:
              r = p;
              g = v;
              b = t;
              break;
          case 3:
              r = p;
              g = q;
              b = v;
              break;
          case 4:
              r = t;
              g = p;
              b = v;
              break;
          default:
              r = v;
              g = p;
              b = q;
      }

      return {
          red: Math.round(r * 255),
          green: Math.round(g * 255),
          blue: Math.round(b * 255)
      };
  }