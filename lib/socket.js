var nssocket      = require('nssocket'),
    u             = require('underscore'),
    EventEmitter2 = require('eventemitter2').EventEmitter2;

module.exports.startServer = function(hook) {
    var server = hook.server = nssocket.createServer(function(socket){
        socket.on('error', function() { socket.destroy(); });
        socket.data(['**'], function() {
            var array = Array.isArray(this.event);
            this.event = (array) 
                ? this.event 
                : this.event.split(hook.delimiter);
            this.event.shift();
            this.event = (array)
                ? this.event
                : this.event.join(hook.delimiter);
            arguments = u.values(arguments); 
            arguments.unshift(this.event);
            EventEmitter2.prototype.emit.apply(hook, arguments);
        });
        //setTimeout(function() { 
        //    socket.end(); 
        //    self.log('debug', 'socket closed'); 
        //}, 15000);
    });
    try { 
        server.listen(hook.port); 
    } catch (err) { 
        throw new Error('The hook can\'t start listening '
          + 'on the specified port (' + port + ')');
    }
}

module.exports.stopServer = function(hook) {
    try {
        hook.server.close();
    } catch(err) {
        // What if we can't stop the server?
    }
}