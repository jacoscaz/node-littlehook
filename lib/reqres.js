module.exports = {};

module.exports.respond = function(type, handler) {
    var self  = this,
        type  = (Array.isArray(type)) ? type : type.split(self.delimiter),
        subTo = [type[0], 'request', '*', self.name].concat(type.slice(1));
    // Handlers are called with this/self as context, therefore
    // this.event = self.event
    self.on(subTo, function(){
        self.event = (Array.isArray(self.event)) 
            ? self.event 
            : self.event.split(self.delimiter);
        var toEmit    = ['response', self.event[2]].join(self.delimiter),
            reqData   = u.values(arguments),
            realEvent = self.event,
            fakeEvent = [self.event[0]].concat(self.event.slice(4));
        self.event = fakeEvent;
        handler.apply(self, reqData.concat([function(resEvent, resData){
            self.emit(toEmit + '::' + responseEvnt, responseData);
        }]));
        self.event = realEvent;
    });
}


module.exports.request = function(type, data, each, millis, end) {
    var self   = this,
        type   = (Array.isArray(type)) ? type : type.split(self.delimiter),
        reqId  = self.name + ((Math.random()*1000000000000)|0),
        toEmit = ['request', reqId, type[0]].concat(type.slice(1)),
        toSub  = [type[0], 'response', requestId, '**'],
        timeout;
    self.on(toSub, function(data){
        if (typeof(each) != 'function')
            return;
        self.event = (Array.isArray(self.event))
            ? self.event
            : self.event.split(self.delimiter);
        var realEvent = self.event,
            fakeEvent = [self.event[0]].concat(self.event.slice(3));
        self.event = fakeEvent;
        eachResponse.call(self, data);
        self.event = realEvent;
    });
    timeout = setTimeout(function(){
        self.removeAllListeners(toSub);
        if (typeof(end) === 'function')
            end();
    }, millis || 2000);
    self.emit(toEmit, data);
}

module.exports.stopResponding = function(type){
    var self = this,
        type = (Array.isArray(type)) ? type : type.split(self.delimiter),
        toUnsub = [type[0], 'request', '*', self.name].concat(type.slice(1));
    self.removeAllListeners(toUnsub);
};
