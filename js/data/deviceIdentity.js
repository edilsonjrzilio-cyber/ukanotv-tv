/*
 * Porta de tv-app/android/.../data/DeviceIdentity.kt. Na Samsung o
 * deviceUid/MAC/código saem do DUID da TV (id de hardware, igual ao
 * ANDROID_ID), então continuam os mesmos depois de atualizar a TV ou
 * reinstalar o app. Só se a TV não informar o DUID é que são gerados uma
 * vez e guardados em localStorage (some se o app for desinstalado).
 */
(function (global) {
  "use strict";

  var KEY = {
    UID: "device_uid_v1",
    MAC: "device_mac_v1",
    CODE: "device_code_v1"
  };
  function uuidV4() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      var v = c === "x" ? r : r & 0x3 | 0x8;
      return v.toString(16);
    });
  }
  function randomMac() {
    var parts = [];
    for (var i = 0; i < 6; i++) parts.push(Math.floor(Math.random() * 256).toString(16).padStart(2, "0"));
    return parts.join(":");
  }
  function randomCode() {
    return String(Math.floor(10000000 + Math.random() * 90000000));
  }
  function getOrCreate(key, generator) {
    var existing = localStorage.getItem(key);
    if (existing) return existing;
    var value = generator();
    try {
      localStorage.setItem(key, value);
    } catch (e) {}
    return value;
  }

  // TV que expõe um id de hardware estável (Samsung: DUID, ver
  // platform-tizen.js): MAC/código/uid saem dele, então reinstalar o app não
  // vira "outro aparelho" no painel (mesma ideia do ANDROID_ID). Hash simples
  // e determinístico (FNV-1a), não precisa ser criptográfico.
  function seedHash(seed, salt) {
    var h = 0x811c9dc5;
    var s = salt + ":" + seed;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0;
    }
    return h >>> 0;
  }
  function hex8(n) {
    return ("00000000" + n.toString(16)).slice(-8);
  }
  function fromSeed(seed) {
    var a = hex8(seedHash(seed, "uid1")),
      b = hex8(seedHash(seed, "uid2")),
      c = hex8(seedHash(seed, "uid3")),
      d = hex8(seedHash(seed, "uid4"));
    var m = hex8(seedHash(seed, "mac1")) + hex8(seedHash(seed, "mac2"));
    var macParts = [];
    for (var i = 0; i < 12; i += 2) macParts.push(m.slice(i, i + 2));
    return {
      uid: a + "-" + b.slice(0, 4) + "-4" + b.slice(5, 8) + "-a" + c.slice(1, 4) + "-" + c.slice(4) + d,
      mac: macParts.join(":"),
      code: String(10000000 + seedHash(seed, "code") % 90000000)
    };
  }
  var seeded = null;
  function seededValue(field) {
    if (seeded === null) {
      var seed = null;
      try {
        seed = global.Platform ? global.Platform.stableDeviceSeed() : null;
      } catch (e) {}
      seeded = seed ? fromSeed(seed) : false;
    }
    return seeded ? seeded[field] : null;
  }
  // Na Samsung o DUID manda: é do hardware, não muda ao atualizar a TV,
  // reinstalar o app nem trocar Wi-Fi/cabo, então o MAC/código mostrados
  // são sempre os mesmos. Se o que estava salvo for diferente (ex.: 1ª
  // abertura em que o DUID não respondeu e caiu no aleatório), passa a
  // valer o do DUID. Salvo/aleatório só quando a TV não informa o DUID.
  function identity(key, field, generator) {
    var fromHardware = seededValue(field);
    if (fromHardware) {
      try {
        if (localStorage.getItem(key) !== fromHardware) localStorage.setItem(key, fromHardware);
      } catch (e) {}
      return fromHardware;
    }
    return getOrCreate(key, generator);
  }
  global.DeviceIdentity = {
    getDeviceUid: function getDeviceUid() {
      return identity(KEY.UID, "uid", uuidV4);
    },
    getDeviceMac: function getDeviceMac() {
      return identity(KEY.MAC, "mac", randomMac);
    },
    getDeviceCode: function getDeviceCode() {
      return identity(KEY.CODE, "code", randomCode);
    }
  };
})(window);