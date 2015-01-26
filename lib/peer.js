var EventEmitter2 = require('eventemitter2').EventEmitter2,
    nssocket      = require('nssocket'),
    util          = require('util'),
    u             = require('underscore'),
    debug         = require('debug')('littlehook:peer');


var Peer = module.exports = function(hook) {

    var self  = this;
    this.hook = hook;

    EventEmitter2.call(self, {
        wildcard    : true,
        maxListeners: 30,
        delimiter   : '::',
        newListener : false
    });
}

util.inherits(Peer, EventEmitter2);

Peer.prototype.push = function() {
    var self = this;
    arguments = u.values(arguments);
    arguments.unshift(this.event);
    try {
        self.socket = (self.socket && self.socket.connected)
            ? self.socket
            : new nssocket.NsSocket({ delimiter: '::' });
        if (!self.socket.connected) {
            self.socket.on('error', function(err) { 
                debug(self.hook.name, ' could not push data to ', self.name);
                debug('ASYNC ERROR', err);
            });
            self.socket.connect(self.port, self.address);
        }
        var event = arguments[0];
        var args  = Array.prototype.slice.call(arguments, 1);
        self.socket.send('littlehook::event', {event: event, args: args});
        debug(this.hook.name, ' pushed data to ', this.name, event, args);
        // To-Do: close socket
    } catch (err) {
        debug(this.hook.name, ' could not push data to ', this.name);
        debug('SYNC ERROR', err);
        throw err;
    }    
}

Peer.prototype.update = function(service) {
    var self = this;
    var addr = service.addresses;
    self.port    = service.port;
    self.name    = service.name;
    //
    // On MacOSX Yosemite 10.10.1, service.address seems to always be an IPv6 
    // that leads to a EHOSTUNREACH error when we try to connect to it.
    // This dirty, dirty workaround tries to use the first IPv4 address available.
    //
    for (var i = 0, done = false; i < addr.length && !done; i++) {
        if (addr[i].match(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/)) {
            self.address = addr[i];
            done = true;
        }
    }
    if (!done) {
        self.address = service.address;
    }
    self.listenerTree = {};
    service.types.forEach(function(type) {
        if (self.listeners(type).length === 0) {
            self.on(type, self.push.bind(self));
        }
    });
    debug(this.hook.name, ' has updated its record of ', this.name, service.types, this.address, this.port);
    return self;
}