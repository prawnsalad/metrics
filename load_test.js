var dgram = require('dgram');


var buckets = [
	{name: 'website.hit', min: 1, max: 1},
	{name: 'website.login', min: 1, max: 1},
	{name: 'website.logout', min: 1, max: 1},
	{name: 'website.response_time', min: 1, max: 1000},
	{name: 'game.opens', min: 1, max: 1},
	{name: 'game.starts', min: 1, max: 1},
	{name: 'game.ends', min: 1, max: 1},
	{name: 'game.questions', min: 1, max: 1}
];

var client = dgram.createSocket("udp4");

doSendLoop();
function doSendLoop() {
	for(var i=0; i<10; i++)
		doSend();

	setTimeout(doSendLoop, 20);
}


function doSend() {
	var bucket = buckets[Math.floor(Math.random() * buckets.length)];
	var val = rand(bucket.min, bucket.max);
	var message = new Buffer(bucket.name + ' ' + val.toString());

	client.send(message, 0, message.length, 1234, "127.0.0.1");
}



function rand(from, to) {
	return Math.floor(Math.random()*(to-from+1)+from);
}