# homebridge-sunset-lamp-ble

Homebridge plugin for [this specific sunset lamp](https://ja.aliexpress.com/item/1005002359444838.html), though in theory it should work with any ["iStrip+"](https://apps.apple.com/us/app/istrip/id1524125189) compatible lamp. This plugin has an encryption key that is hardcoded in the device so it likely will not work with other devices.

# Installation and Configuration

Install with npm or the homebridge UI:

```
npm install homebridge-sunset-lamp-ble
```

Add an accessory and configure the `name` (anything you like!) and `ble_address` (of the lamp, must be in lowercase) like below:
```
{
    "accessory": "SunsetLamp",
    "name": "Sunset Lamp",
    "ble_address": "xx:xx:xx:xx:xx:xx"
},
```

If you need to find the address of your lamp, you can add an accessory with no `ble_address` and check your homebridge logs. It seems these particular lamps always advertise with a name in the format of `SSL-DDEEFF` where `DDEEFF` is the last 6 letters of the address.

For example, with the logs:

```
[11/6/2021, 7:29:29 AM] [Sunset Lamp] Discovered:  SSL-DDEEFF  (aa:bb:cc:dd:ee:ff)
```

You can set the `ble_address` to:

```
...
    "ble_address": "aa:bb:cc:dd:ee:ff"
...
```

# Limitations

* The lamps can only handle one connection at a time and do not automatically disconnect so you may have to turn the lamp on/off to get it to initially connect in Homebridge. I recommend installing and testing [noble](https://www.npmjs.com/package/@abandonware/noble) separately too before trying this plugin.
* The lamp does not provide any information of it's current state (or at least the "iStrip+" app I reverse engineered does not implement this) - it will always default to being off in homebridge when starting even if the lamp is already on.

# Credit

This is essentially a fork of [homebridge-led-strip-ble](https://github.com/stoner221/homebridge-led-strip-ble) modified to work with the encryption in place on this lamp, so huge credit to [stoner221](https://github.com/stoner221/) for the homebridge integration.
