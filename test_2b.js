var Hook = require('./hook.js').Hook;

var h2 = new Hook({port: 4243, directPort: 4244});

h2.on('*::test::event', function(data){
    h2.log('EVENT RECEIVED');
});

h2.start();

