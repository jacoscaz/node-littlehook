var Hook = require('../index.js');

var a = new Hook({name: 'a', port: 9999});

a.on(['*', 'up'], function() {
    console.log('Hook ' + this.event[0] + ' is up');
});

a.on(['*', 'down'], function() {
    console.log('Hook ' + this.event[0] + ' is down');
});

a.on(['*', 'update'], function() {
    console.log('Hook ' + this.event[0] + ' is updated');
});

a.on(['*', 'event'], function() {
    console.log('Hook ' + this.event[0] + ' fired an event');
});

a.on(['**'], function() {
    console.log(this.event);
})

a.start();