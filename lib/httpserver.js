var url    = require('url');
var http   = require('http');
var static = require('node-static');


module.exports = HttpServer;


function HttpServer(config, stats_store) {
	this.config = config;
	this.stats_store = stats_store;

	this._file_server = new static.Server('./public');
	this._server = http.createServer(this._handleRequest.bind(this));
}



HttpServer.prototype.run = function() {
	this._server.listen(this.config.port, this.config.addr);
};



HttpServer.prototype._handleRequest = function(request, response) {
	var url_parts = url.parse(request.url, true);

	if (url_parts.pathname.indexOf('/buckets/') === 0) {
		var pathname_parts = url_parts.pathname.split('/');

		if (!pathname_parts[2]) {
			this.stats_store.getBuckets(url_parts.query.namespace, function(err, buckets) {
				response.end(JSON.stringify(buckets));
			});

		} else {

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
			this.stats_store.getStats(bucket, interval, time_from, time_to, function(err, stats) {
				response.end(JSON.stringify(stats));
			});
		}

		return;
	}

	if (url_parts.pathname == ('/buckets') === 0) {
		this.stats_store.getBuckets(url_parts.query.namespace, function(err, buckets) {
			response.end(JSON.stringify(buckets));
		});

		return;
	}

	this._file_server.serve(request, response);
};