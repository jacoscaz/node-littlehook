var nssocket      = require('nssocket'),
    u             = require('underscore'),
    EventEmitter2 = require('eventemitter2').EventEmitter2,
    debug         = require('debug')('littlehook:socket');

module.exports.startServer = function(hook) {
    var server = hook.server = nssocket.createServer(
        { delimiter: '::' }, 
        function(socket){
            socket.on('error', function() { 
                socket.destroy(); 
            });
            socket.data('littlehook::event', function(data) {
                debug(hook.name, ' has received data ', data);
                EventEmitter2.prototype.emit.apply(hook, [data.event].concat(data.args));
            });
            debug('Hook ', hook.name, ' has received a new connection');
        }
    );
    try { 
        server.listen(hook.port, '::'); 
        debug('Hook ', hook.name, ' has started accepting connections');
    } catch (err) { 
        throw new Error('Hook ' + hook.name + ' can\'t listen on port ' + hook.port);
    }
}

module.exports.stopServer = function(hook) {
    try {
        hook.server.close();
        debug('Hook ', hook.name, ' has stopped accepting connections');
    } catch(err) {
        // What if we can't stop the server?
    }
}