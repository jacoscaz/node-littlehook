var Hook = require('../index.js');

var b = new Hook({name: 'b', port: 8889});

b.on('**', function(){
    console.log(this.event);
});

b.on(['a', 'up'], function() {

    setTimeout(function(){

        console.log('emitting...')
        b.emit('event');
        console.log('emitted.')
    }, 3000);
    console.log('timeout started');
});

b.start();    
