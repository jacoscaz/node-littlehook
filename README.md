3p-hook
=======

3p-hook is a "pure P2P" lan-wide EventEmitter2 implementation supporting complete decentralization (no mesh-healing required!), auto-discovery &amp; hot-plugging via EventEmitter2, node-mdns and nssockets.

How does it work
----------------

* MDNS provides the auto-discovery mechanism by which hooks can "see" each other
* A flooding-based P2P / store-sub mechanism is used to update subscriptions among hooks (based on nssockets)
* Direct connections are used for smart event pushing between hooks (based on nssockets)
* EventEmitter2 takes care of all the namespacing stuff

Have a look at [EventEmitter2](https://github.com/hij1nx/EventEmitter2), [Tinyhook](https://github.com/sergeyksv/tinyhook), [Hook.io](https://github.com/hookio/hook.io) and [NsSockets](https://github.com/nodejitsu/nssocket) for things like name-spaced event, named events and the idea of Hooks.

Status
------

Pre-early-maybe-but-i'm-not-sure-alpha. Use at your own risk.
