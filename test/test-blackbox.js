
var should = require('should');
var Hook   = require('../');

describe('Littlehook (Blackbox)', function() {

  var hookA = null;
  var hookB = null;

  this.timeout(10000);

  before(function() {
    hookA = new Hook({name: 'A', port: 9876});
    hookB = new Hook({name: 'B', port: 9875});
    return null;
  });

  it('- hooks should detect each other\'s coming up', function(done) {
    hookA.once(['B', 'up'], function() {
      should.exist(this.event[0]) && this.event[0].should.eql('B');
      done();
    });
    hookA.start();
    hookB.start();
    return null;
  });

  it('- hooks should be able to listen to other hooks\' updates', function(done) {
    hookB.once(['A', 'update'], done);
    hookA.once(['B', 'foo'], function() {});
    return null;
  });

  it('- hooks should be able to listen to other hooks\' events', function(done) {
    hookA.on(['B', 'update'], function() {
      hookA.emit('bar', 'The Answer', 'is', 42);
      return null;
    });
    hookB.once(['A', 'bar'], function(arg1, arg2, arg3) {
      Array.prototype.slice.call(arguments, 0).should.eql(['The Answer', 'is', 42]);
      return done();
    });
    return null;
  });

  after(function() {
    hookA.stop();
    hookB.stop();
  });

});
