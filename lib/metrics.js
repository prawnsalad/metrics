var events = require('events');
var util   = require('util');


util.inherits(Metrics, events.EventEmitter);
module.exports = Metrics;


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
