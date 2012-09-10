var Hook = require('tinyhook').Hook;
var mdns = require('mdns');

var ad = mdns.createAdvertisement(mdns.tcp('http'), 4320);
ad.start();

var hook = new Hook({port: 9999});
hook.start();
