var EventEmitter2 = require('eventemitter2').EventEmitter2,
    util          = require('util'),
    u             = require('underscore'),
    socket        = require('./socket.js'),
    mdns          = require('./mdns.js'),
    reqres        = require('./reqres.js');
    
var Hook = module.exports = function(options) {

    var self = this;

    EventEmitter2.call(self, {
        delimiter    : options.delimiter || '.',
        wildcard     : true,
        maxListeners : options.maxListeners || 30
    });

    if (!options.name) throw new Error('Missing name');
    if (!options.name) throw new Error('Missing port');
    self.name = options.name; 
    self.port = options.port; 

    self.peers = {};
    self.mdns  = {};

    EventEmitter2.prototype.on.call(self, 'newListener', function(type) {
        self.emit('newListener', type);
    });
    
 }

util.inherits(Hook, EventEmitter2);

Hook.prototype.on = function(type, handler) {
    var self = this;
    EventEmitter2.prototype.on.call(self, type, handler);
    if (self.listeners(type).length === 1 && mdns.advertHasBeenStarted(self))
        mdns.advertRestart(self);
}

Hook.prototype.off = function(type, handler) {
    var self = this;
    EventEmitter2.prototype.off.call(self, type, handler);
    if (self.listeners(type).length === 0 && mdns.advertHasBeenStarted(self))
        mdns.advertRestart(self);
}

Hook.prototype.removeAllListeners = function(type) {
    var self = this,
        rest = (self.listeners(type).length > 0);
    EventEmitter2.prototype.removeAllListeners.call(self, type);
    if (rest && mdns.advertHasBeenStarted(self))
        mdns.advertRestart(self);
}

Hook.prototype.emit = function(type) {
    var self  = this,
        peers = u.values(self.peers),
        array = Array.isArray(type);
    type = (array) ? type : type.split(self.delimiter);
    type.unshift(self.name);
    type = (array) ? type : type.join(self.delimiter);
    arguments = u.values(arguments);
    for (var i in peers) {
        peers[i].emit.apply(peers[i], arguments);
    }
}

Hook.prototype.stop = function(){
    var self = this;
    mdns.advertStop(self);
    mdns.browserStop(self);
    socket.stopServer(self);
}

Hook.prototype.start = function() {
    var self = this;
    socket.startServer(self);
    mdns.browserStart(self);
    mdns.advertStart(self);
}

Hook.prototype.respond        = reqres.respond;
Hook.prototype.request        = reqres.request;
Hook.prototype.stopResponding = reqres.stopResponding;