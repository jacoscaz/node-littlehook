var EventEmitter = require('eventemitter2').EventEmitter2,
    nssocket = require('nssocket'),
    mdns = require('mdns'),
    util = require('util');

    
// We try to generate a unique ID
var generateID = function(){
    return (new String(Date.now())).substr(-5) 
      + (new String((Math.random()*1000)|0)).substr(-3); 
}  

// Main function
var Hook = module.exports.Hook = function(options) {
    var self = this;
    // We call the superconstructor on ourselves
    EventEmitter.call(self, {
        delimiter: "::",
        wildcard: true,
        maxListeners: 20
    });
    self.constructor = Hook;                                
    self.name = options['name'] || 'h' + generateID();      
    self.port = options['port'] || 4242;                    
    self.directPort = options['directPort'] || self.port + 10;
    self.maxCache = options['maxCache'] || 20;
    self.maxPeers = options['maxPeers'] || 3;
    self.connectionMonitorIntervalMillis = options['connectionMonitorInterval'] * 1000 || 5000; // Seconds!
    self.propagationIntervalMillis = options['propagationInterval'] * 1000 || 10000; // Seconds!
    self.lastHeardMillis = options['lastHeardTimeout'] * 1000 || 60000; // Seconds!
    self.logLevel = options['logLevel'] || 'log';
    self.mdnsPeers = {};
    self.peers = {};
    self.sockets = {}; 
    self.sentCache = [];
    
    self.on('*::p2p::hook::update', function(data){
        if (this.event.split('::')[0] != data.name) {
            self.log('warn', 'Name mismatch in hook info, ignoring...');
            return;
        }
        var newPeer = false;
        if (!self.peers[data.name]) {
            self.peers[data.name] = {
                name: data.name,
                proxy: new EventEmitter({
                    delimiter: '::',
                    wildcard: true,
                    maxListeners: 30,
                })
            };
            self.peers[data.name].proxy.getEventTypes = function(){
                return self.getEventTypes.call(self.peers[data.name].proxy);
            }
            newPeer = true;
        }
        self.peers[data.name].port = data.port;
        self.peers[data.name].directPort = data.directPort;
        self.peers[data.name].host = data.host;
        self.peers[data.name].name = data.name;
        self.peers[data.name].lastHeard = Date.now();
        if (newPeer) EventEmitter.prototype.emit.call(self, data.name + '::p2p::hook::up', self.peers[data.name]);
        var oldTypes = self.peers[data.name].proxy.getEventTypes();
        for (var i in data.types) {
            if (oldTypes.indexOf(data.types[i]) == -1) {
                EventEmitter.prototype.emit.call(self, data.name + '::p2p::hook::newListener', data.types[i]);
            }
        }
        for (var i in oldTypes) {
            if (data.types.indexOf(oldTypes[i]) == -1) {
                self.peers[data.name].proxy.removeAllListeners(oldTypes[i]);
                EventEmitter.prototype.emit.call(self, data.name + '::p2p::hook::noListeners', oldTypes[i]);
            }
        }
        self.log('log', 'Info for peer ' + data.name + ' updated');
    });
    
   
    self.on('*::p2p::hook::newListener', function(type){
        var peerName = this.event.split('::')[0];
        if (self.peers[peerName] 
          && self.peers[peerName].proxy.getEventTypes().indexOf(type) == -1) {
            self.peers[peerName].proxy.on(type, function(evdata){
                var socket = new nssocket.NsSocket();
                socket.on('error', function(){socket.end();});
                socket.on('close', function(){/* Forget about it */});
                socket.data('event::listening', function(){
                    socket.send('event::push', {
                        type: type,
                        data: evdata,
                        name: self.name
                    });
                    socket.end();
                    self.log('debug', 'Message sent');
                });
                self.log('debug', 'Sending direct message to peer ' + peerName);
                try {
                    socket.connect(self.peers[peerName].directPort, self.peers[peerName].host);
                } catch (err) {
                    self.log('warn', 'Could not send messsage to peer ' + peerName);
                }
            });
        }   
    });
    
    self.on('newListener', function(type){
        self.propagate('p2p::hook::newListener', type);
    });
}

// Inheritance stuff
Hook.prototype = Object.create(EventEmitter.prototype);
Hook.prototype.constructor = EventEmitter;

// Returns array of connected sockets
Hook.prototype.connectedPeers = function(){
    var self = this;
    var ar = {};
    for (var k in self.sockets)
        if (self.sockets[k].connected)
            ar[k] = self.sockets[k];
    return ar;
}

// Extracts event types out of an EventEmitter2 instance
Hook.prototype.getEventTypes = function() {
    var self = this;
    var ar = [];
    var helper = function(node, delimiter, result, storage){        
        for (var k in node)
            if (k == '_listeners') {
                storage.push(result.split(delimiter).slice(1).join(delimiter));
            } else if (typeof(node[k]) == 'object' && !Array.isArray(node[k])) {
                helper(node[k], delimiter, result + delimiter + k, storage);
            } else {/* We should never end up here */}
    }
    helper(self.listenerTree, self.delimiter, '', ar);
    return ar;
}

// Instance initialization
Hook.prototype.start = function(){
    var self = this;
    self.log('debug', 'Starting...');

    // Server (listening) socket for p2p connections
    self.server = nssocket.createServer(function(socket){
        var timeout = setTimeout(function(){socket.end();}, 3000);
        socket.data('ident::response', function(data){
            self.log('debug', 'Peer name: ' + data.name);
            if ((self.name == data.name) || (self.sockets[data.name] 
                  && self.sockets[data.name].connected)) {
                socket.send('ident::refused');
            } else {
                clearTimeout(timeout);
                self.sockets[data.name] = socket;
                self.log('debug', 'Peer accepted');
                self.onConnectedPeer(data.name);
                socket.send('ident::ok');
            }
        }); 
        socket.send('ident::request', {name: self.name});
        self.log('debug', 'Incoming connection');
    });
    self.server.listen(self.port);
    
    // Server (listening) socket for direct connections
    self.directServer = nssocket.createServer(function(socket){
        var timeout = setTimeout(function(){socket.end();}, 1000);
        socket.data('event::push', function(data){
            clearTimeout(timeout);
            socket.end(); // Future connections might require the removal of this line
            self.log('log', 'Direct message received from peer ' + data.name);
            EventEmitter.prototype.emit.call(self, data.type, data.data);
        });
        socket.send('event::listening');
        self.log('debug', 'Direct connection');
    });
    self.directServer.listen(self.directPort);
    
    // We advertise ourselves on MDNS
    self.advertisement = mdns.createAdvertisement(mdns.tcp('hook'), 
      self.port, {name: self.name});
    self.advertisement.start();
    
    // MDNS Browser         
    self.browser = mdns.createBrowser(mdns.tcp('hook'));
    self.browser.on('serviceUp', function(service){
        if (service.name != self.name) {
            if (service.addresses.length == 0) {
                self.log('warn', 'MDNS returned no addresses for service ' 
                  + service.name + '; Maybe this can help: https://gist.github.com/3693599');
            } else {
                  // To-Do: better way to select the address
                service.address = service.addresses[0];     
                self.log('log', 'MDNS: peer up ' + service.name);  
                self.mdnsPeers[service.name] = {
                    name: service.name,
                    host: service.address,
                    port: service.port,
                };
            }            
        }
    });
    
    self.browser.on('serviceDown', function(service){
        delete self.mdnsPeers[service.name];
        self.log('log', 'MDNS: peer down ' + service.name);
    });
    
    self.browser.start();
    
    // This is how we broadcast our subscriptions so that hooks
    // can send us things we like!
    self.propagationInterval = setInterval(
        function(){
            self.log('debug', 'Propagating info...');
             self.propagate('p2p::hook::update', {
                port: self.port,
                directPort: self.directPort,
                host: '{{localAddress}}',
                types: self.getEventTypes(),
                name: self.name 
            });
        }, 
        self.propagationIntervalMillis
    );
    
    // We shall try to be connected with [self.maxPeers] 
    // other peers all the time
    self.connectionMonitorInterval = setInterval(
        function(){
            if (Object.keys(self.connectedPeers()).length < self.maxPeers 
              && Object.keys(self.mdnsPeers).length > 0
              && Object.keys(self.connectedPeers()).length < Object.keys(self.mdnsPeers).length) {
                var name = Object.keys(self.mdnsPeers)[(Math.random()*Object.keys(self.mdnsPeers).length)|0];
                self.log('debug', 'Connection attempt with peer ' + name);
                self.connect(self.mdnsPeers[name].port, self.mdnsPeers[name].host);
            }
            self.log('log', 'Connected to ' 
              + Object.keys(self.connectedPeers()).length + ' peers');
            for (var k in self.peers)
                if ((Date.now() - self.peers[k].lastHeard) > self.lastHeardMillis) {
                    EventEmitter.prototype.emit.call(self, k + '::p2p::hook::down', self.peers[k])
                    delete self.peers[k];
                }
            for (var k in self.sockets)
                if (self.sockets[k].connected == false)
                    delete self.sockets[k];
        }, 
        self.connectionMonitorIntervalMillis
    );
    EventEmitter.prototype.emit.call(self, self.name + '::p2p::hook::up', self);
}

// This we use to emit stuff on the network
Hook.prototype.emit = function(type, data) {
    var self = this;
    self.log('debug', 'Emitting event');
    type = self.name + '::' + type;
    EventEmitter.prototype.emit.call(self, type, data);
    for (var k in self.peers) {
        self.peers[k].proxy.emit(type, data);
        self.log('debug', 'Emitted for peer ' + k);
    }
}

// Well, no real need to explain this.
Hook.prototype.stop = function(){
    var self = this;
    EventEmitter.prototype.emit.call(self, self.name + '::p2p::hook::down', self);
    clearInterval(self.propagationInterval);
    clearInterval(self.connectionMonitorInterval);
    self.browser.stop();
    self.browser = undefined;
    self.advertisement.stop();
    self.advertisement = undefined; 
    for (var k in self.sockets) {
        if (self.sockets[k].connected)
            self.sockets[k].end(); 
        delete self.sockets[k];
    }
    self.server.close();
    self.server = undefined;
    self.directServer.close();
    self.directServer = undefined;
}

// Here we initiate a connection with another peer from the client side
Hook.prototype.connect = function(port, host){
    var self = this;
    self.log('debug', 'Connection attempt with peer ' + peerName);
    var socket = new nssocket.NsSocket();
    var timeout = setTimeout(function(){socket.end();}, 3000);
    var peerName;
    socket.data('ident::request', function(data){
        peerName = data.name;
        if (!self.sockets[peerName]) {
            socket.send('ident::response', {name: self.name});
            self.log('debug', 'Identification sent');
        } else {
            socket.end();
        }
    });
    socket.data('ident::refused', function(){
        socket.end(); 
        clearTimeout(timeout);
    });
    socket.data('ident::ok', function(data){
        clearTimeout(timeout);
        self.sockets[peerName] = socket;
        self.onConnectedPeer(peerName);
    });
    socket.connect(port, host);
}

Hook.prototype.propagate = function(type, data) {
    var self = this;
    self.log('debug', 'Propagating event...');
    // Create a message id so that we can track loops
    var msgId = self.name + (new String(Date.now())).substr(-7)
      + (new String((Math.random()*1000)|0)).substr(-7);
    // Send message to all connected peers
    for (var k in self.sockets)
        if (self.sockets[k].connected) {
            var fillAddresses = function(node) {
                for (var j in node) {
                    if (typeof(node[j]) == 'string') {
                        if (node[j] == '{{localAddress}}')
                            node[j] = self.sockets[k].socket.address().address;
                        if (node[j] == '{{remoteAddress}}')
                            node[j] = self.sockets[k].socket.remoteAddress;
                        if (node[j] == '{{localPort}}')
                            node[j] = self.sockets[k].socket.address().port;
                        if (node[j] == '{{remotePort}}')
                            node[j] = self.sockets[k].socket.remotePort; 
                    } 
                    if (typeof(node[j]) == 'object'){
                        fillAddresses(node[j]);
                    }
                }
            }
            fillAddresses(data);
            self.sockets[k].send('message::forward', {
                type: self.name + '::' + type,
                data: data,
                msgId: msgId 
            });
            self.log('debug', 'Sent to peer ' + k);
        }
    // Store the msgId in the sentCache for anti-looping
    if (self.sentCache.length > self.maxCache) self.sentCache.pop();
    self.sentCache.unshift(msgId);
} 

// Here we set up connections whether they have been initiated by ourselves
// or another peer - from now on, it's P2P!
Hook.prototype.onConnectedPeer = function(peerName) {
    var self = this;
    if (self.sockets[peerName]) {
        var socket = self.sockets[peerName];
        socket.on('error', function(err){
            self.log('debug', 'Socket error (' + peerName + ')');
            socket.end();
        });
        socket.on('close', function(){
            delete self.sockets[peerName]['socket'];    
        });
        // Flooding mechanism: if we receive a message, we process it locally
        // and forward it to other connected peers so that everybody gets it
        socket.data('message::forward', function(data){
            if (self.sentCache.indexOf(data.msgId) === -1) {
                // No trace of the msgId in self.sentCache, we can proceed
                self.log('debug', 'Message received from ' + peerName);
                // Local emission
                EventEmitter.prototype.emit.call(self, data.type, data.data);
                // Flooding
                for (var k in self.sockets)
                    if (k != peerName && self.sockets[k].connected) {
                        self.sockets[k].send('message::forward', data);
                        self.log('debug', 'Forwarded to peer ' + k);
                    }
                // As usual, some anti-loop precautions
                if (self.sentCache.length > self.maxCache) self.sentCache.pop();
                self.sentCache.unshift(data.msgId);
            } else {
                // Loop detected, do nothing
            }
        });
        self.log('log', 'Connection established  with peer ' + peerName);
        EventEmitter.prototype.emit.call(self, peerName + '::p2p::hook::connected', self.sockets[peerName]);
    }   
}


// Stupid logging 101
var logLevels = ['debug', 'log', 'warn', 'err'];
Hook.prototype.log = function(level, message) {
    if (!message) 
        return this.log('log', level);
    if (logLevels.indexOf(level) >= logLevels.indexOf(this.logLevel) || this.logLevel == 'all')
        console.log(Date.now() 
          + ' | ' + this.name + ' - ' + level.toUpperCase() + ' - ' + message);
}

// ==================================================================
// Request/response emulation on store/sub p2p! What is this madness?
// ==================================================================
// 
// Some useful req/res emulation from an old project.

Hook.prototype.respond = function(type, handler) {
 	var self = this;
	var sender = type.split('::')[0];
	var evtype = type.split('::').slice(1).join('::');
	var eventToSubTo = sender + '::rrh_request::*::' + self.name + '::' + evtype;
	self.on(eventToSubTo, function(requestData){
		var eventToEmit = 'rrh_response::' + self.event.split('::')[2];
		var realEvent = this.event;
		var fakeEvent = this.event.split('::')[0] + '::' + this.event.split('::').slice(4).join('::');
		this.event = fakeEvent;
		handler.call(this, requestData, function(responseEvnt, responseData){
			self.emit(eventToEmit + '::' + responseEvnt, responseData);
		});
		this.event = realEvent;
	});
}

// We issue a request - a cleverly-cloaked event, Mr. Holmes
Hook.prototype.request = function(type, data, eachResponse, timeoutMillis, timeoutFunc) {
	var self = this;
	var target = type.split('::')[0];
	var evtype = type.split('::').slice(1).join('::');
	var requestId = self.name + new String(Date.now()) + ((Math.random()*1000)|0);
	var eventToEmit = 'rrh_request::' + requestId + '::' + target + '::' + evtype;
	var eventToSubTo = target + '::rrh_response::' + requestId + '::**';
	var timeout;
	self.on(eventToSubTo, function(data){
		if (typeof(eachResponse) == 'function') {
			var realEvent = this.event;
			var fakeEvent = this.event.split('::')[0] + '::' + this.event.split('::').slice(3).join('::');
			this.event = fakeEvent;
			eachResponse.call(this, data);
			this.event = realEvent;
		}
	});
	timeout = setTimeout(
		function(){
			self.removeAllListeners(eventToSubTo);
			if (typeof(timeoutFunc) == 'function')
				timeoutFunc();
		}, 
		timeoutMillis || 2000
	);
	self.emit(eventToEmit, data);
}

// We won't reply anymore to your silly requests, young hook.
Hook.prototype.stopResponding = function(type){
	var self = this;
	var sender = type.split('::')[0];
	var evtype = type.split('::').slice(1).join('::');
	var eventToUnsubFrom = sender + '::rrh_request::*::' + self.name + '::' + evtype;
	self.removeAllListeners(eventToUnsubFrom);
};
