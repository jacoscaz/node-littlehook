var Hook = require('../index.js');

var a = new Hook({name: 'a', port: 9999});


a.start();

setTimeout(function(){
    a.emit('event', {some: 'data'});
}, 10000);
