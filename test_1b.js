var Hook = require('tinyhook').Hook;
var mdns = require('mdns');

var ad = mdns.createAdvertisement(mdns.tcp('http-2'), 4321);
ad.start();

setTimeout(function(){
    var browser = mdns.browseThemAll();
    browser.on('serviceUp', function(service) {
      console.log("service up: ", service);
    });
    browser.on('serviceDown', function(service) {
      console.log("service down: ", service);
    });
    browser.start();
}, 2000);

var hook = new Hook();
hook.start();
