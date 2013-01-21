var mdns          = require('mdns'),
    EventEmitter2 = require('eventemitter2').EventEmitter2,
    u             = require('underscore'),
    Peer          = require('./peer.js');

module.exports = {};

var helper = function(node, event, events) {
    for (var k in node) {
        if (k === '_listeners') { 
            events.push(event); 
        }
        if (typeof(node[k]) === 'object' && !Array.isArray(node[k])) {
            var childEvent = event.slice(0);
            childEvent.push(k);
            helper(node[k], childEvent, events);
        }
    }
}

var getEventTypes = function(inst) {   
    var events = [];
    helper(inst.listenerTree, [], events);
    return events;
}


module.exports.advertStart = function(hook) {
    var types = getEventTypes(hook), labels = [];
    for (var i in types) {
        types[i] = JSON.stringify(types[i]);
        labels.push(i); 
    }
    var txtRecord = u.object(labels, types);
    var advert = hook.mdns.advert = mdns.createAdvertisement(
        mdns.tcp('hook'), 
        hook.port, 
        {
            name: hook.name,
            txtRecord: txtRecord
        }
    );
    advert.start();
}

module.exports.advertStop = function(hook) {
    if (!hook.mdns || !hook.mdns.advert)
        return;
    hook.mdns.advert.stop();
    delete hook.mdns.advert;
}

module.exports.advertRestart = function(hook) {
    hook.mdns.timeout = hook.mdns.timeout || setTimeout(function() {
        module.exports.advertStop(hook);
        module.exports.advertStart(hook);
        delete hook.mdns.timeout;
    }, 3000);
}

module.exports.advertHasBeenStarted = function(hook) {
    return (hook.mdns.advert && hook.mdns.advert.watcherStarted);
}

module.exports.browserStart = function(hook) {
    var browser = hook.mdns.browser = mdns.createBrowser(mdns.tcp('hook'));
    browser.on('serviceUp', function(service){
        module.exports.browserOnUp(hook, service);
    });
    browser.on('serviceDown', function(service){
        module.exports.browserOnDown(hook, service);
    });
    browser.start();
}

module.exports.browserStop = function(hook) {
    if (hook.mdns && hook.mdns.browser)
        hook.mdns.browser.stop();
}

module.exports.browserOnUp = function(hook, service) {
    if (service.name === hook.name)
        // We're detecting ourselves
        return;
    if (service.addresses.length === 0)
        // MDNS is not working properly
        return console.log('MDNS returned no addresses for service '
          + service.name + '. This usually means that nss-dns '
          + 'is not installed alongside avahi or bonjour');
    service.address = service.addresses[0];
    service.types = u.values(service.txtRecord);
    for (var i in service.types)
        service.types[i] = JSON.parse(service.types[i]);
    var event = (!hook.peers[service.name]) ? 'up' : 'update';
    process.nextTick(function() {
        EventEmitter2.prototype.emit.call(hook, [
            service.name,
            event
        ]);
    });
    hook.peers[service.name] = 
        (hook.peers[service.name] || new Peer(hook.delimiter)).update(service);
    if (hook.peers[service.name].timeout)
        clearTimeout(hook.peers[service.name].timeout);
}

module.exports.browserOnDown = function(hook, service) {
    if (!hook.peers[service.name]) 
        return;    
    hook.peers[service.name].timeout = setTimeout(function() {
        delete hook.peers[service.name];
        process.nextTick(function() {
            EventEmitter2.prototype.emit.call(hook, [
                service.name,
                'down'
            ]);
        });
    }, 10000);
}