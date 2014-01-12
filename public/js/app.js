$(function() {
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
			bucket: '',
			properties: ['count', 'sum', 'mean', 'upper', 'lower'],

			interval: '_global',
			time_span: ['_global', '_global'], // [time_from, time_to]
		};

		self.$el = $($('#tmpl_chart').html());
		self.addUiEvents();

		self.chart = self.initChart(self.$el.find('.the-chart'));
		window.c = self;

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

		self.$el.on('change', '.bucket-available', function(event) {
			self.info.bucket = $(this).val();
			self.refreshChart();
		});

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
	};


	Chart.prototype.refreshChart = function() {
		var self = this;
		var properties = self.info.properties;
		var url_params;

		if (typeof properties === 'string') {
			properties = [properties];
		} else if (!properties) {
			properties = ['SUM'];
		}

		url_params = {
			i:    self.info.interval === '_global' ? control.filter.interval : self.info.interval,
			from: self.info.time_span[0] === '_global' ? control.filter.time_span[0] : self.info.time_span[0],
			to:   self.info.time_span[1] === '_global' ? control.filter.time_span[1] : self.info.time_span[1]
		};

		self.chart.showLoading();

		$.getJSON('/buckets/' + self.info.bucket, url_params, function (json) {
			var series = [];
			var series_by_name = {};
			var chart_series_by_name = {};
			var idx;

			for(var property_idx in properties) {
				var data = {
					name: properties[property_idx],
					data: []
				};

				for (idx in json) {
					data.data.push([
						json[idx].time * 1000,
						json[idx][properties[property_idx]]
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

			self.chart.setTitle({text: self.info.title || self.info.bucket});

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
						return '<b>'+ (self.info.title || self.info.bucket) + ' - ' + this.series.name +'</b><br/>'+
						'<i>'+Highcharts.dateFormat('%b %e, %Y %H:%M:%S', this.x) + '</i> = ' + Highcharts.numberFormat(this.y);
				}
			},

			credits: {
				enabled: false
			}
		});

		return $el.highcharts();
   };





	$('.add-chart').click(function() {
		var c = new Chart();
		c.$el.appendTo($('.container-main'));
	});
});