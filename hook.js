var EventEmitter = require('eventemitter2').EventEmitter2,
    nssocket = require('nssocket'),
    mdns = require('mdns'),
    util = require('util');

    
// We try to generate a unique ID
var generateGUID = function(){
    return (new String(Date.now())).substr(-5) 
      + (new String((Math.random()*1000)|0)).substr(-3); 
}

// Keeping track of active hooks in this process
module.hooks = [];  

// Main function
var Hook = module.exports.Hook = function(options) {

    var self = this;
    
    // We call the superconstructor on ourselves
    EventEmitter.call(self, {
        delimiter: "::",
        wildcard: true,
        maxListeners: 20
    });
    
    // Ah, the creator
    self.constructor = Hook;
    
    // Our name as a hook
    self.name = options['name'] || 'h' + generateGUID();
    
    // Our listening port for p2p connections
    self.port = options['port'] || 4242;
    
    // Our listening port for direct connections
    self.directPort = options['directPort'] || self.port + 10;
    
    // p2p message cache size
    self.maxCache = options['maxCache'] || 20;
    
    // Maximum connected peers
    self.maxPeers = options['maxPeers'] || 3;
    
    // Frequency of monitoring our connections
    self.connectionMonitorIntervalMillis = options['connectionMonitorInterval'] * 1000 || 5000; // Seconds!
    
    // Frequency & interval of propagation for our subscriptions
    self.propagationIntervalMillis = options['propagationInterval'] * 1000 || 5000; // Seconds!
    
    // Desired logging level (none, err, warn, log, debug, all)
    self.logLevel = options['logLevel'] || 'debug';
    
    // Our peers indexed by their names (-> unique id)
    self.peers = {};
    
    // IDs of [self.maxCache] most recently processed messages
    // so that we can skip a message we have already processed 
    self.sentCache = [];
    
    // Types of event we are subscribed to
    self.types = [];

    // A peer is propagating the global status of its subscriptions.
    EventEmitter.prototype.on.call(self, 'p2p::hook::subscriptions', function(data){
        if (self.peers[data.name]) {
        
            // Hard reset of EventEmitter2 .listenerTree object
            // Need to find a better way to do this, maybe exchanging
            // the trees and diff'ing them or something like that.
            self.peers[data.name].proxy.listenerTree = {};
            
            // Port update
            self.peers[data.name].directPort = data.directPort;
            
            // To-Do: the listener function is always the same!
            // Find a way to circumvent duplication
            for (var i in data.types) {
                self.peers[data.name].proxy.on(data.types[i], function(evdata){
                    var socket = new nssocket.NsSocket();
                    
                    // Some socket precautions
                    socket.on('error', function(){
                        socket.end();
                    });
                    socket.on('close', function(){
                        // Forget about it
                    });
                    
                    socket.data('event::listening', function(){
                        socket.send('event::push', {
                            type: data.types[i],
                            data: evdata
                        });
                        socket.end();
                        self.log('debug', 'Message sent');
                    });
                    self.log('debug', 'Sending direct message to peer ' + data.name);
                    socket.connect(self.peers[data.name].directPort, self.peers[data.name].host);
                });
            }
            
            self.log('debug', 'Subscriptions for peer ' + data.name + ' updated');
        }
    });

}

// Inheritance stuff
Hook.prototype = Object.create(EventEmitter.prototype);
Hook.prototype.constructor = EventEmitter;

// Return the array of connected peers
Hook.prototype.connectedPeers = function(){
    var self = this;
    var ar = [];
    for (var k in self.peers)
        if (self.peers[k].socket && self.peers[k].socket.connected)
            ar.push(self.peers[k]);
    return ar;
}

// Instance initialization
Hook.prototype.start = function(){

    var self = this;
    
    self.log('debug', 'Starting...');

    // Server (listening) socket for p2p connections
    self.server = nssocket.createServer(function(socket){
    
        if (self.connectedPeers().length >= self.maxPeers) {
            // Too many peers connected
            self.log('debug', 'Too many connections');
            socket.end();
            return;
        }
        
        var timeout = setTimeout(
            function(){
                // Peer is not answering
                self.log('debug', 'No answer'); 
                socket.end();
            }, 
            3000
        );
        
        socket.data('ident::response', function(data){
            // The peer answered with its identification
            
            clearTimeout(timeout); // We can clear the timeout
            
            self.log('debug', 'Peer name: ' + data.name);
            
            if (self.name == data.name) {
                // Trying to self-connect!
                self.log('debug', 'Self-connect attempt');
                socket.end();
                return;
            }
            
            if (!self.peers[data.name]){
                // Peer is not advertised
                self.log('debug', 'Unknown peer');
                socket.end();
                return;
            } 
            
            if (self.peers[data.name].socket 
              && self.peers[data.name].socket.connected) {
                // We are already connected to this peer
                self.log('debug', 'Already connected');
                socket.end();
                return;
            }
            
            // If we got here, the peer is good
            self.peers[data.name].socket = socket;
            self.peers[data.name].directPort = data.directPort;
            self.log('debug', 'Peer accepted');
            
            // See...
            self.onConnectedPeer(data.name);
            
            // Send confirmation to peer
            socket.send('ident::ok');
        }); 
        
        // Ask peer for identification
        socket.send('ident::request');
        self.log('debug', 'Incoming connection');
    });
    self.server.listen(self.port);
    
    // Server (listening) socket for direct connections
    self.directServer = nssocket.createServer(function(socket){
        
        var timeout = setTimeout(function(){
            self.log('debug', 'No answer');
            // If we get here, client is not answering
            socket.end();
        }, 1000);
        
        socket.data('event::push', function(data){
            // Client answered with the event to be emitter locally
            
            // We can clear the timeout and shutdown the socket
            clearTimeout(timeout);
            socket.end(); // Future connections might require the removal of this line

            // Emit the event locally
            self.log('debug', 'Direct message received');
            EventEmitter.prototype.emit.call(self, data.type, data.data);
        });
        
        // We are ready to receive the event
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
        // A new hook has come up
        
        if (service.name === self.name) {
            // This means it's us and we do not want to self-connect
            return;
        }
            
        // Badly configured machines have a tendency to tricks MDNS
        // into returning services with no ip address.
        if (service.addresses.length == 0) {
            self.log('warn', 'MDNS returned no addresses for service ' 
              + service.name + '; Maybe this can help: https://gist.github.com/3693599');
            return;
        } else
            service.address = service.addresses[0];     
          
        self.log('debug', 'Peer up ' + service.address + ':' + service.port);
        
        // If we do not have this peer on our list, we store its info
        // and create the proxy  
        if (!self.peers[service.name]) {
            self.peers[service.name] = {
                name: service.name,
                host: service.address,
                port: service.port,
                types: [],
                proxy: new EventEmitter({
                    delimiter: "::",
                    wildcard: true,
                    maxListeners: 20
                })
            };
        }
    });
    
    
    self.browser.on('serviceDown', function(service){
        // Oh noes, a hook went down!
        // We shall remove it from our list and close sockets.
        if (self.peers[service.name] 
          && self.peers[service.name].socket 
          && self.peers[service.name].socket.connected)
            self.peers[service.name].socket.end();
        delete self.peers[service.name];
    });
    
    self.browser.start();
    
    // This is how we broadcast our subscriptions so that hooks
    // can send us things we like!
    self.propagationInterval = setInterval(
        function(){
            self.log('debug', 'Propagating subscriptions...');
            self.propagate('hook::subscriptions', {
                types: self.types,
                name: self.name,
                directPort: self.directPort
            });
        }, 
        self.propagationIntervalMillis
    );
    
    // We shall try to be connected with [self.maxPeers] 
    // other peers all the time
    self.connectionMonitorInterval = setInterval(
        function(){
            if (self.connectedPeers().length < self.maxPeers 
              && Object.keys(self.peers).length > 0
              && self.connectedPeers().length < Object.keys(self.peers).length) {
                var name = Object.keys(self.peers)[(Math.random()*Object.keys(self.peers).length)|0];
                self.log('debug', 'Connection attempt with peer ' + name);
                self.connect(name);
            }
            self.log('debug', 'Connected to ' 
              + self.connectedPeers().length + ' peers');
        }, 
        self.connectionMonitorIntervalMillis
    );
    
    // Init is finished, hooray! Let's fire the 'hook::ready' event
    // for compatibility purposes 
    EventEmitter.prototype.emit.call(self, 'hook::ready');
}

// This we use to emit stuff on the network
Hook.prototype.emit = function(type, data) {
    var self = this;
    
    self.log('debug', 'Emitting event');
    
    // We emit events by calling to other hooks' proxies
    // They take care of checking subscriptions and blabla
    EventEmitter.prototype.emit.call(self, type, data);
    type = self.name + '::' + type; // Named events as in hook.io
    for (var k in self.peers) {
        self.peers[k].proxy.emit(type, data);
        self.log('debug', 'Emitted for peer ' + k);
    }
}

// This we use to subscribe to stuff from the network
Hook.prototype.on = function(type, handler) {
    var self = this;
    
    // Because I value!
    EventEmitter.prototype.on.call(this, type, handler);
    
    // Dirty trick while I figure out EventEmitter2 inner workings
    self.types.push(type);
    
    self.log('debug', 'Subscribed to ' + type);
}

// Well, no real need to explain this.
Hook.prototype.stop = function(){
    var self = this;
    clearInterval(self.propagationInterval);
    clearInterval(self.connectionMonitorInterval);
    self.browser.stop();
    self.browser = undefined;
    self.advertisement.stop();
    self.advertisement = undefined; 
    for (var k in self.peers) {
        if (self.peers[k].socket && self.peers[k].socket.connected)
            self.peers[k].socket.end();
        if (self.peers[k].socket)
            delete self.peers[k].socket; 
        delete self.peers[k];
    }
    self.server.end();
    self.server = undefined;
    self.directServer.end();
    self.directServer = undefined;
}

// Here we initiate a connection with another peer from the client side
Hook.prototype.connect = function(peerName){
    var self = this;
    
    self.log('debug', 'Connection attempt with peer ' + peerName);
    
    if (!self.peers[peerName]) {
        // A client must have been detected by MDNS before we can
        // connect to it
        self.log('debug', 'Can\'t connect with unlisted peer');
        return;
    }
    
    var peer = self.peers[peerName];
    
    if (peer.socket && peer.socket.connected) {
        // Already connected to this client (or maybe the client called
        // us first)
        self.log('debug', 'Already connected');
        return;        
    }
    
    // Instantiate the socket
    var socket = new nssocket.NsSocket();
    
    // Await for the server to ask us who the heck are we
    socket.data('ident::request', function(){
        // We respond with our name
        socket.send('ident::response', {
            name: self.name
        });
        self.log('debug', 'Identification sent');
    });
    
    socket.data('ident::ok', function(data){
        // Nice, the server accepted our connection request
        peer.socket = socket;
        // We can proceed
        self.onConnectedPeer(peer.name);
    });
    
    socket.connect(peer.port, peer.host);
}

Hook.prototype.propagate = function(type, data) {
    var self = this;
    
    self.log('debug', 'Propagating event...');
    
    // Create a message id so that we can track loops
    var msgId = self.name + (new String(Date.now())).substr(-7)
      + (new String((Math.random()*1000)|0)).substr(-7);
      
    // Send message to all conected peers
    for (var k in self.peers) {
        if (self.peers[k].socket && self.peers[k].socket.connected) {
            self.peers[k].socket.send('message::forward', {
                type: type,
                data: data,
                msgId: msgId 
            });
            self.log('debug', 'Sent to peer ' + k);
        }
    }
    
    // Store the msgId in the sentCache for anti-looping
    if (self.sentCache.length > self.maxCache) self.sentCache.pop();
    self.sentCache.unshift(msgId);
}

// Here we set up connections whether they have been initiated by ourselves
// or another peer - from now on, it's P2P!
Hook.prototype.onConnectedPeer = function(peerName) {

    var self = this;
    
    // Peer's data via MDNS
    var peer = self.peers[peerName];
    
    // Some socket precautions
    peer.socket.on('error', function(err){
        self.log('debug', 'Socket error (' + peer.name + ')');
        peer.socket.end();
    });
    peer.socket.on('close', function(){
        delete self.peers[peer.name]['socket'];    
    });
    
    // Flooding mechanism: if we receive a message, we process it locally
    // and forward it to other connected peers so that everybody gets it
    peer.socket.data('message::forward', function(data){
        if (self.sentCache.indexOf(data.msgId) === -1) {
            // No trace of the msgId in self.sentCache, we can proceed
            
            self.log('debug', 'Message received from ' + peer.name);
            
            // Local emission (we emit a p2p -namespaced event)
            EventEmitter.prototype.emit.call(self, 'p2p' + '::' 
              + data.type, data.data);
            
            // Forward to everybody
            for (var k in self.peers)
                if (self.peers[k].name != peer.name && self.peers[k].socket 
                  && self.peers[k].socket.connected) {
                    self.peers[k].socket.send('message::forward', data);
                    self.log('debug', 'Forwarded to peer ' + k);
                }
                
            // As usual, some anti-loop precautions
            if (self.sentCache.length > self.maxCache) self.sentCache.pop();
            self.sentCache.unshift(data.msgId);
            
        } else {
            // Loop detected, do nothing
        }
    });
    
    // AAAnd we're done!
    self.log('debug', 'Connection established  with peer ' + peer.name);   
}


// Stupid logging 101
var logLevels = ['debug', 'debug', 'warn', 'err'];
Hook.prototype.log = function(level, message) {
    if (!message) 
        return this.log('debug', level);
    if (logLevels.indexOf(level) >= logLevels.indexOf(this.logLevel) || this.logLevel == 'all')
        console.log(Date.now() 
          + ' | ' + this.name + ' - ' + level.toUpperCase() + ' - ' + message);
}

// ==================================================================
// Request/response emulation on store/sub p2p! What is this madness?
// ==================================================================
// 
// Some useful req/res emulation from an old project.

// We hereby declare to the world that we, indeed, respond to
// a certain type of requests (as in app.get())
Hook.prototype.respond = function(type, handler) {
 	var self = this;
	var sender = type.split('::')[0];
	var evtype = type.split('::').slice(1).join('::');
	var eventToSubTo = sender + '::rrh_request::*::' 
	  + self.name + '::' + evtype;
	self.on(eventToSubTo, function(requestData){
		var eventToEmit = 'rrh_response::' 
		  + self.event.split('::')[2];
		var realEvent = this.event;
		var fakeEvent = this.event.split('::')[0] + '::' 
		  + this.event.split('::').slice(4).join('::');
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
	var eventToEmit = 'rrh_request::' + requestId + '::' 
	  + target + '::' + evtype;
	var eventToSubTo = target + '::rrh_response::' + requestId + '::**';
	var timeout;
	self.on(eventToSubTo, function(data){
		if (typeof(eachResponse) == 'function') {
			var realEvent = this.event;
			var fakeEvent = this.event.split('::')[0] + '::' 
			  + this.event.split('::').slice(3).join('::');
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
	var eventToUnsubFrom = sender + '::rrh_request::*::' 
	  + self.name + '::' + evtype;
	self.removeAllListeners(eventToUnsubFrom);
};

// Node-style creator function
var createHook = module.exports.createHook = function(options){
    var hook = new Hook(options);
    module.hooks.push(hook);
    return hook;
}

// This is something a serious programmer should never do
process.on('uncaughtException', function (err) {
    console.log("");
    console.log("");
    console.log('HORRENDOUS HAZARD!');
    console.log('An exception bubbled all the way to the main loop.');
    console.log('Here is the mess: ' + err);
    console.log('I will now process to a uber reset.');
    console.log("");
    console.log("");
    for (var i in module.hooks) {
        module.hooks[i].stop();
        module.hooks[i].start();     
    }
});
