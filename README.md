node-littlehook
===============

littlehook is a lan-wide, distributed EventEmitter2 implementation supporting 
complete decentralization, auto-discovery  &amp; request-response emulation, 
powered by [MDNS](https://github.com/agnat/node_mdns).

What does it do
---------------

Inspired by [Hook.io](https://github.com/hookio/hook.io) and 
[Tinyhook](https://github.com/sergeyksv/tinyhook), littlehook provides 
lightweight, namespaced and fully-decentralized eventing in a 
"[pure p2p](http://en.wikipedia.org/wiki/Peer-to-peer#Unstructured_systems)" 
fashion. Littlehook is a distributed implementation of 
[EventEmitter2](https://github.com/hij1nx/EventEmitter2).

Each hook uses [MDNS](https://github.com/agnat/node_mdns) in a store-sub 
fashion to discover its peers, monitor their subscriptions and publish 
his own subscriptions. [NsSocket](https://github.com/nodejitsu/nssocket) 
and [EventEmitter2](https://github.com/hij1nx/EventEmitter2) are used to 
push events to the appropriate listener hooks. Each hook is free to fail 
without compromising the rest of its peers or the network (no meshes, no trees). 
Request-response emulation is provided.

Status
------

Pre-alpha and don't even think about using this in production - otherwise 
working pretty well.

This is an updated version of the original package, one of my very first 
coding experiments with Node.js. I decided to clean it up a bit, improve it 
in some areas and put it back online after the original, unmaintained version 
that I thought I had removed long ago from both NPM and GitHub surprisingly 
sparked some interest around Jan 2013.

At the moment, I'm not maintaining and/or improving this package. Should it 
keep gathering attention, though, I'll think about a serious makeover.

### Update: 2015-01-26 v0.0.5

I've updated the module as requested.

- Updated dependencies
- Fixed bugs due to module age and conflicts with updated dependencies
- Found a *dirty* workaround for the IPv6 `EHOSTUNREACH` error
- Improved data handling via `NSSocket`
- Switched to mocha-based testing
- Confirmed compatibility with modern engines and [io.js](http://www.iojs.org)
- Dropped support for request/response emulation

Seems to be working ok on MacOS X Yosemite 10.10.1 and an up-to-date Arch Linux.
It often does not behave well with IPv6 - I suggest using IPv4. 

Updating
--------

When updating the module and/or switching to/from node, io.js and 
other npm-compatible engines, do the following: 

```
$ npm cache clean
$ cd /path/to/littlehook
$ rm -rf node_modules
$ npm install
```

To-Do
-----

* Better docs
* Refactor and merge into `Hook`
* Shift to 2-spaces indentation
* Socket timeout and takedown
* P2P event flooding for large networks

Usage & API
-----------

    var Hook = require('littlehook'); 
    
    var a = new Hook({ name: 'a', port: 9999 });
    var b = new Hook({ name: 'b', port: 9998 });
    
    // Matches events of type 'event::type' sent by 
    // any hook in the same MDNS area
    a.on(['*', 'event', 'type'], function(data) {
        console.log('data: ' + data);
        console.log('sender: ' + this.event[0]);
    });
    
    // This does the same as the above w/ events
    // specified as strings instead of arrays
    a.on('*::event::type', function(data) {
        console.log('data: ' + data);
        console.log('sender: ' + this.event.split('::')[0]);
    });
    
    // When hook 'a' comes online, emits event of
    // type 'event::type' - the resulting event will
    // be namespaced as 'b::event::type'
    b.on(['a', 'up'], function() {
        b.emit(['event', 'type'], { some: 'data' });
    });
    
    a.start();
    b.start();

Each hook is an EventEmitter2 instance, see the
[relative API specs](https://github.com/hij1nx/EventEmitter2#api). 

Events are namespaced as in [Tinyhook](https://github.com/sergeyksv/tinyhook) 
and [Hook.io](https://github.com/hookio/hook.io).

    var hook = new Hook({name: 'johnny', port: 9999});
    hook.emit('hello'); // Event emitted: ['johnny', 'hello']

The delimiter used is always '::' (see EventEmitter2's specs):

    'hookName::event::type'   <->   ['hookName', 'event', 'type'] 

Each hook emits the following events:

    ['hookName', 'up']     -> Hook 'hookName' came up
    ['hookName', 'down']   -> Hook 'hookName' went down
    ['hookName', 'update'] -> Hook 'hookName' updated its subscriptions



Testing
-------

```
$ npm test
```

License
-------

[MIT](LICENSE.md)
