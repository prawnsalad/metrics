var Metrics      = require('./lib/metrics.js');
var ListenerUdp  = require('./lib/listeners/udp.js');
var StoreSqlite  = require('./lib/stores/sqlite.js');
var HttpServer   = require('./lib/httpserver.js');


process.title = 'metrics';



/**
 * Metrics - the metric aggregator
 */
var stats = new Metrics();

// Set metrics to flush events to the store every 5 seconds
stats.setFlushInterval(5);

// Start flushing the events
stats.start();



/**
 * Storing any events the listener finds
 */
var stats_store = new StoreSqlite({db: 'metrics.db'}, stats);



/**
 * Listener - listening for events from sources
 */
var listener = new ListenerUdp();

// When we get a new event, pass it over to metrics to handle
listener.on('event', function(bucket, value) {
	stats.storeMetric(bucket, value);
});



/**
 * The built in web front end to see an overview of the events
 */
var http_server = new HttpServer({addr: '0.0.0.0', port: 5000}, stats_store);
http_server.run();



/**
 * Store some internal information as events - handy for monitoring this
 * service itself.
 */
setInterval(function() {
	var mem = process.memoryUsage();
	stats.storeMetric('internal.server.memory.rss', Math.floor(mem.rss / 1024));
	stats.storeMetric('internal.server.memory.heap_total', Math.floor(mem.heapTotal / 1024));
	stats.storeMetric('internal.server.memory.heap_used', Math.floor(mem.heapUsed / 1024));
}, 10000);



if (process.argv.indexOf('-v') > -1) {
	stats.on('stats', function(stats) {
		console.log('Events/sec ', stats.events_second);
	});
}
