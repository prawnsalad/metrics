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