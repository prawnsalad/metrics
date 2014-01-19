var util = require('util');
var events = require('events');


util.inherits(StoreSqlite, events.EventEmitter);
module.exports = StoreSqlite;


function StoreSqlite(config, metrics) {
	var self = this;
	var sqlite3 = require('sqlite3');

	this.config = config;
	this.metrics = metrics;

	var db = new sqlite3.Database(this.config.db);
	initDb();

	this.metrics.on('flush', function(buckets) {
		var bucket_names = [];
		var stmt = db.prepare("INSERT INTO metrics VALUES (?, ?, ?, ?, ?, ?, ?)");

		var b;
		for (var prop in buckets) {
			if (!buckets.hasOwnProperty(prop))
				continue;

			b = buckets[prop];
			stmt.run(prop, parseInt(b.time, 10), b.upper, b.lower, b.count, b.sum, b.mean);

			// Get a list of unique bucket names
			if (bucket_names.indexOf(prop) === -1)
				bucket_names.push(prop);
		}

		stmt.finalize();

		if (bucket_names.length) {
			sql = 'INSERT OR IGNORE INTO buckets VALUES ' + (new Array(bucket_names.length)).join('(?),') + '(?);';
			db.run(sql, bucket_names);
		}
	});

	function initDb() {
		var sql = '';

		sql = 'CREATE TABLE IF NOT EXISTS metrics (bucket TEXT, ts INTEGER, upper INTEGER, lower INTEGER, count INTEGER, sum INTEGER, mean INTEGER);';
		db.run(sql);

		sql = 'CREATE TABLE IF NOT EXISTS buckets (bucket TEXT UNIQUE);';
		db.run(sql);
	}


	function getBuckets(namespace, callback) {
		var sql = 'SELECT DISTINCT bucket FROM buckets ';
		var sql_params = [];

		if (typeof namespace === 'string' && namespace) {
			sql += 'WHERE bucket LIKE ? ';
			sql_params.push(namespace + '.%');
		}

		sql += 'ORDER BY bucket';

		db.all(sql, sql_params, function(err, rows) {
			var namespaces = [];
			var is_bucket;
			var found_namespace, found_namespaces = [];

			for (var idx in rows) {
				found_namespace = rows[idx].bucket.replace(namespace + '.', '').split('.')[0];
				is_bucket = namespace + '.' + found_namespace === rows[idx].bucket;

				if (!found_namespaces[found_namespace]) {
					namespaces.push({namespace: found_namespace, is_bucket: is_bucket});
					found_namespaces[found_namespace] = true;
				}
			}

			if (typeof callback === 'function')
				callback(null, namespaces);
		});
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
	self.getBuckets = getBuckets;
}