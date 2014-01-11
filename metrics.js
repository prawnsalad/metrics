var dgram  = require('dgram');
var events = require('events');
var util   = require('util');
var url    = require('url');
var http   = require('http');
var static = require('node-static');


process.title = 'metrics';


util.inherits(Metrics, events.EventEmitter);



var stats = new Metrics();
var stats_store = new MetricsSQliteStore(stats);

stats.setFlushInterval(5);
stats.start();

stats.on('stats', function(stats) {
	console.log('Events/sec ', stats.events_second);
});


var server = dgram.createSocket('udp4');
server.bind(1234, function() { });

server.on('message', function(message, rinfo) {
	var parts = message.toString().split(' ');
	if (parts.length !== 2)
		return;

	stats.storeMetric(parts[0], parseInt(parts[1], 10));
});



var file_server = new static.Server('./public');
http.createServer(function (request, response) {
	var url_parts = url.parse(request.url, true);

	if (url_parts.pathname.indexOf('/buckets/') === 0) {
		var bucket = url_parts.pathname.split('/')[2];
		var interval = url_parts.query.i || 'm';
		var time_from = parseInt(url_parts.query.from, 10) || -(3600*6);
		var time_to = parseInt(url_parts.query.to, 10) || 0;

		// The times given are relative to the current time
		var time = Math.floor((new Date()).getTime() / 1000);
		time_from = time + time_from;
		time_to = time + time_to;

		// Make sure we have a valid interval
		if (['d', 'h', 'm', 's'].indexOf(interval) === -1)
			interval = 'm';

		response.writeHead(200, {'Content-Type': 'text/json'});
		stats_store.getStats(bucket, interval, time_from, time_to, function(err, stats) {
			response.end(JSON.stringify(stats));
		});

		return;
	}

	file_server.serve(request, response);

}).listen(5000, '127.0.0.1');


(function() {
	setInterval(function() {
		var mem = process.memoryUsage();
		stats.storeMetric('internal.server.memory.rss', Math.floor(mem.rss / 1024));
		stats.storeMetric('internal.server.memory.heap_total', Math.floor(mem.heapTotal / 1024));
		stats.storeMetric('internal.server.memory.heap_used', Math.floor(mem.heapUsed / 1024));
	}, 10000);
})();




function MetricsSQliteStore(metrics) {
	var self = this;
	var sqlite3 = require('sqlite3');

	this.metrics = metrics;

	var db = new sqlite3.Database('metrics.db');
	initDb();

	this.metrics.on('flush', function(buckets) {
		var stmt = db.prepare("INSERT INTO metrics VALUES (?, ?, ?, ?, ?, ?, ?)");

		var b;
		for (var prop in buckets) {
			if (!buckets.hasOwnProperty(prop))
				continue;

			b = buckets[prop];
			stmt.run(prop, parseInt(b.time, 10), b.upper, b.lower, b.count, b.sum, b.mean);

		}

		stmt.finalize();
	});

	function initDb() {
		var sql = 'CREATE TABLE IF NOT EXISTS metrics (bucket TEXT, ts INTEGER, upper INTEGER, lower INTEGER, count INTEGER, sum INTEGER, mean INTEGER);';
		db.run(sql);
	}


	function getStats(bucket, interval, from, to, callback) {
		var group_by_format = '%Y%m%d ';
		if (interval == 'd'){
		} else if (interval == 'h') {
			group_by_format += '%H';
		} else if (interval == 'm') {
			group_by_format += '%H%M';
		} else if (interval == 's') {
			group_by_format += '%H%M%S';
		}

		var sql = '',
			sql_params = [bucket];

		sql += 'SELECT ';
		sql +=     'strftime("%Y-%m-%d %H:%M:%S", MAX(ts), "unixepoch") AS date, ';
		sql +=     'MAX(ts)    AS time, ';
		sql +=     'MAX(upper) AS upper, ';
		sql +=     'MIN(lower) AS lower, ';
		sql +=     'SUM(count) AS count, ';
		sql +=     'SUM(sum)   AS sum, ';
		sql +=     'SUM(sum) / SUM(count) AS mean ';
		sql += 'FROM metrics ';
		sql += 'WHERE bucket = ? ';

		if (from && to) {
			sql += 'AND ts >= ? AND ts <= ? ';
			sql_params.push(from);
			sql_params.push(to);
		}

		sql += 'GROUP BY strftime("' + group_by_format + '", datetime(ts, "unixepoch"))';

		db.all(sql, sql_params, function(err, rows) {
			var stats = [],
				row;

			for (var idx in rows) {
				row = rows[idx];

				stats.push(row);
			}

			if (typeof callback === 'function')
				callback(null, stats);
		});
	}

	self.getStats = getStats;
}




function Metrics() {
	var self = this;

	events.EventEmitter.call(self);

	var buckets = {};

	// Default flush interval being 1 minute
	var flush_interval = 60;
	var flush_tmr = null;

	var stat_stored_second = 0;

	setInterval(triggerStats, 1000);

	// Interval in seconds
	function setFlushInterval(interval) {
		flush_interval = interval;
	}


	function stopFlushing() {
		clearInterval(flush_tmr);
	}

	function startFlushing() {
		flush_tmr = setInterval(function() {
			flushBuckets();
		}, 1000 * flush_interval);
	}


	function initBucket(bucket_name) {
		buckets[bucket_name] = buckets[bucket_name] || {
			upper: 0,
			lower: 0,
			count: 0,
			sum: 0,
			mean: 0
		};
	}


	function store(bucket_name, value) {
		initBucket(bucket_name);

		var b = buckets[bucket_name];

		if (b.count === 0) {
			b.upper = value;
			b.lower = value;
		} else {
			if(b.upper < value)
				b.upper = value;

			if(b.lower > value)
				b.lower = value;
		}

		b.count++;
		b.sum += value;
		b.mean = b.sum / b.count;

		if (bucket_name.indexOf('internal.') !== 0) {
			store('internal.events.stored', 1);
			stat_stored_second++;
		}
	}


	function flushBuckets() {
		var time = Math.floor((new Date()).getTime() / 1000);

		// Add a time to eahc of the buckets
		for (var prop in buckets) {
			if (!buckets.hasOwnProperty(prop))
				continue;

			buckets[prop].time = time;
		}

		// Add these buckets to the cache and start with new buckets
		self.emit('flush', buckets);
		buckets = {};
	}


	function availableBuckets() {
		var bucket_names = [];

		for (var prop in buckets) {
			if (!buckets.hasOwnProperty(prop))
				continue;

			bucket_names.push(prop);
		}

		return bucket_names;
	}


	function triggerStats() {
		var stats = {
			events_second: stat_stored_second
		};
		self.emit('stats', stats);

		stat_stored_second = 0;
	}


	self.storeMetric       = store;
	self.setInterval       = setInterval;
	self.setFlushInterval  = setFlushInterval;
	self.start             = startFlushing;
	self.listBuckets       = availableBuckets;
}
