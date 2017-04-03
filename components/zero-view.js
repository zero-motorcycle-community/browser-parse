/*
zero-view.js
Veiwer for Zero motorcycle MBB log files.
1.0 
04/3/2017

Copyright 2017 Keith Thomas

License: MIT https://github.com/zero-motorcycle-community/browser-parse/blob/master/LICENSE

*/

/* jslint browser: true*/

/*global $, Highcharts, Blob, FileReader, DataView, Uint8Array, Uint16Array, Uint32Array */

$(document).ready(function () {
	'use strict';
				
	var logFileName,
		fileGood = false,
		pts,
		maxDate,
		minDate,
		chartPick = 1,
		useAll = true, // one if false
		filtered = false, // AllRides if true, y if false
		viewRide = true, //view charge if false
		newUnits = false,
		whichOne = 0, //or which charge
		whichLabel = 'Ride ',
		whatZoom = 1,
		whatShift = 0,
		xStart = 0,
		xEnd = 0,
		xCenter = 0,
		xRange = 0,
		xIncrement = 0,
		logBinary,
		plotMode = 0,
		distScale = 1.0,
		tempScale = 1.0,
		tempOffset = 0,
		distLbl = 'km',
		tempLbl = '\xb0C',
		xTime = false,
		y = { // plot arrays
			logTime: [],
			event: [],
			packTempH: [],
			packTempL: [],
			packSOC: [],
			vPack: [],
			motAmps: [],
			battAmps: [],
			motTemp: [],
			ctrlTemp: [],
			ambTemp: [],
			motRPM: [],
			odo: [],
			curLimit: [],
			cutback: [],
			minCell: []
		}, //clone y object structure
		allRides = (JSON.parse(JSON.stringify(y))),
		allCharges = (JSON.parse(JSON.stringify(y))),
		rideStart = [],
		rideEnd = [],
		chargeStart = [],
		chargeEnd = [],
		split = 0,
		splits = {},
		minRide = 5,
		minCharge = 2,
		rides = {},
		charges = {},
		ride = 0,
		charge = 0,
		chartVar,
		flashWhat = '';
	

	function getMaxOfArray(numArray) {
		var temp,
			noNulls = numArray.filter(function (val) {
				return val !== null;
			});
		temp = Math.max.apply(null, noNulls);
		if (!isFinite(temp)) {temp = ''; }
		return temp;
	}
	
	function getMinOfArray(numArray) {
		var temp,
			noNulls = numArray.filter(function (val) {
				return val !== null;
			});
		temp = Math.min.apply(null, noNulls);
		if (!isFinite(temp)) {temp = ''; }
		return temp;
	}
	

	Highcharts.setOptions({
		global: {useUTC: false},
		colors: ['#6397ff', '#404040', '#40ff40', '#ff0000', '#0000ff', '#187000', '#e27000', '#a61c00'],
		exporting: {
			sourceWidth: 1500,
			sourceHeight: 750
		}
	});
	
	function drawChart() {
		var i = 0,
			j = 0,
			axisType = 'linear',
			s = 3,
			ds = [],
			s1 = [],
			s2 = [],
			s3 = [],
			s4 = [],
			s5 = [],
			s6 = [],
			y1 = [],
			y2 = [],
			y3 = [],
			y4 = [],
			y5 = [],
			y6 = [];

		$('#container').css('display', 'block'); // unhide
		$('#disclaim').css('display', 'none'); // hide
		switch (chartPick) {
		case 1:
			for (i = 0; i < ride; i++) {
				s1[i] = allRides.odo[rideEnd[i] - 1] - allRides.odo[rideStart[i]];
				s2[i] = rides[i].riding;
				s3[i] = getMaxOfArray(allRides.packSOC.slice(rideStart[i], rideEnd[i])) - getMinOfArray(allRides.packSOC.slice(rideStart[i], rideEnd[i])); // soc may fluctuate
			}
			if (xTime) {
				axisType = 'datetime';
				for (i = 0; i < ride; i++) {
					y1[i] = [allRides.logTime[rideStart[i]], s1[i]];
					y2[i] = [allRides.logTime[rideStart[i]], s2[i]];
					y3[i] = [allRides.logTime[rideStart[i]], s3[i]];
					y4[allRides.logTime[rideStart[i]]] = i;
				}
			} else {
				axisType = 'linear';
				y1 = s1;
				y2 = s2;
				y3 = s3;
			}
			chartVar = Highcharts.chart('container', {
				chart: {zoomType: 'x', borderWidth: 2, borderColor: '#808080', panning: true, panKey: 'shift'},
				title: {text: null},
				xAxis: {type: axisType, visible: xTime},
				yAxis: [{title: {text: 'minutes'}}, {title: {text: distLbl}, opposite: true}, {visible: false}, {visible: false}
					],
				tooltip: {
					formatter: function () {
						var s = (axisType === 'linear') ?
									'Ride <b>' + (this.x + 1) + '</b><br/>' +
									Highcharts.dateFormat('%b %e, %H:%M',
										new Date(allRides.logTime[rideStart[this.x]])) :
									'Ride <b>' + y4[this.x] + '</b><br/>' +
									Highcharts.dateFormat('%b %e, %H:%M', new Date(this.x));
						$.each(this.points, function () {
							s += '<br/><b>' + Highcharts.numberFormat(this.y, 0, '.', '') + '</b> ' + this.series.name;
						});
						return s;
					},
					shared: true
				},
				legend: {verticalAlign: 'top'},
				series: [ {
					type: 'column',
					name: 'minutes',
					yAxis: 0,
					data: y2
				}, {
					type: 'column',
					name: distLbl + ' distance',
					yAxis: 1,
					data: y1
				}, {
					type: 'column',
					name: '% charge used',
					yAxis: 2,
					data: y3
				}]
			});
			return;
		case 2:
			if (xTime) {
				axisType = 'datetime';
				for (i = 0; i < y.logTime.length; i++) {
					y1[i] = [y.logTime[i], y.cutback[i]];
					y2[i] = [y.logTime[i], y.odo[i]];
					y3[i] = [y.logTime[i], y.packSOC[i]];
					y4[i] = [y.logTime[i], y.motRPM[i]];
					y5[i] = [y.logTime[i], y.motAmps[i]];
					y6[i] = [y.logTime[i], y.ambTemp[i]];
				}
			} else {
				y1 = y.cutback;
				y2 = y.odo;
				y3 = y.packSOC;
				y4 = y.motRPM;
				y5 = y.motAmps;
				y6 = y.ambTemp;
				axisType = 'linear';
			}
			chartVar = Highcharts.chart('container', {
				chart: {zoomType: 'x', borderWidth: 2, borderColor: '#808080', panning: true, panKey: 'shift'},
				title: {text: null},
				xAxis: {type: axisType, visible: xTime},
				yAxis: [{min: 0, max: 100, tickAmount: 5, title: {text: null}
					}, {visible: false
					}, {visible: false
					}, {visible: false }, {visible: false }, {visible: false }],
				tooltip: {
					formatter: function () {
						var s = (axisType === 'linear') ?
									Highcharts.dateFormat('%b %e, %H:%M', new Date(y.logTime[this.x])) + '<br/>' +
									Highcharts.dateFormat('%b %e, %H:%M',
										new Date(allRides.logTime[rideStart[this.x]])) :
									Highcharts.dateFormat('%b %e, %H:%M', new Date(this.x));
						$.each(this.points, function () {
							s += '<br/>' + this.series.name + ': <b>' +
								Highcharts.numberFormat(this.y, 0, '.', '') + '</b>';
						});
						return s;
					},
					shared: true
				},
				legend: {verticalAlign: 'top'},
				series: [{
					type: 'spline',
					name: 'Limit %',
					yAxis: 0,
					data: y1
				}, {
					type: 'spline',
					name: 'Odo ' + distLbl,
					yAxis: 1,
					data: y2
				}, {
					type: 'spline',
					name: 'Charge %',
					yAxis: 0,
					data: y3
				}, {
					type: 'spline',
					name: 'motAmps',
					yAxis: 3,
					data: y5,
					zones: [{
						value: 0,
						color: '#c79a04'
					}]
				}, {
					type: 'spline',
					name: 'motRPM',
					yAxis: 2,
					data: y4
				}, {
					type: 'spline',
					name: 'ambTemp' + tempLbl,
					yAxis: 4,
					data: y6
				}]
			});
			return;
		case 3:
			if (xTime) {
				axisType = 'datetime';
				for (i = 0; i < y.logTime.length; i++) {
					y1[i] = [y.logTime[i], y.motTemp[i]];
					y2[i] = [y.logTime[i], y.ambTemp[i]];
					y3[i] = [y.logTime[i], y.ctrlTemp[i]];
					y4[i] = [y.logTime[i], y.packTempH[i]];
					y5[i] = [y.logTime[i], y.packTempL[i]];
				}
			} else {
				y1 = y.motTemp;
				y2 = y.ambTemp;
				y3 = y.ctrlTemp;
				y4 = y.packTempH;
				y5 = y.packTempL;
				axisType = 'linear';
			}
			chartVar = Highcharts.chart('container', {
				chart: {zoomType: 'x', borderWidth: 2, borderColor: '#808080', panning: true, panKey: 'shift'},
				title: {text: null},
				xAxis: {type: axisType, visible: xTime},
				yAxis: {title: {text: 'Temperature'}},
				tooltip: {
					formatter: function () {
						var s = (axisType === 'linear') ?
									Highcharts.dateFormat('%b %e, %H:%M', new Date(y.logTime[this.x])) + '<br/>' +
									Highcharts.dateFormat('%b %e, %H:%M',
										new Date(allRides.logTime[rideStart[this.x]])) :
									Highcharts.dateFormat('%b %e, %H:%M', new Date(this.x));
						$.each(this.points, function () {
							s += '<br/>' + this.series.name + ': <b>' +
								Highcharts.numberFormat(this.y, 0, '.', '') + '</b>' + tempLbl;
						});
						return s;
					},
					shared: true
				},
				legend: {verticalAlign: 'top'},
				series: [{
					type: 'spline',
					name: 'Motor',
					data: y1
				}, {
					type: 'spline',
					name: 'Ambient',
					data: y2
				}, {
					type: 'spline',
					name: 'Controller',
					data: y3
				}, {
					type: 'spline',
					name: 'Pack High',
					data: y4
				}, {
					type: 'spline',
					name: 'Pack Low',
					data: y5
				}]
			}
				);
			return;
		case 4:
			if (xTime) {
				axisType = 'datetime';
				for (i = 0; i < y.logTime.length; i++) {
					y1[i] = [y.logTime[i], y.curLimit[i]];
					y2[i] = [y.logTime[i], y.motRPM[i]];
					y3[i] = [y.logTime[i], y.minCell[i]];
					y4[i] = [y.logTime[i], y.motAmps[i]];
					y5[i] = [y.logTime[i], y.battAmps[i]];
					y6[i] = [y.logTime[i], y.vPack[i]];
				}
			} else {
				y1 = y.curLimit;
				y2 = y.motRPM;
				y3 = y.minCell;
				y4 = y.motAmps;
				y5 = y.battAmps;
				y6 = y.vPack;
				axisType = 'linear';
			}
			chartVar = Highcharts.chart('container', {
				chart: {zoomType: 'x', borderWidth: 2, borderColor: '#808080', panning: true, panKey: 'shift'},
				title: {text: null},
				xAxis: {type: axisType, visible: xTime},
				yAxis: [{visible: true, title: {text: 'Amps'} }, {visible: false }, {visible: false }, {visible: false }, {visible: false }, {visible: false } ],
				tooltip: {
					formatter: function () {
						var s = (axisType === 'linear') ?
									Highcharts.dateFormat('%b %e, %H:%M', new Date(y.logTime[this.x])) + '<br/>' +
									Highcharts.dateFormat('%b %e, %H:%M',
										new Date(allRides.logTime[rideStart[this.x]])) :
									Highcharts.dateFormat('%b %e, %H:%M', new Date(this.x));
						$.each(this.points, function () {
							s += '<br/>' + this.series.name + ': <b>' +
								Highcharts.numberFormat(this.y, 0, '.', '') + '</b>';
						});
						return s;
					},
					shared: true
					/*formatter: function () {
						return this.series.name + ' ' + '<b>' +
							Highcharts.numberFormat(this.y, 0, '.', '') + '</b><br/>' +
							Highcharts.dateFormat('%b %e, %H:%M', new Date(y.logTime[this.x]));
					}*/
				},
				legend: {verticalAlign: 'top'},
				series: [{
					type: 'spline',
					name: 'Limit Amps',
					yAxis: 0,
					data: y1
				}, {
					type: 'spline',
					name: 'motRPM',
					yAxis: 1,
					data: y2
				}, {
					type: 'spline',
					name: 'minCell',
					yAxis: 2,
					data: y3
				}, {
					type: 'spline',
					name: 'motAmps',
					yAxis: 0,
					data: y4,
					zones: [{
						value: 0,
						color: '#c79a04'
					}]
				}, {
					type: 'spline',
					name: 'battAmps',
					yAxis: 0,
					data: y5,
					zones: [{
						value: 0,
						color: '#00c7d8'
					}]
				}, {
					type: 'spline',
					name: 'vPack',
					yAxis: 3,
					data: y6
				}]
			});
			return;
		case 5:
			y1[0] = 0;
			y1[1] = 0;
			y1[2] = 0;
			y1[3] = 0;
			y1[4] = 0;
			for (i = 0; i < split; i++) {
				y1[0] += splits[i].charging / 6;
				y1[1] += splits[i].disarmed / 60;
				y1[2] += splits[i].stopped / 60;
				y1[3] += splits[i].riding / 60;
			}
			y1[3] -= y1[2];
			if (xTime) {
				y1[4] = (maxDate - minDate) / 3600000;
			}
			chartVar = Highcharts.chart('container', {
				chart: {type: 'pie'},
				title: {text: null},
				tooltip: {
					pointFormat: '<b>{point.percentage:.1f}%</b><br/><b>{point.y:.1f}</b> hrs'
				},
				legend: {verticalAlign: 'top'},
				plotOptions: {
					pie: {
						allowPointSelect: true,
						cursor: 'pointer',
						dataLabels: {
							enabled: false
						},
						showInLegend: true
					}
				},
				series: [{
					name: 'Log Entries',
					colorByPoint: true
				},
					{data: [{
						name: 'Charging',
						sliced: true,
						selected: true,
						y: y1[0]
					}, {
						name: 'Disarmed',
						y: y1[1]
					}, {
						name: 'Riding',
						y: y1[3]
					}, {
						name: 'Stopped',
						y: y1[2]
					}, {
						name: 'Sleeping',
						visible: xTime,
						y: y1[4]
					}
						]}]
			});
			return;
		case 6:
			for (i = 0; i < allRides.logTime.length; i++) {
				for (j = 0; j < ride; j++) {
					if (i < rideEnd[j]) {y1[i] = j; }
					if (y1[i] < rideEnd[j + 1]) {break; }
				}
			}
			chartVar = Highcharts.chart('container', {
				chart: {zoomType: 'x', borderWidth: 2, borderColor: '#808080', panning: true, panKey: 'shift'},
				title: {text: null},
				xAxis: {type: 'linear', visible: false},
				yAxis: [{visible: false }, {visible: true, opposite: true, title: {text: 'Amps'} }, {min: 0, max: 100, tickAmount: 5, title: {text: null}
					}, {visible: false }, {visible: false }, {visible: false } ],
				tooltip: {
					formatter: function () {
						var s = 'Ride <b>' + (y1[this.x] + 1) + '</b><br/>' +
							Highcharts.dateFormat('%b %e, %H:%M',
								new Date(allRides.logTime[this.x]));
						$.each(this.points, function () {
							s += '<br/>' + this.series.name + ': <b>' +
								Highcharts.numberFormat(this.y, 0, '.', '') + '</b>';
						});
						return s;
					},
					shared: true
				},
				legend: {verticalAlign: 'top'},
				series: [{
					type: 'spline',
					name: 'Limit %',
					yAxis: 2,
					data: allRides.cutback
				}, {
					type: 'spline',
					name: 'Odometer',
					yAxis: 0,
					data: allRides.odo
				}, {
					type: 'spline',
					name: 'Charge %',
					yAxis: 2,
					data: allRides.packSOC
				}, {
					type: 'spline',
					name: 'motAmps',
					visible: false,
					yAxis: 1,
					data: allRides.motAmps,
					zones: [{
						value: 0,
						color: '#c79a04'
					}]
				}, {
					type: 'spline',
					name: 'motRPM',
					visible: false,
					yAxis: 3,
					data: allRides.motRPM
				}, {
					type: 'spline',
					name: 'ambTemp' + tempLbl,
					visible: false,
					yAxis: 4,
					data: allRides.ambTemp
				}]
			}, function (chartVar) {if (!xTime) {
				chartVar.xAxis[0].setExtremes(xStart, xEnd);
				$('#xaxis').text('Ride ' +
								 (y1[Math.floor(xStart)] + 1) +
								 ' - ' + (y1[Math.floor(xEnd - 2)] + 1));
			}
								   });
			return;
		case 7:
			ds = allRides.logTime.slice(rideStart[whichOne], rideEnd[whichOne]);
			y1 = allRides.cutback.slice(rideStart[whichOne], rideEnd[whichOne]);
			y2 = allRides.odo.slice(rideStart[whichOne], rideEnd[whichOne]);
			y3 = allRides.packSOC.slice(rideStart[whichOne], rideEnd[whichOne]);
			y4 = allRides.motAmps.slice(rideStart[whichOne], rideEnd[whichOne]);
			y5 = allRides.motRPM.slice(rideStart[whichOne], rideEnd[whichOne]);
			y6 = allRides.ambTemp.slice(rideStart[whichOne], rideEnd[whichOne]);
			chartVar = Highcharts.chart('container', {
				chart: {zoomType: 'x', borderWidth: 2, borderColor: '#808080', panning: true, panKey: 'shift'},
				title: {text: null},
				xAxis: {type: 'linear', visible: false},
				yAxis: [{visible: false }, {visible: true, opposite: true, title: {text: 'Amps'} }, {min: 0, max: 100,  tickAmount: 5, title: {text: null} }, {visible: false }, {visible: false }, {visible: false }  ],
				tooltip: {
					formatter: function () {
						return this.series.name + ' ' + '<b>' +
							Highcharts.numberFormat(this.y, 0, '.', '') + '</b><br/>' +
							Highcharts.dateFormat('%b %e, %H:%M', new Date(ds[this.x]));
					}
				},
				legend: {verticalAlign: 'top'},
				series: [{
					type: 'spline',
					name: 'Limit %',
					yAxis: 2,
					data: y1
				}, {
					type: 'spline',
					name: 'Odometer',
					yAxis: 0,
					data: y2
				}, {
					type: 'spline',
					name: 'Charge %',
					yAxis: 2,
					data: y3
				}, {
					type: 'spline',
					name: 'motAmps',
					yAxis: 1,
					data: y4,
					zones: [{
						value: 0,
						color: '#c79a04'
					}]
				}, {
					type: 'spline',
					name: 'motRPM',
					yAxis: 3,
					data: y5
				}, {
					type: 'spline',
					name: 'ambTemp' + tempLbl,
					visible: false,
					yAxis: 4,
					data: y6
				}]
			});
			return;
		case 8:
			for (i = 0; i < allCharges.logTime.length; i++) {
				y1[i] = (allCharges.battAmps[i] !== null) ?
						-1 * allCharges.battAmps[i] : null;
				for (j = 0; j < charge; j++) {
					if (i < chargeEnd[j]) {y2[i] = j; }
					if (y2[i] < chargeEnd[j + 1]) {break; }
				}
			}
			chartVar = Highcharts.chart('container', {
				chart: {alignTicks: false, zoomType: 'x', borderWidth: 2, borderColor: '#808080', panning: true, panKey: 'shift'},
				title: {text: null},
				xAxis: {type: 'linear', visible: false},
				yAxis: [{min: 0, visible: true, opposite: true, title: {text: 'Amps'} }, {visible: false }, {min: 0, max: 100, tickAmount: 5, title: {text: null}
					}, {visible: false }, {visible: false }, {visible: false } ],
				tooltip: {
					formatter: function () {
						var s = 'Charge <b>' + (y2[this.x] + 1) + '</b><br/>' +
							Highcharts.dateFormat('%b %e, %H:%M',
								new Date(allCharges.logTime[this.x]));
						$.each(this.points, function () {
							s += '<br/>' + this.series.name + ': <b>' +
								Highcharts.numberFormat(this.y, 0, '.', '') + '</b>';
						});
						return s;
					},
					shared: true
				},
				legend: {verticalAlign: 'top'},
				series: [{
					type: 'spline',
					name: 'BattAmps',
					yAxis: 0,
					data: y1
				}, {
					type: 'spline',
					name: 'ambTemp' + tempLbl,
					yAxis: 1,
					data: allCharges.ambTemp
				}, {
					type: 'spline',
					name: 'Charge %',
					yAxis: 2,
					data: allCharges.packSOC
				}, {
					type: 'spline',
					name: 'packTempH' + tempLbl,
					visible: false,
					yAxis: 1,
					data: allCharges.packTempH
				}, {
					type: 'spline',
					name: 'packTempL' + tempLbl,
					visible: false,
					yAxis: 1,
					data: allCharges.packTempL
				}, {
					type: 'spline',
					name: 'packV',
					visible: false,
					yAxis: 3,
					data: allCharges.vPack
				}]
			}, function (chartVar) {if (!xTime) {
				chartVar.xAxis[0].setExtremes(xStart, xEnd);
				$('#xaxis').text('Charge ' +
								 (y2[Math.floor(xStart)] + 1) +
								 ' - ' + (y2[Math.floor(xEnd - 2)] + 1));
			} });
			return;
		case 9:
			ds = allCharges.logTime.slice(chargeStart[whichOne], chargeEnd[whichOne]);
			y1 = allCharges.battAmps.slice(chargeStart[whichOne], chargeEnd[whichOne]);
			for (i = 0; i < y1.length; i++) {
				y1[i] = (y1[i] !== null) ? -1 * y1[i] : null;
			}
			y2 = allCharges.ambTemp.slice(chargeStart[whichOne], chargeEnd[whichOne]);
			y3 = allCharges.packSOC.slice(chargeStart[whichOne], chargeEnd[whichOne]);
			y4 = allCharges.packTempH.slice(chargeStart[whichOne], chargeEnd[whichOne]);
			y5 = allCharges.packTempL.slice(chargeStart[whichOne], chargeEnd[whichOne]);
			y6 = allCharges.vPack.slice(chargeStart[whichOne], chargeEnd[whichOne]);
			chartVar = Highcharts.chart('container', {
				chart: {alignTicks: false, zoomType: 'x', borderWidth: 2, borderColor: '#808080', panning: true, panKey: 'shift'},
				title: {text: null},
				xAxis: {type: 'linear', visible: false},
				yAxis: [{endOnTick: false, visible: false }, {visible: false }, {min: 0, max: 100,  tickAmount: 5, title: {text: null} }, {visible: false }, {visible: false }, {visible: false } ],
				tooltip: {
					formatter: function () {
						return this.series.name + ' ' + '<b>' +
							Highcharts.numberFormat(this.y, 0, '.', '') + '</b><br/>' +
							Highcharts.dateFormat('%b %e, %H:%M', new Date(ds[this.x]));
					}
				},
				legend: {verticalAlign: 'top'},
				series: [{
					type: 'spline',
					name: 'BattAmps',
					yAxis: 0,
					data: y1
				}, {
					type: 'spline',
					name: 'ambTemp' + tempLbl,
					yAxis: 1,
					data: y2
				}, {
					type: 'spline',
					name: 'Charge %',
					yAxis: 2,
					data: y3
				}, {
					type: 'spline',
					name: 'packTempH' + tempLbl,
					visible: false,
					yAxis: 1,
					data: y4
				}, {
					type: 'spline',
					name: 'packTempL' + tempLbl,
					visible: false,
					yAxis: 1,
					data: y5
				}, {
					type: 'spline',
					name: 'packV',
					visible: false,
					yAxis: 3,
					data: y6
				}]
			});
			return;
		} //switch
	} //drawChart	

	function dec(buf, type, offset, count) {
		var dv = new DataView(buf);

		switch (type) {
		case 'txt':
			return String.fromCharCode.apply(null, new Uint8Array(buf, offset, count)).replace(/[^ -~]+/g, '');
		case 'i16':
			return dv.getInt16(offset, true);
		case 'u16':
			return dv.getUint16(offset, true);
		case 'i32':
			return dv.getInt32(offset, true);
		case 'u32':
			return dv.getUint32(offset, true);
		}
	}

	function unescapeBlock(data) {
		var d = new Uint8Array(data),
			startOffset = 0,
			escapeOffset = d.indexOf(0xfe),
			d1,
			d2;

		while (escapeOffset !== -1) {
			escapeOffset += startOffset;
			d[escapeOffset] = d[escapeOffset] ^ d[escapeOffset + 1] - 1;
			d1 = d.slice(0, escapeOffset + 1);
			d2 = d.slice(escapeOffset + 2);
			d = new Uint8Array(d1.length + d2.length);
			d.set(d1);
			d.set(d2, d1.length);
			startOffset = escapeOffset + 1;
			escapeOffset = new Uint8Array(d.slice(startOffset)).indexOf(0xfe);
		}
		return d;
	}

	function countIt(buf, it) {
		var bv = new Uint8Array(buf),
			cnt = 0,
			i;

		for (i = 0; i < bv.byteLength; i++) {
			if (bv[i] === it) {cnt++; }
		}
		return cnt;
	}
	
	function parseEntry(logData, loc) {
		var header,
			headerBad,
			entry = {
				logTime: null,
				event: null,
				packTempH: null,
				packTempL: null,
				packSOC: null,
				vPack: null,
				motAmps: null,
				battAmps: null,
				motTemp: null,
				ctrlTemp: null,
				ambTemp: null,
				motRPM: null,
				odo: null,
				curLimit: null,
				cutback: null,
				minCell: null
			},
			maxAmps,
			block,
			messageType,
			timestamp,
			x = [];

		header = logData[loc];
		headerBad = header !== 0xb2;
		while (headerBad) {
			loc += 1;
			header = logData[loc];
			headerBad = header !== 0xb2;
		}
		entry.length = logData[loc + 1];
		messageType = logData[loc + 2];
		// include possible next message in block length +15? more?
		block = unescapeBlock(logData.slice(loc + 2, loc + 25 + entry.length));
		timestamp = dec(block.buffer, 'u32', 1);
		if (timestamp > 0x43B761D0) { // no Zero's before 2006!
			entry.logTime = timestamp * 1000;
		} else {
			return entry; // no use for non-timestamped entries
		}
		x = new Uint8Array(block.length - 5);
		x.set(block.slice(5)); // message after timestamp
		switch (messageType) {
		case 0x2c: // run_status merged with discharge limit
			entry.packTempH = Math.round(x[0] * tempScale + tempOffset);
			entry.packTempL = Math.round(x[1] * tempScale + tempOffset);
			entry.packSOC = dec(x.buffer, 'u16', 2);
			entry.vPack =  dec(x.buffer, 'u32', 4) / 1000;
			entry.motTemp = Math.round(dec(x.buffer, 'i16', 8) * tempScale + tempOffset);
			entry.ctrlTemp = Math.round(dec(x.buffer, 'i16', 0xa) * tempScale + tempOffset);
			entry.motRPM = dec(x.buffer, 'u16', 0xc);
			entry.battAmps = dec(x.buffer, 'i16', 0x10);
			entry.motAmps = dec(x.buffer, 'i16', 0x13);
			entry.ambTemp = Math.round(dec(x.buffer, 'i16', 0x15) * tempScale + tempOffset);
			entry.odo = Math.round(dec(x.buffer, 'u32', 0x17) * distScale * 10) / 10;
			if (x[0x1d] === 0x39) { // limit msg next
				entry.curLimit = dec(x.buffer, 'u16', 0x22);
				entry.minCell = dec(x.buffer, 'u16', 0x24);
				maxAmps = dec(x.buffer, 'u16', 0x27);
				if (maxAmps) { entry.cutback = Math.floor(entry.curLimit * 100 / maxAmps); }
			}
			entry.event = 'Riding  ';
			return entry;
		case 0x2d: // charging_status
			entry.packTempH = Math.round(x[0] * tempScale + tempOffset);
			entry.packTempL = Math.round(x[1] * tempScale + tempOffset);
			entry.packSOC = dec(x.buffer, 'u16', 2);
			entry.vPack =  dec(x.buffer, 'u32', 4) / 1000;
			entry.battAmps = dec(x.buffer, 'i16', 8);
			entry.ambTemp = Math.round(dec(x.buffer, 'i16', 0xd) * tempScale + tempOffset);
			entry.event = 'Charging';
			return entry;
		case 0x3c: // disarmed_status
			entry.packTempH = Math.round(x[0] * tempScale + tempOffset);
			entry.packTempL = Math.round(x[1] * tempScale + tempOffset);
			entry.packSOC = dec(x.buffer, 'u16', 2);
			entry.vPack =  dec(x.buffer, 'u32', 4) / 1000;
			entry.motTemp = Math.round(dec(x.buffer, 'i16', 8) * tempScale + tempOffset);
			entry.ctrlTemp = Math.round(dec(x.buffer, 'i16', 0xa) * tempScale + tempOffset);
			entry.motRPM = dec(x.buffer, 'u16', 0xc);
			entry.battAmps = dec(x.buffer, 'i16', 0x10);
			entry.motAmps = dec(x.buffer, 'i16', 0x13);
			entry.ambTemp = Math.round(dec(x.buffer, 'i16', 0x15) * tempScale + tempOffset);
			entry.odo = Math.round(dec(x.buffer, 'u32', 0x17) * distScale * 10) / 10;
			entry.event = 'Disarmed';
			return entry;
		default: // unknown or unused type, return null
			return entry;
		}
	}

	function parseLog(bin) {
		var i,
			logType = dec(bin, 'txt', 0, 3),
			ba = new Uint8Array(bin),
			count = countIt(bin, 0xa2),
			hdr = ba.indexOf(0xa2),
			dv = new DataView(bin),
			u32 = dec(bin, 'u32', hdr),
			entriesStart = ba.indexOf(0xb2),
			entriesEnd = ba.byteLength,
			entriesDataBegin = 0,
			entriesCount = 0,
			eventLog = [],
			eventLogFirst = [],
			eventLogSecond = [],
			readPos = 0,
			entry = {},
			maxOdo,
			minOdo,
			minPctLimit,
			maxRPM,
			ridings = 0,
			wasArmed = false,
			newSplit = false,
			timeJump = false,
			armed = false,
			//rpmSpeed = 0.0226, //FX km
			model = dec(bin, 'txt', 0x27f, 3),
			prevTime = 0;
		
		function getYs(k, v) {v[pts] = entry[k]; }
		function makeNull(k, v) {v[pts] = null; }

		if (bin.byteLength > 0x100000 || bin.byteLength < 0x20000) {
			$('#print').text('File size out of range.');
			$('#container').css('display', 'none'); // hide
			$('#disclaim').css('display', 'none');
			fileGood = false;
			return;
		}

		if (logType !== 'MBB') {
			$('#print').text('Not an MBB log file.');
			$('#container').css('display', 'none'); // hide
			$('#disclaim').css('display', 'none'); // hide
			fileGood = false;
			return;
		}

		do {
			if (u32 === 0xa2a2a2a2) {
				entriesEnd = dec(bin, 'u32', hdr + 4);
				entriesStart = dec(bin, 'u32', hdr + 8);
				entriesDataBegin = hdr + 16;
				break;
			}
			count--;
			ba = new Uint8Array(bin, hdr + 1);
			hdr += ba.indexOf(0xa2) + 1;
			u32 = dec(bin, 'u32', hdr);
		} while (count > 0);

		if (entriesStart >= entriesEnd) {
			eventLogFirst = new Uint8Array(bin, entriesStart);
			eventLogSecond =
				new Uint8Array(bin, entriesDataBegin, entriesEnd - entriesDataBegin);
			eventLog = new Uint8Array(eventLogFirst.length + eventLogSecond.length);
			eventLog.set(eventLogFirst);
			eventLog.set(eventLogSecond, eventLogFirst.length);
		} else {
			eventLog = new Uint8Array(bin, entriesStart, entriesEnd - entriesStart);
		} // Handle data wrapping across the upper bound of the ring buffer

		entriesCount = countIt(eventLog, 0xb2);
		
		$.each(y, function (k, v) {
			v.length = 0;
		});
		$.each(allRides, function (k, v) {
			v.length = 0;
		});
		$.each(allCharges, function (k, v) {
			v.length = 0;
		});

		pts = 0;
		splits = {};
		split = 0;
		splits[0] = {};
		splits[split].riding = 0;
		splits[split].charging = 0;
		splits[split].disarmed = 0;
		splits[split].stopped = 0;
		splits[split].start = 0;
		rides = {};
		ride = 0;
		rides[0] = {};
		charges = {};
		charge = 0;
		charges[0] = {};
		wasArmed = false;
		timeJump = false;
		newSplit = false;
		rideStart = [];
		rideEnd = [];
		chargeStart = [];
		chargeEnd = [];
		
		for (i = 0; i < entriesCount; i++) {
			entry = parseEntry(eventLog, readPos);
			if (entry.event !== null) {
				if (entry.odo !== null) {armed = true;
					} else {armed = false; }
// new split if time is not expected interval, 60s for riding, 600s charging, or change in armed state, armed indicates odo not null	
				newSplit = (wasArmed && !armed) ||
					(!wasArmed && armed) ||
					(armed && (entry.logTime > (prevTime + 61000))) ||
					(!armed && (entry.logTime > (prevTime + 601000)));
				if (newSplit && pts) {
					$.each(y, makeNull);
					y.logTime[pts] = entry.logTime;
					pts++; // include null in split					
					splits[split].end = pts; // no -1 for slice
					if (splits[split].riding > minRide) {
						rides[ride] = splits[split];
						ride++;
					}
					if (splits[split].charging > minCharge) {
						charges[charge] = splits[split];
						charge++;
					}
					split++;
					splits[split] = {};
					splits[split].riding = 0;
					splits[split].charging = 0;
					splits[split].disarmed = 0;
					splits[split].stopped = 0;
					splits[split].start = pts;
				}
				if (entry.event === 'Riding  ') {
					splits[split].riding++;
					if (entry.motRPM === 0) {
						splits[split].stopped++;
					}
				}
				if (entry.event === 'Charging') {
					splits[split].charging++;
				}
				if (entry.event === 'Disarmed') {
					splits[split].disarmed++;
				}
				wasArmed = armed;
				prevTime = entry.logTime;
				$.each(y, getYs); // copy entry to y array
				if (entry.event === 'Riding  ') {ridings++;	}
				pts++;
			}
			readPos += entry.length;
		} // for entries
				
		$.each(allRides, function (k, v) {
			for (i = 0; i < ride; i++) {
				allRides[k] = allRides[k].concat(y[k].slice(rides[i].start, rides[i].end));
			}
		});
		
		rideStart[0] = 0;
		for (i = 0; i < ride; i++) {
			rideEnd[i] = rideStart[i] +
				rides[i].end - rides[i].start - 1;
			rideStart[i + 1] = rideEnd[i] + 1;
		}

		$.each(allCharges, function (k, v) {
			for (i = 0; i < charge; i++) {
				allCharges[k] = allCharges[k].concat(y[k].slice(charges[i].start, charges[i].end));
			}
		});
				
		chargeStart[0] = 0;
		for (i = 0; i < charge; i++) {
			chargeEnd[i] = chargeStart[i] +
				charges[i].end - charges[i].start - 1;
			chargeStart[i + 1] = chargeEnd[i] + 1;
		}
		
		fileGood = true;
		if (!newUnits) {
			chartPick = 1;
			plotMode = 4;
			$('#xaxis').trigger('click');
		}
		newUnits = false;
		drawChart(chartPick);

		maxDate = new Date(getMaxOfArray(y.logTime));
		minDate = new Date(getMinOfArray(y.logTime));
		maxOdo = getMaxOfArray(y.odo);
		minOdo = getMinOfArray(y.odo);
		maxRPM = getMaxOfArray(y.motRPM);
		$('#print').text(pts + ' points Zero ' + model);
		$('#logdates').text(minDate.toLocaleDateString() + ' to ' + maxDate.toLocaleDateString() + ' odo: ' +
			Math.round(minOdo) + ' - ' + Math.round(maxOdo));
		//$('#days').text(((maxDate - minDate) / 86400000).toFixed(0));
		$('#dist').text(Math.round(maxOdo - minOdo));
		$('#mtemp').html(getMaxOfArray(y.motTemp) + '&deg;');
		$('#minpct').text(getMinOfArray(y.cutback) + '%');
		$('#mmax').text(getMaxOfArray(y.motAmps));
		$('#mmin').text(getMinOfArray(y.motAmps));
		$('#bmin').text(getMinOfArray(y.battAmps));
		$('#bmax').text(getMaxOfArray(y.battAmps));
		$('#rmin').html(getMinOfArray(y.ambTemp) + '&deg;');
		$('#rmax').html(getMaxOfArray(y.ambTemp) + '&deg;');
		$('#mrpm').text(maxRPM);
		$('#rhours').text((ridings / 60).toFixed(1));
		//$('#mspeed').text(maxRPM * rpmSpeed * distScale).toFixed(0));
		$('#avgspd').text(((maxOdo - minOdo) / (ridings / 60)).toFixed(1));
		return;
	} // parseLog
	
	$('#choose').change(function readFile() {
		var files = $("#choose").prop('files'),
			reader = new FileReader();
		
		$('#fname').text('');
		$('#print').text('Parsing...');
		if (!files.length) {
			$('#print').text('Could not parse, file not found.');
			$('#container').css('display', 'none'); // hide	
			$('#disclaim').css('display', 'block');
			fileGood = false;
			return;
		}
		if (files[0].name.slice(-4) !== '.bin') {
			$('#print').text('Could not parse, filename must end in .bin');
			$('#container').css('display', 'none');
			$('#disclaim').css('display', 'block');
			fileGood = false;
			return;
		}
		reader.onloadend = function (evt) {
			if (evt.target.readyState === FileReader.DONE) {
				logFileName = files[0].name.split('.bin')[0];
				$('#intro').text(logFileName);
				Highcharts.setOptions({exporting: {filename: logFileName, chartOptions: {subtitle: {text: logFileName, y: 36}}}});
				$('#print').text('Could not parse');
				$('#container').css('display', 'none'); // hide
				$('#disclaim').css('display', 'block');
				fileGood = false;
				logBinary = evt.target.result;
				parseLog(logBinary);
			} else {
				$('#print').text('File error');
				$('#container').css('display', 'none'); // hide
				$('#disclaim').css('display', 'block');
				fileGood = false;
			}
		};
		reader.readAsArrayBuffer(files[0]);
	});
	
	$('#usemiles').change(function () {
		if ($('#usemiles').is(":checked")) {
			distLbl = 'mi';
			$('#mileslabel').text(distLbl);
			distScale = 0.621371;
		} else {
			distLbl = 'km';
			$('#mileslabel').text(distLbl);
			distScale = 1;
		}
		newUnits = true;
		parseLog(logBinary);
	});
	
	$('#usefahrenheit').change(function () {
		if ($('#usefahrenheit').is(":checked")) {
			tempLbl = '\xb0F';
			$('#templabel').text(tempLbl);
			tempScale = 1.8;
			tempOffset = 32;
		} else {
			tempLbl = '\xb0C';
			$('#templabel').text(tempLbl);
			tempScale = 1.0;
			tempOffset = 0;
		}
		newUnits = true;
		parseLog(logBinary);
	});
	
	function rdioLabels(state) {
		switch (state) {
		case 0:
			$('#r1').text('1');
			$('#r2').text('2');
			$('#r3').text('3');
			$('#r4').text('4');
			$('#r5').text('5');
			return;
		case 1:
			$('#r1').text('1');
			$('#r2').text('2');
			$('#r3').text('3');
			$('#r4').text('4');
			$('#r5').text('5');
			return;
		case 2:
			$('#r1').html('<b>|&lt;</b>');
			$('#r2').html('<b>&lt;</b>');
			$('#r3').html('one');
			$('#r4').html('<b>&gt;</b>');
			$('#r5').html('<b>&gt;|</b>');
			useAll = false;
			$('#c1').trigger('click');
			return;
		case 3:
			$('#r1').html('<b>&lt;&lt;</b>');
			$('#r2').html('<b>-</b>');
			$('#r3').html('all');
			$('#r4').html('<b>+</b>');
			$('#r5').html('<b>&gt;&gt;</b>');
			return;
		}
	}
	
	$('#xaxis').click(function () {
		plotMode++;
		if (plotMode > 3) {plotMode = 0; }
		switch (plotMode) {
		case 0:
			$('#xaxis').text('Events');
			xTime = false;
			filtered = false;
			$('#c1').trigger('click');
			rdioLabels(0);
			return;
		case 1:
			$('#xaxis').text('Times');
			xTime = true;
			filtered = false;
			$('#c1').trigger('click');
			rdioLabels(1);
			return;
		case 2:
			//$('#xaxis').text('Rides');
			xTime = false;
			filtered = true;
			viewRide = true;
			whichOne = 0;
			useAll = false;
			whatZoom = 0;
			whatShift = 0;
			$('#c3').trigger('click');
			useAll = true;
			rdioLabels(3);
			return;
		case 3:
			//$('#xaxis').text('Charges');
			xTime = false;
			filtered = true;
			viewRide = false;
			whichOne = 0;
			useAll = false;
			whatZoom = 0;
			whatShift = 0;
			$('#c3').trigger('click');
			useAll = true;
			rdioLabels(3);
			return;
		}
	});
	
	function flash() {$(flashWhat).css('background-color', '#bfdfed'); }
	
	function zoom() {
		whatZoom = (whatZoom < 1) ? 1 : whatZoom;
		xIncrement = 1 / (Math.pow(2, whatZoom)) * xRange;
		whatZoom =  (xIncrement < 5) ? whatZoom - 1 : whatZoom;
		xStart = xCenter - xIncrement;
		xEnd = xCenter + xIncrement;
	}
	
	function shift(dir) {
		xStart +=  dir * xIncrement;
		xEnd +=  dir * xIncrement;
		if ((xStart < 0) || (xEnd > xRange)) {
			xStart -=  dir * xIncrement;
			xEnd -=  dir * xIncrement;
		}
	}
	
	$('#c1').click(function () {
		chartPick = 1;
		$('#r1').css('background-color', '#e8e8e8');
		$('#r2').css('background-color', '#bfdfed');
		$('#r3').css('background-color', '#bfdfed');
		$('#r4').css('background-color', '#bfdfed');
		$('#r5').css('background-color', '#bfdfed');
		if (filtered) {
			$('#r3').css('background-color', '#e8e8e8');
			flashWhat = '#r1';
			setTimeout(flash, 300);
			if (useAll) {
				chartPick = (viewRide) ? 6 : 8;
				shift(-1);
			} else {
				chartPick = (viewRide) ? 7 : 9;
				whichOne = 0;
				whichLabel = (viewRide) ? 'Ride ' : 'Charge ';
				$('#xaxis').text(whichLabel + (whichOne + 1));
			}
		}
		if (fileGood) {setTimeout(drawChart, 10); }
	});
	
	$('#c2').click(function () {
		chartPick = 2;
		$('#r1').css('background-color', '#bfdfed');
		$('#r2').css('background-color', '#e8e8e8');
		$('#r3').css('background-color', '#bfdfed');
		$('#r4').css('background-color', '#bfdfed');
		$('#r5').css('background-color', '#bfdfed');
		if (filtered) {
			$('#r3').css('background-color', '#e8e8e8');
			flashWhat = '#r2';
			setTimeout(flash, 300);
			if (useAll) {
				chartPick = (viewRide) ? 6 : 8;
				whatZoom--;
				zoom();
			} else {
				chartPick = (viewRide) ? 7 : 9;
				whichOne--;
				whichOne = (whichOne < 0) ? 0 : whichOne;
				whichLabel = (viewRide) ? 'Ride ' : 'Charge ';
				$('#xaxis').text(whichLabel + (whichOne + 1));
			}
		}
		if (fileGood) {setTimeout(drawChart, 10); }
	});
	
	$('#c3').click(function () {
		chartPick = 3;
		if (filtered) {
			if (!useAll) {
				rdioLabels(3);
				xRange =  (viewRide) ? allRides.logTime.length : allCharges.logTime.length;
				xCenter = xRange / 2;
				chartPick = (viewRide) ? 6 : 8;
				useAll = true;
				whatZoom = 1;
				zoom();
			} else {
				rdioLabels(2);
				chartPick = (viewRide) ? 7 : 9;
				useAll = false;
			}
		}
		$('#r1').css('background-color', '#bfdfed');
		$('#r2').css('background-color', '#bfdfed');
		$('#r3').css('background-color', '#e8e8e8');
		$('#r4').css('background-color', '#bfdfed');
		$('#r5').css('background-color', '#bfdfed');
		if (fileGood) {setTimeout(drawChart, 10); }
	});
	
	$('#c4').click(function () {
		chartPick = 4;
		$('#r1').css('background-color', '#bfdfed');
		$('#r2').css('background-color', '#bfdfed');
		$('#r3').css('background-color', '#bfdfed');
		$('#r4').css('background-color', '#e8e8e8');
		$('#r5').css('background-color', '#bfdfed');
		if (filtered) {
			$('#r3').css('background-color', '#e8e8e8');
			flashWhat = '#r4';
			setTimeout(flash, 300);
			if (useAll) {
				chartPick = (viewRide) ? 6 : 8;
				whatZoom++;
				zoom();
			} else {
				whichOne++;
				if (viewRide) {
					chartPick = 7;
					whichLabel = 'Ride ';
					whichOne = (whichOne > (ride - 1)) ? ride - 1 : whichOne;
				} else {
					chartPick = 9;
					whichLabel = 'Charge ';
					whichOne = (whichOne > (charge - 1)) ? charge - 1 : whichOne;
				}
				$('#xaxis').text(whichLabel + (whichOne + 1));
			}
		}
		if (fileGood) {setTimeout(drawChart, 10); }
	});
	
	$('#c5').click(function () {
		chartPick = 5;
		$('#r1').css('background-color', '#bfdfed');
		$('#r2').css('background-color', '#bfdfed');
		$('#r3').css('background-color', '#bfdfed');
		$('#r4').css('background-color', '#bfdfed');
		$('#r5').css('background-color', '#e8e8e8');
		if (filtered) {
			$('#r3').css('background-color', '#e8e8e8');
			flashWhat = '#r5';
			setTimeout(flash, 300);
			if (useAll) {
				chartPick = (viewRide) ? 6 : 8;
				shift(1);
			} else {
				chartPick = (viewRide) ? 7 : 9;
				whichOne = (viewRide) ? ride - 1 : charge - 1;
				whichLabel = (viewRide) ? 'Ride ' : 'Charge ';
				$('#xaxis').text(whichLabel + (whichOne + 1));
			}
		}
		if (fileGood) {setTimeout(drawChart, 10); }
	});
});

var favIcon = "AAABAAEAEBAAAAEAIABoBAAAFgAAACgAAAAQAAAAIAAAAAEAIAAAAAAAAAQAABMLAAATCwAAAAAAAAAAAAAAAABYAAAAgAAAADIAAAAbAAAAIAAAADQAAABTAAAAaQAAAIEAAACjAAAAxwAAAOIAAADeAAAAjwAAABQAAAAAAAAANAAAAMsAAADrAAAA1wAAANsAAADsAAAA+wAAAPsAAAD7AAAA9gAAAOIAAAC2AAAAgwAAAJ8AAAB+AAAAAQAAAAAAAAAuAAAAxQAAAP8AAAD5AAAAswAAAIcAAABgAAAATQAAADwAAAAgAAAABwAAAAAAAABgAAAAwQAAABEAAAAAAAAAAAAAACYAAADCAAAA/wAAAJYAAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAcAAAA2AAAALAAAAAJAAAAAAAAAAAAAAAAAAAALQAAANIAAAD7AAAAeAAAAAMAAAAAAAAAAAAAAAAAAAAAAAAACQAAAFIAAAApAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABCAAAA5AAAAPEAAABbAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAF0AAADyAAAA4wAAAEEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAAAAegAAAPsAAADQAAAAKgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAsAAACXAAAA/wAAALgAAAAZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFgAAALMAAAD/AAAAnQAAAAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAmAAAAzAAAAPwAAACAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAhAAAAHQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADwAAADgAAAA9AAAAGIAAAAAAAAAAAAAAAAAAAAQAAAAvQAAAKYAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUgAAAO0AAADnAAAASQAAAAAAAAAAAAAAEgAAAM0AAACcAAAAAAAAAAAAAAAHAAAAJQAAAE0AAABrAAAAdQAAAGQAAACvAAAA/wAAANkAAAA5AAAAAAAAAAAAAABqAAAAswAAAFAAAABsAAAAsgAAAOQAAAD3AAAA+gAAAPgAAADyAAAA7AAAAPUAAAD9AAAA0wAAADoAAAAAAAAABgAAAFcAAACoAAAAvQAAAKwAAACMAAAAbQAAAFkAAABNAAAARwAAAEcAAABOAAAAYwAAAJwAAABsAAEAAAAAAACACAAAwfAAAODxAADw/wAA+H8AAPg/AAD8HwAA/g";
var favLink = document.createElement('link');
favLink.rel = 'shortcut icon';
favLink.href = 'data:image/png;base64,' + favIcon;
document.getElementsByTagName('head')[0].appendChild(favLink);