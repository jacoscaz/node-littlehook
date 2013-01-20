var Hook = require('../index.js');

var b = new Hook({name: 'b', port: 8889});

b.on('*::event', function() {
    console.log('event fired!');
});

b.on('**', function() {
    console.log('any event fired');
});

b.start();