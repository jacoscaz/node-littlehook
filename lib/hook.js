var EventEmitter2 = require('eventemitter2').EventEmitter2;
var util          = require('util');
var u             = require('underscore');
var debug         = require('debug')('littlehook:hook');
var socket        = require('./socket.js');
var mdns          = require('./mdns.js');
    
var Hook = module.exports = function(options) {

    var self = this;

    EventEmitter2.call(self, {
        delimiter    : options.delimiter || '::',
        wildcard     : true,
        maxListeners : options.maxListeners || 30
    });

    if (!options.name) throw new Error('Missing name');
    if (!options.name) throw new Error('Missing port');
    self.name = options.name; 
    self.port = options.port; 

    self.peers = {};
    self.mdns  = {};
    
 }

util.inherits(Hook, EventEmitter2);

Hook.prototype.on = function(type, handler) {
    var self = this;
    EventEmitter2.prototype.on.call(self, type, handler);
    debug(self.name, ' is now listening to ', type);
    if (self.listeners(type).length === 1 && mdns.advertHasBeenStarted(self)) {
        mdns.advertRestart(self);
    }
}

Hook.prototype.off = function(type, handler) {
    var self = this;
    EventEmitter2.prototype.off.call(self, type, handler);
    debug(self.name, ' has one less handler for event', type);
    if (self.listeners(type).length === 0 && mdns.advertHasBeenStarted(self)) {
        mdns.advertRestart(self);
    }
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
    EventEmitter2.prototype.emit.apply(self, arguments);
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
