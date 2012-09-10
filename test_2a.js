var createHook = require('./hook.js').createHook;

var h1 = createHook({port: 4241, directPort: 4242});

h1.start();

setTimeout(function(){
    h1.emit('test::event');
    h1.log('EVENT SENT');
}, 30000);


