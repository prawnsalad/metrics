var dgram  = require('dgram');
var util = require('util');
var events = require('events');


util.inherits(ListenerUdp, events.EventEmitter);
module.exports = ListenerUdp;


function ListenerUdp() {
	events.EventEmitter.call(this);

	var self = this;

	var server = dgram.createSocket('udp4');
	server.bind(1234, function() { });

	server.on('message', function(message, rinfo) {
		var parts = message.toString().split(' ');
		if (parts.length !== 2)
			return;

		self.emit('event', parts[0], parseInt(parts[1], 10));
	});
}