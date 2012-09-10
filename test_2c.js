var Hook = require('./hook.js').Hook;

var h3 = new Hook({port: 4245, directPort: 4246});

h3.on('*::test::event', function(data){
    h3.log('EVENT RECEIVED');
});

h3.start();
