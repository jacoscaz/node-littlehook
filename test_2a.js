var Hook = require('./hook.js').Hook;

var h1 = new Hook({port: 4241, directPort: 4242});

h1.start();

setTimeout(function(){
    h1.emit('test::event');
    h1.log('EVENT SENT');
}, 30000);


