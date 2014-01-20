$(function() {
	!function(e){if("object"==typeof exports)module.exports=e();else if("function"==typeof define&&define.amd)define(e);else{var n;"undefined"!=typeof window?n=window:"undefined"!=typeof global?n=global:"undefined"!=typeof self&&(n=self),n.TinyEmitter=e()}}(function(){var e,n,t;return function r(e,n,t){function i(o,u){if(!n[o]){if(!e[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(f)return f(o,!0);throw new Error("Cannot find module '"+o+"'")}var s=n[o]={exports:{}};e[o][0].call(s.exports,function(n){var t=e[o][1][n];return i(t?t:n)},s,s.exports,r,e,n,t)}return n[o].exports}var f=typeof require=="function"&&require;for(var o=0;o<t.length;o++)i(t[o]);return i}({1:[function(e,n,t){function r(){}r.prototype={on:function(e,n,t){var r=this.e||(this.e={});(r[e]||(r[e]=[])).push({fn:n,ctx:t});return this},once:function(e,n,t){var r=this;var i=function(){r.off(e,i);n.apply(t,arguments)};return this.on(e,i,t)},emit:function(e){var n=[].slice.call(arguments,1);var t=(this.e[e]||[]).slice();var r=0;var i=t.length;for(r;r<i;r++){t[r].fn.apply(t[r].ctx,n)}return this},off:function(e,n){var t=this.e||(this.e={});var r=t[e];var i=[];if(r&&n){for(var f=0,o=r.length;f<o;f++){if(r[f].fn!==n)i.push(r[f])}}i.length?t[e]=i:delete t[e];return this}};n.exports=r},{}]},{},[1])(1)});

	var control = (function() {
		var self = this;

		var $control = $('.global-control');

		$control.on('change', '.bucket-interval', function(event) {
			self.filter.interval = $(this).val();
		});

		$control.on('change', '.bucket-range', function(event) {
			var parts = $(this).val().split(',');
			self.filter.time_span[0] = parseInt(parts[0], 10);
			self.filter.time_span[1] = parseInt(parts[1], 10);
		});

		self.filter = {
			interval: 'h',
			time_span: [-(3600*6), 0], // [time_from, time_to]
		};

		return self;
	})();

	function Chart(info) {
		var self = this;

		// These options define what this chart shows
		self.info = info || {
			title: '',
			width_index: 0,
			chart_type: 'spline',

			buckets: [],
			interval: '_global',
			time_span: ['_global', '_global'], // [time_from, time_to]
		};

		// The available widh % this chart can be
		self.widths = [25, 50, 75, 100];

		self.$el = $($('#tmpl_chart').html());
		self.addUiEvents();

		self.chart = self.initChart(self.$el.find('.the-chart'));

		// For some reason, the chart does not update its width yet. Wait a little
		setTimeout(function(){ self.updateView(); }, 1);

		// Refresh our chart every 10 seconds
		self.refresh_tmr = setInterval(function() { self.refreshChart(); }, 10000);
	}


	Chart.prototype.dispose = function() {
		this.chart.destroy();
		this.$el.remove();

		if (this.refresh_tmr)
			clearInterval(this.refresh_tmr);
	};


	Chart.prototype.addUiEvents = function() {
		var self = this;

		self.$el.on('change', '.bucket-interval', function(event) {
			self.info.interval = $(this).val();
			self.refreshChart();
		});

		self.$el.on('change', '.bucket-range', function(event) {
			var parts;

			if ($(this).val() === '_global') {
				self.info.time_span[0] = self.info.time_span[1] = '_global';
			} else {
				parts = $(this).val().split(',');
				self.info.time_span[0] = parseInt(parts[0], 10);
				self.info.time_span[1] = parseInt(parts[1], 10);
			}

			self.refreshChart();
		});

		self.$el.on('click', '.refresh-chart', function(event) {
			self.refreshChart();
		});

		self.$el.on('click', '.size-plus', function(event) {
			if (self.info.width_index >= self.widths.length - 1)
				return;

			self.info.width_index++;
			self.updateView();
		});

		self.$el.on('click', '.size-minus', function(event) {
			if (self.info.width_index <= 0)
				return;

			self.info.width_index--;
			self.updateView();
		});

		self.$el.on('click', '.add-bucket', function(event) {
			if (self.ns_browser) {
				self.ns_browser.dispose();
				self.ns_browser.off('bucket_change');
				delete self.ns_browser;
				return;
			}

			self.ns_browser = new NamespaceBrowser();
			self.ns_browser.setSelected(self.info.buckets);

			self.ns_browser.on('bucket_change', function(bucket_name, selected) {
				var index_of_bucket = self.info.buckets.indexOf(bucket_name);

				if (selected && index_of_bucket === -1) {
					self.info.buckets.push(bucket_name);
					console.log('adding ' + bucket_name);
				} else if (!selected && index_of_bucket > -1) {
					self.info.buckets.splice(index_of_bucket, 1);
					console.log('removing ' + bucket_name);
				}
			});

			self.ns_browser.$el.appendTo(self.$el.find('.the-chart'));
		});
	};


	Chart.prototype.uniqueBuckets = function() {
		var buckets = [];

		for (var idx in this.info.buckets) {
			var parts = this.info.buckets[idx].split(' ');
			if (!parts[1])
				parts[1] = 'sum';

			if (buckets.indexOf(parts[0]) === -1)
				buckets.push(parts[0]);
		}

		return buckets;
	};


	Chart.prototype.getBucketData = function(callback) {
		var self = this;
		var buckets = this.uniqueBuckets();
		var bucket_data = {};
		var loaded_buckets = 0;

		var url_params = {
			i:    self.info.interval === '_global' ? control.filter.interval : self.info.interval,
			from: self.info.time_span[0] === '_global' ? control.filter.time_span[0] : self.info.time_span[0],
			to:   self.info.time_span[1] === '_global' ? control.filter.time_span[1] : self.info.time_span[1]
		};

		var loadData = function(bucket_name) {
			$.getJSON('/buckets/' + bucket_name, url_params, function(json) {
				bucket_data[bucket_name] = json;
				loaded_buckets++;

				if (loaded_buckets === buckets.length)
					callback(bucket_data);
			});
		};

		for (var i in buckets)
			loadData(buckets[i]);
	};


	Chart.prototype.updateView = function() {
		this.$el.css('width', this.widths[this.info.width_index].toString() + '%');
		this.chart.reflow();
	};


	Chart.prototype.refreshChart = function() {
		var self = this;

		self.chart.showLoading();

		this.getBucketData(function(bucket_data) {
			var series = [];
			var series_by_name = {};
			var chart_series_by_name = {};

			for (var idx in self.info.buckets) {
				var parts = self.info.buckets[idx].split(' ');
				if (!parts[1])
					parts[1] = 'sum';

				var bucket_name = parts[0];
				var property = parts[1];

				var data = {
					name: bucket_name + ' - ' + property,
					type: self.info.chart_type,
					data: []
				};

				for (var json_idx in bucket_data[bucket_name]) {
					data.data.push([
						bucket_data[bucket_name][json_idx].time * 1000,
						bucket_data[bucket_name][json_idx][property]
					]);
				}

				series.push(data);
				series_by_name[data.name] = data;
			}

			// Get a list of current series added to the chart
			for (idx in self.chart.series) {
				chart_series_by_name[self.chart.series[idx].name] = self.chart.series[idx];
			}

			// For each series, check if they have been added to the chart already. Add or
			// update data as required
			for (idx in series) {
				if (!chart_series_by_name[series[idx].name]) {
					self.chart.addSeries(series_by_name[series[idx].name]);
				} else {
					chart_series_by_name[series[idx].name].setData(series_by_name[series[idx].name].data);
				}
			}

			self.chart.setTitle({text: self.info.title || ''});

			self.chart.hideLoading();
		});
	};



	Chart.prototype.initChart = function($el) {
		var self = this;

		$el.highcharts({
			chart: {
				type: 'spline'
			},
			title: {
				text: ''
			},
			//subtitle: {
				//text: 'Irregular time data in Highcharts JS'
			//},
			xAxis: {
				type: 'datetime',
				dateTimeLabelFormats: { // don't display the dummy year
					month: '%e. %b',
					year: '%b'
				}
			},
			yAxis: {
				title: {
					text: ''
				}
			},
			tooltip: {
				formatter: function() {
						return '<b>' + this.series.name + '</b><br/>'+
						'<i>'+Highcharts.dateFormat('%b %e, %Y %H:%M:%S', this.x) + '</i> = ' + Highcharts.numberFormat(this.y);
				}
			},

			credits: {
				enabled: false
			}
		});

		return $el.highcharts();
   };




	function NamespaceBrowser() {
		var self = this;

		self.$el = $($('#tmpl_namespace_browser').html());
		self.addUiEvents();

		this.selected = {};
		self.loadNamespace(self.$el);
	}
	NamespaceBrowser.prototype = new TinyEmitter();


	NamespaceBrowser.prototype.dispose = function() {
		this.$el.remove();
	};


	NamespaceBrowser.prototype.addUiEvents = function() {
		var self = this;

		this.$el.on('click', '.namespace label', function(event) {
			event.stopPropagation();

			var $target_namespace = $(this).parent();
			var $child_namespaces = $target_namespace.find('ul');

			if ($child_namespaces.length) {
				$child_namespaces.remove();
			} else {
				self.loadNamespace($target_namespace, $target_namespace.data('bucket'));
			}
		});

		this.$el.on('click', '.bucket label', function(event) {
			event.stopPropagation();

			var $item = $(this).parent();
			var bucket_name = $item.data('bucket');
			var is_checked = !!($item.find('input').is(':checked'));

			self.emit('bucket_change', bucket_name, is_checked);

			if (!is_checked) {
				delete self.selected[bucket_name];
			} else {
				self.selected[bucket_name] = true;
			}
		});
	};


	NamespaceBrowser.prototype.setSelected = function(selected) {
		selected = selected || [];

		this.selected = {};
		for (var idx in selected)
			this.selected[selected[idx]] = true;
	};


	NamespaceBrowser.prototype.loadNamespace = function($target_namespace, namespace_name) {
		var self = this;

		$.getJSON('/buckets/', {namespace: namespace_name}, function(json) {
			if (!json || !json.length)
				return;

			var parent_namespace = namespace_name ? namespace_name + '.' : '';
			var $namespace = $('<ul></ul>');

			var item, $item, $checkbox;
			for (var idx in json) {
				item = json[idx];
				$item = $('<li class="item"></li>')
					.data('bucket', parent_namespace + item.namespace);

				$item.append($('<label></label>').text(item.namespace));
				$item.addClass(item.is_bucket ? 'bucket' : 'namespace');

				if (item.is_bucket) {
					$checkbox = $('<label><input type="checkbox" /></label>').append(item.namespace);
					$checkbox.find('input').attr('name', parent_namespace + item.namespace);
					$item.empty().prepend($checkbox);

					if (self.selected[parent_namespace + item.namespace])
						$item.find('input').attr('checked', 'checked');
				}

				$namespace.append($item);
			}

			$target_namespace.append($namespace);
		});
	};

	window.NamespaceBrowser = NamespaceBrowser;





	$('.add-chart').click(function() {
		var c = new Chart();
		c.$el.appendTo($('.container-main'));
	});
});