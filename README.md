3P
==

3P is a "Pure P2P", lan-wide, distributed EventEmitter2 implementation supporting complete decentralization, auto-discovery  &amp; request-response emulation, powered by MDNS.

What does it do
---------------

Inspired by [Hook.io](https://github.com/hookio/hook.io) and [Tinyhook](https://github.com/sergeyksv/tinyhook), 3P provides lightweight, namespaced and fully-decentralized eventing in a "[pure p2p](http://en.wikipedia.org/wiki/Peer-to-peer#Unstructured_systems)" fashion. 3P is a distributed implementation of [EventEmitter2](https://github.com/hij1nx/EventEmitter2).

Each hook uses [MDNS](https://github.com/agnat/node_mdns) in a store-sub fashion to discover its peers, monitor their subscriptions and publish his own subscriptions. [NsSocket](https://github.com/nodejitsu/nssocket) and [EventEmitter2](https://github.com/hij1nx/EventEmitter2) are used to push events to the appropriate listener hooks. Each hook is free to fail without compromising the rest of its peers or the network (no meshes, no trees). Request-response emulation is provided.

Status
------

Pre-alpha and don't even think about using this in production - otherwise working pretty well.

This is an updated version of the original package, one of my very first coding experiments with Node.js. I decided to clean it up a bit, improve it in some areas and put it back online after the original, unmaintained version that I thought I had removed long ago from both NPM and GitHub surprisingly sparked some interest around Jan 2013.

At the moment, I'm not maintaining and/or improving this package. Should it keep gathering attention, though, I'll think about a serious makeover.

To-Do
-----

* Socket timeout and takedown
* P2P event flooding for large networks

Usage & API
-----------

    var Hook = require('3P'); 
    var hook = new Hook({
    	name: 'someHook',
        port: 9999
    });
    hook.start();

Each hook is an EventEmitter2 instance, see the [relative API specs](https://github.com/hij1nx/EventEmitter2#api).

Events are namespaced as in [Tinyhook](https://github.com/sergeyksv/tinyhook) and [Hook.io](https://github.com/hookio/hook.io).

    var hook = new Hook({name: 'johnny', port: 9999});
    hook.emit('hello'); // Event emitted: johnny::hello

In addition, each hook provides the following request-response methods:

    // Type-based response mechanism
    hook.respond('sendHook::request::type', handler(reqData, reply){
    	var requestEvent = this.event;
        reply('response::type', 'response data');
    });
    
    // Make a request
    hook.request(
        'targetHook::request::type', 
        'request data',
        function(responseData){
        	var responseEvent = this.event;
            // Do smthg for each request
        },
        1000, // Timeout interval
        function(){
        	// Do smthg after the timeout
        }
    );
    
    // Stop
    hook.stopResponding('request::type');

