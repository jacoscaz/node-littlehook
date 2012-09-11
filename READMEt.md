3p-hook
=======

3p-hook is a "pure P2P" lan-wide EventEmitter2 implementation supporting complete decentralization, auto-discovery  &amp; request-response emulation.

What does it do
---------------

3p-hook provides lightweight, name-based, namespaced and fully-decentralized eventing similar to [Hook.io](https://github.com/hookio/hook.io) and its lightweight cousin [Tinyhook](https://github.com/sergeyksv/tinyhook) but in a "[pure p2p](http://en.wikipedia.org/wiki/Peer-to-peer#Unstructured_systems)" fashion. Each hook independently takes care of discoverying other hooks, mantaining connections, pushing events to the right listeners (no meshes, no trees) and can safely fail without compromising the rest of its peers or the network. A request-response emulation layer is also provided for name-based http-like interactions.

How does it work
----------------

* Store-sub (a pub-sub over p2p variation) is used as the primary p2p connection and communication logic;
* each hook auto-discovers its peers based on mDNS/Avahi/Bonjour information on local services;
* each hook p2p-connects to a small (configurable) number of peers;
* a flooding-based mechanism is used to update hooks on each others' event types subscriptions;
* direct connections are used for smart event pushing between hooks;
* namespacing and event-listener matching are provided by [EventEmitter2](https://github.com/hij1nx/EventEmitter2) (this is very similar to what [Tinyhook](https://github.com/sergeyksv/tinyhook) does)
* [NsSockets](https://github.com/nodejitsu/nssocket) are used for all of the connectivity needs

Status
------

Pre-alpha. Use at your own risk.

To-Do
-----

* Find a dependency-less alternative to mDNS
* Cache direct connections
* Think about possible security
* Server-side event naming
* Code cleanup, some refactoring

Installation
------------

Dependencies (better do this from your home directory): 

    npm install eventemitter2 
    npm install nssocket
    npm install mdns

And the actual package 

    npm install 3p-hook

Usage
-----

    var 3phook = require('path/to/the/module/hook.js'); 
    var hook = 3phook.createHook({
    	name: 'someHook'             // The hook's name
    });
    
    hook.on('*::some::event', function(data){
    	// Do something
    });
    
    hook.emit('some::other::event', 'event data');
    
    hook.respond
    
    hook.start();

API
---

Each hook is an EventEmitter2 instance, see the [relative API specs](https://github.com/hij1nx/EventEmitter2#api).

In addition, each hook provides the following request-response methods:

    hook.respond('request::type', handler(requestData, reply){
    	var requestEvent = this.event;
        reply('response::type', 'response data');
    })

    hook.request(
        'request::type', 
        'request data',
        eachResponse(responseData){
        	var responseEvent = this.event;
            // Do smthg
        },
        1000,
        afterTimeout(){
        	// Do smthg
        }
    );

    hook.stopResponding('request::type');

Each Hook emits the following events:

<<<<<<< HEAD
    +------------------------------------+-----------------+--------------------------------------+
    |  Event type                        |  Data           |  Meaning                             |
    +------------------------------------+-----------------+--------------------------------------+
    |[peerName]::p2p::hook::up           |Peer object      |A new peer came online                |
    +------------------------------------+-----------------+--------------------------------------+
    |[peerName]::p2p::hook::down         |Peer object      |A known peer went offline             |
    +------------------------------------+-----------------+--------------------------------------+
    |[peerName]::p2p::hook::update       |Update object    |A known peer has sent an update       |
    +------------------------------------+-----------------+--------------------------------------+
    |[peerName]::p2p::hook::newListener  |Event type       |A known peer has subscribed to        |
    +-----------------------------------+------------------+--------------------------------------+
    |[peerName]::p2p::hook::noListeners  |Event type       |A known peer has unsubscribed from    |
    +------------------------------------+-----------------+--------------------------------------+ 
    |[peerName]::p2p::hook::connected    |NsSocket object  |New connection established with peer  |
    +------------------------------------+----------------+--------------------------------------+
=======
    +-------------------------------+----------------+--------------------------------------+
    |  Event type                   |  Data          |  Meaning                             |
    +-------------------------------+----------------+--------------------------------------+
    |[peerName]::hook::up           |Peer object     |A new peer came online                |
    +-------------------------------+----------------+--------------------------------------+
    |[peerName]::hook::down         |Peer object     |A known peer went offline             |
    +-------------------------------+----------------+--------------------------------------+
    |[peerName]::hook::update       |Peer object     |A known peer has been updated         |
    +-------------------------------+----------------+--------------------------------------+
    |[peerName]::hook::subscribed   |Event type      |A known peer has subscribed to        |
    +-------------------------------+----------------+--------------------------------------+
    |[peerName]::hook::unsubscribed |Event type      |A known peer has unsubscribed from    |
    +-------------------------------+----------------+--------------------------------------+ 
    |[peerName]::p2p::connected     |NsSocket object |New connection established with peer  |
    +-------------------------------+----------------+--------------------------------------+
>>>>>>> 64258d74d19686102234b717fac8342ceafeeaef
