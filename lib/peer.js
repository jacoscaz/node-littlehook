var EventEmitter2 = require('eventemitter2').EventEmitter2,
    nssocket      = require('nssocket'),
    util          = require('util'),
    u             = require('underscore');


var Peer = module.exports = function() {

    var self = this;

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
                console.error(err); 
            });
            self.socket.connect(self.port, self.address);
        }
        self.socket.send.apply(self.socket, arguments);
        // To-Do: close socket
    } catch (err) {
        // throw err;
    }    
}

Peer.prototype.update = function(service) {
    var self = this;
    self.address = service.address;
    self.port    = service.port;
    self.name    = service.name;
    self.listenerTree = {};
    service.types.forEach(function(type) {
        if (self.listeners(type).length === 0)
            self.on(type, Peer.prototype.push);
    });
    return self;
}