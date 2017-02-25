/*
zero-parse.js
Decoder for Zero motorcycle MBB or BMS log files.
1.0 
02/22/2017

Copyright 2017 Keith Thomas

License: MIT https://github.com/keithxemi/browser-parse/blob/master/LICENSE


*/

/* jslint browser: true  */
/*global saveAs, Blob, FileReader, DataView, Uint8Array, Uint16Array, Uint32Array */

(function () {
	'use strict';
	
	var logFileName,
		parsedText;
	
	function dec(buf, type, offset, count) {
		var dv = new DataView(buf);

		switch (type) {
		case 'txt':
			return String.fromCharCode.apply(null, new Uint8Array(buf, offset, count)).replace(/[^ -~]+/g, '');
			//return decoder.decode(new Uint8Array(buf, offset, count)).replace(/[^ -~]+/g, "");, TextDecoder decoder = new TextDecoder('utf-8'),
		case 'i16':
			return dv.getInt16(offset, true);
		case 'u16':
			return dv.getUint16(offset, true);
		case 'i32':
			return dv.getInt32(offset, true);
		case 'u32':
			return dv.getUint32(offset, true);
		default:
			return 'bullshit';
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

	function formatDate(date) {
		var year = date.getFullYear(),
			month = (1 + date.getMonth()).toString(),
			day = date.getDate().toString(),
			hours = date.getHours().toString(),
			minutes = date.getMinutes().toString(),
			seconds = date.getSeconds().toString();

		month = month.length > 1 ? month : '0' + month;
		day = day.length > 1 ? day : '0' + day;
		hours = hours.length > 1 ? hours : '0' + hours;
		minutes = minutes.length > 1 ? minutes : '0' + minutes;
		seconds = seconds.length > 1 ? seconds : '0' + seconds;
		return '     ' + month + '/' + day + '/' + year + ' ' +
			hours + ':' + minutes + ':' + seconds;
	}  // local time

	function byteToHex(b) {
		var hexChar = ['0', '1', '2', '3', '4', '5', '6', '7', '8',
					   '9', 'a', 'b', 'c', 'd', 'e', 'f'];
		return '0x' + hexChar[(b >> 4) & 0x0f] + hexChar[b & 0x0f];
	}

	function countIt(buf, it) {
		var bv = new Uint8Array(buf),
			cnt = 0,
			i;

		for (i = 0; i < bv.byteLength; i++) {
			if (bv[i] === it) {
				cnt++;
			}
		}
		return cnt;
	}
	
	function parseEntry(logData, address) {
		var header,
			headerBad,
			entry = {},
			unescapedBlock,
			messageType,
			ts,
			timestamp,
			asDate,
			ms,
			x = [],
			i = 0,
			m = '',
			f = {};
		
		header = logData[address];
		headerBad = header !== 0xb2;
		while (headerBad) {
			address += 1;
			header = logData[address];
			headerBad = header !== 0xb2;
		}
		entry.length = logData[address + 1];
		unescapedBlock = unescapeBlock(logData.slice(address +
													 2, address + 3 + entry.length));
		ms = unescapedBlock.slice(0, 2);
		messageType = new Uint8Array(ms.buffer)[0];
		ts = unescapedBlock.slice(1, 5);
		timestamp = new Uint32Array(ts.buffer)[0];
		x = new Uint8Array(unescapedBlock.length - 5);
		x.set(unescapedBlock.slice(5));
		
		entry.event = '';
		entry.conditions = '';
		entry.unknown = '';

		if (timestamp > 0xfff) {
			asDate = new Date(timestamp * 1000);
			entry.time = formatDate(asDate);
		} else {
			entry.time = ('                        ' + timestamp).slice(-24);
		}
		
// Unknown entry types to be added when defined: type, length, source, example		
		switch (messageType) {
		case 0x01: // board_status
			entry.event = 'BMS Reset';
			if (x[0] === 4) {
				entry.conditions = 'Software';
			} else {
				entry.conditions = 'Unknown';
			}
			return entry;
		//case 0x02: unknown, 2, 6350_MBB_2016-04-12, 0x02 0x2e 0x11 ???
		case 0x03: // bms_discharge_level
			switch (x[0xf]) {
			case 1:
				m = 'Bike On';
				break;
			case 2:
				m = 'Charge';
				break;
			case 3:
				m = 'Idle';
				break;
			default:
				m = 'Unknown';
				break;
			}
			f.AH = ('000' + Math.floor((dec(x.buffer, 'u32', 6) / 1000000))).slice(-3);
			f.B = ('000' + (dec(x.buffer, 'u16', 2) - dec(x.buffer, 'u16', 0))).slice(-3);
			f.I = ('000' + Math.floor(dec(x.buffer, 'i32', 0x10) / 1000000)).slice(-3);
			f.L = dec(x.buffer, 'u16', 0);
			f.H = dec(x.buffer, 'u16', 2);
			f.PT = ('000' + x[4]).slice(-3);
			f.BT = ('000' + x[5]).slice(-3);
			f.SOC = ('   ' + x[0xa]).slice(-3);
			f.PV = dec(x.buffer, 'u32', 0xb);
			f.l = dec(x.buffer, 'u16', 0x14);
			f.M = m;
			f.X = dec(x.buffer, 'u16', 0x16); // not included in log, contactor voltage?
			entry.event = 'Discharge level';
			entry.conditions =
				f.AH + ' AH,' +
				' SOC:' + f.SOC + '%,' +
				' I:' + f.I + 'A,' +
				' L:' + f.L + ',' +
				' l:' + f.l + ',' +
				' H:' + f.H + ',' +
				' B:' + f.B + ',' +
				' PT:' + f.PT + 'C,' +
				' BT:' + f.BT + 'C,' +
				' PV:' + f.PV + ',' +
				' M:' + m;
			return entry;
		case 0x04: // bms_charge_full
			f.AH = ('000' + Math.floor((dec(x.buffer, 'u32', 6) / 1000000))).slice(-3);
			f.B = ('000' + (dec(x.buffer, 'u16', 2) - dec(x.buffer, 'u16', 0))).slice(-3);
			f.L = dec(x.buffer, 'u16', 0);
			f.H = dec(x.buffer, 'u16', 2);
			f.PT = ('000' + x[4]).slice(-3);
			f.BT = ('000' + x[5]).slice(-3);
			f.SOC = ('   ' + x[0xa]).slice(-3);
			f.PV = dec(x.buffer, 'u32', 0xb);
			entry.event = 'Charged To Full';
			entry.conditions =
				f.AH + ' AH,' +
				' SOC:' + f.SOC + '%,' +
				'         L:' + f.L + ',' +
				'         H:' + f.H + ',' +
				' B:' + f.B + ',' +
				' PT:' + f.PT + 'C,' +
				' BT:' + f.BT + 'C,' +
				' PV:' + f.PV;
			return entry;
		// case 0x05: unknown, 17, 6890_BMS0_2016-07-03, 0x05 0x34 0x0b 0xe0 0x0c 0x35 0x2a 0x89 0x71 0xb5 0x01 0x00 0xa5 0x62 0x01 0x00 0x20 0x90 ???
		case 0x06: // bms_discharge_low
			f.AH = ('000' + Math.floor((dec(x.buffer, 'u32', 6) / 1000000))).slice(-3);
			f.B = ('000' + (dec(x.buffer, 'u16', 2) - dec(x.buffer, 'u16', 0))).slice(-3);
			f.L = dec(x.buffer, 'u16', 0);
			f.H = dec(x.buffer, 'u16', 2);
			f.PT = ('000' + x[4]).slice(-3);
			f.BT = ('000' + x[5]).slice(-3);
			f.SOC = ('   ' + x[0xa]).slice(-3);
			f.PV = dec(x.buffer, 'u32', 0xb);
			entry.event = 'Discharged To Low';
			entry.conditions =
				f.AH + ' AH,' +
				' SOC:' + f.SOC + '%,' +
				'         L:' + f.L + ',' +
				'         H:' + f.H + ',' +
				' B:' + f.B + ',' +
				' PT:' + f.PT + 'C,' +
				' BT:' + f.BT + 'C,' +
				' PV:' + f.PV;
			return entry;
		case 0x08: // bms_system_state
			if (x[0] === 0) {
				entry.event = 'System Turned Off';
			} else {
				entry.event = 'System Turned On';
			}
			return entry;
		case 0x09: // key_state
			if (x[0] === 0) {
				entry.event = 'Key Off';
			} else {
				entry.event = 'Key On';
			}
			return entry;
		case 0x0b: // bms_soc_adj_voltage
			f.old = dec(x.buffer, 'u32', 0);
			f.oldSoc = x[4];
			f.anew = dec(x.buffer, 'u32', 5);
			f.newSoc = x[9];
			f.low = dec(x.buffer, 'u16', 0x0a);
			entry.event = 'SOC adjusted for voltage';
			entry.conditions = 'old:   ' + f.old + 'uAH (soc:' + f.oldSoc +
				'%), new:   ' + f.anew + 'uAH (soc:' + f.newSoc +
				'%), low cell: ' + f.low + ' mV';
			return entry;
		case 0x0d: // bms_curr_sens_zero
			f.old = dec(x.buffer, 'u16', 0);
			f.anew = dec(x.buffer, 'u16', 2);
			f.cf = x[4];
			entry.event = 'Current Sensor Zeroed';
			entry.conditions = 'old: ' + f.old + 'mV, ' +
                           'new: ' + f.anew + 'mV, ' +
                           'corrfact: ' + f.cf;
			return entry;
		//case 0x0e: unknown, 3, 6350_BMS0_2017-01-30 0x0e 0x05 0x00 0xff ???
		case 0x10: // bms_state
			if (x[0] === 0) {
				entry.event = 'Exiting Hibernate';
			} else {
				entry.event = 'Entering Hibernate';
			}
			return entry;
		case 0x11: // bms_isolation_fault
			f.ohms = dec(x.buffer, 'u32', 0);
			f.cell = x[4];
			entry.event = 'Chassis Isolation Fault';
			entry.conditions = f.ohms + ' ohms to cell ' + f.cell;
			return entry;
		case 0x12: // bms_reflash
			f.rev = x[0];
			f.build = dec(x.buffer, 'txt', 1, 20);
			entry.event = 'BMS Reflash';
			entry.conditions = 'Revision ' + f.rev + ' Built ' + f.build;
			return entry;
		case 0x13: // bms_change_can_id
			f.old = ('0' + x[0]).slice(-2);
			f.anew = ('0' + x[1]).slice(-2);
			entry.event = 'Changed CAN Node ID';
			entry.conditions = 'old: ' + f.old + ', new: ' + f.anew;
			return entry;
		case 0x15: // bms_contactor_state
			f.pv = dec(x.buffer, 'u32', 1);
			f.sv = dec(x.buffer, 'u32', 5);
			f.dc = dec(x.buffer, 'u32', 9);
			f.prechg = 0;
			if (dec(x.buffer, 'u32', 1)) {
				f.prechg = (dec(x.buffer, 'u32', 5) /
							dec(x.buffer, 'u32', 1) * 100).toFixed(0);
			}
			m = 'Contactor was Opened';
			if (x[0]) {
				m = 'Contactor was Closed';
			}
			entry.event = m;
			entry.conditions = 'Pack V: ' + f.pv + 'mV, Switched V: ' + f.sv +
				'mV, Prechg Pct: ' + f.prechg + '%, Dischg Cur: ' + f.dc + 'mA';
			return entry;
		case 0x16: // bms_discharge_cut
			f.cut = (x[0] / 255 * 100).toFixed(0);
			entry.event = 'Discharge cutback';
			entry.conditions = f.cut + '%';
			return entry;
		case 0x18: // bms_contactor_drive
			f.pv = dec(x.buffer, 'u32', 1);
			f.sv = dec(x.buffer, 'u32', 5);
			f.dc = x[9];
			entry.event = 'Contactor drive turned on';
			entry.conditions = 'Pack V: ' + f.pv + 'mV, Switched V: ' + f.sv + 'mV, Duty Cycle: ' + f.dc + '%';
			return entry;
		//case 0x1c: unknown, 8, 3455_MBB_2016-09-11, 0x1c 0xdf 0x56 0x01 0x00 0x00 0x00 0x30 0x02 ???
		//case 0x1e: unknown, 4, 6472_MBB_2016-12-12, 0x1e 0x32 0x00 0x06 0x23 ???
		//case 0x1f: unknown, 4, 5078_MBB_2017-01-20, 0x1f 0x00 0x00 0x08 0x43 ???
		//case 0x20: unknown, 3, 6472_MBB_2016-12-12, 0x20 0x02 0x32 0x00 ???
		//case 0x26: unknown, 6, 3455_MBB_2016-09-11, 0x26 0x72 0x00 0x40 0x00 0x80 0x00 ???
		case 0x28: // battery_can_link_up
			m = x[0];
			entry.event = 'Module 0' + m + ' CAN Link Up';
			return entry;
		case 0x29: // battery_can_link_down
			m = x[0];
			entry.event = 'Module 0' + m + ' CAN Link Down';
			return entry;
		case 0x2a: // sevcon_can_link_up
			entry.event = 'Sevcon CAN Link Up';
			return entry;
		case 0x2b: // sevcon_can_link_down
			entry.event = 'Sevcon CAN Link Down';
			return entry;
		case 0x2c: // run_status
			switch (x[0x12]) {
			case 0:
				m = '00';
				break;
			case 1:
				m = '01';
				break;
			case 2:
				m = '10';
				break;
			case 3:
				m = '11';
				break;
			default:
				m = 'Unknown';
				break;
			}
			f.ptHigh = x[0];
			f.ptLow = x[1];
			f.soc = ('   ' + dec(x.buffer, 'u16', 2)).slice(-3);
			f.pv = ('       ' + dec(x.buffer, 'u32', 4) / 1000).slice(-7);
			f.mt = ('    ' + dec(x.buffer, 'i16', 8)).slice(-4);
			f.ct = ('    ' + dec(x.buffer, 'u16', 0xa)).slice(-4);
			f.rpm = ('    ' + dec(x.buffer, 'u16', 0xc)).slice(-4);
			f.bc = ('    ' + dec(x.buffer, 'i16', 0x10)).slice(-4);
			f.mc = ('    ' + dec(x.buffer, 'i16', 0x13)).slice(-4);
			f.at = ('    ' + dec(x.buffer, 'u16', 0x15)).slice(-4);
			f.odo = ('     ' + dec(x.buffer, 'u32', 0x17)).slice(-5);
			entry.event = 'Riding';
			entry.conditions = 'PackTemp: h ' + f.ptHigh + 'C, l ' + f.ptLow +
				'C, ' + 'PackSOC:' + f.soc + '%, ' + 'Vpack:' + f.pv + 'V, ' +
				'MotAmps:' + f.mc + ', BattAmps:' + f.bc + ', Mods: ' + m +
				', MotTemp:' + f.mt + 'C, CtrlTemp:' + f.ct + 'C, AmbTemp:' +
				f.at + 'C, MotRPM:' + f.rpm + ', Odo:' + f.odo + 'km';
			return entry;
		case 0x2d: // charging_status
			switch (x[0xc]) {
			case 0:
				m = '00';
				break;
			case 1:
				m = '01';
				break;
			case 2:
				m = '10';
				break;
			case 3:
				m = '11';
				break;
			default:
				m = 'Unknown';
				break;
			}
			f.ptHigh = x[0];
			f.ptLow = x[1];
			f.soc = ('   ' + dec(x.buffer, 'u16', 2)).slice(-3);
			f.pv = ('       ' + dec(x.buffer, 'u32', 4) / 1000).slice(-7);
			f.bc = ('    ' + dec(x.buffer, 'i16', 8)).slice(-4);
			f.at = ('    ' + dec(x.buffer, 'u16', 0xd)).slice(-3);
			entry.event = 'Charging';
			entry.conditions = 'PackTemp: h ' + f.ptHigh + 'C, l ' + f.ptLow +
				'C, AmbTemp:' + f.at + 'C, PackSOC:' + f.soc + '%, ' +
				'Vpack:' + f.pv + 'V, ' + 'BattAmps:' + f.bc +
				', Mods: ' + m +
				', MbbChgEn: Yes, BmsChgEn: No';
			return entry;
		case 0x2f: // sevcon_status
			switch (dec(x.buffer, 'u16', 2)) {
			case 0x4681:
				m = 'Preop';
				break;
			case 0x4884:
				m = 'Sequence Fault';
				break;
			case 0x4981:
				m = 'Throttle Fault';
				break;
			default:
				m = 'Unknown';
				break;
			}
			f.code = ('    ' + dec(x.buffer, 'i16', 0).toString(16)).slice(-4);
			f.reg = ('00' + x[4].toString(16)).slice(-2);
			f.sevCode = ('0000' + dec(x.buffer, 'i16', 2).toString(16)).slice(-4);
			f.data = '';
			for (i = 0; i < x.length - 8; i++) {
				f.data += byteToHex(x[5 + i]) + ' ';
			}
			entry.event = 'SEVCON CAN EMCY Frame';
			entry.conditions = 'Error Code: 0x' + f.code +
				', Error Reg: 0x' + f.reg + ' Sevcon Error Code: 0x' + f.sevCode +
				', Data: ' + f.data + ', ' + m;
			return entry;
		case 0x30: // charger_status
			m = ' Disconnected';
			if (x[1]) {
				m = ' Connected';
			}
			f.module = x[0];
			switch (x[0]) {
			case 0:
				f.name = 'Calex 720W';
				break;
			case 1:
				f.name = 'Calex 1200W';
				break;
			case 2:
				f.name = 'External Chg 0';
				break;
			case 3:
				f.name = 'External Chg 1';
				break;
			default:
				f.name = 'Unknown';
				break;
			}
			entry.event = f.name + ' Charger ' + f.module + m;
			return entry;
		//case 0x31: unknown, 1, 6350_MBB_2016-04-12, 0x31 0x00 ???
		case 0x33: // battery_status
			
			f.mod = ('0' + x[1]).slice(-2);
			f.mv = dec(x.buffer, 'u32', 2) / 1000;
			f.max = dec(x.buffer, 'u32', 6) / 1000;
			f.min = dec(x.buffer, 'u32', 0xa) / 1000;
			f.vc = dec(x.buffer, 'u32', 0xe) / 1000;
			f.bc = dec(x.buffer, 'u16', 0x12);
				

			f.diff = (f.max - f.min).toFixed(3);
			f.prechg = 0;
			if (f.mv) {
				f.prechg = f.vc * 100 / f.mv;
			}
			entry.event = 'Module ' + f.mod + m;
			switch (x[0]) {
			case 0:
				m = 'Opening Contactor';
				entry.conditions = 'vmod: ' + f.mv +
					'V, batt curr: ' + f.bc + 'A';
				break;
			case 1:
				m = 'Closing Contactor';
				entry.conditions = 'vmod: ' + f.mv +
					' maxsys: ' + f.max +
					' minsys: ' + f.min +
					' diff: ' + f.diff +
					' vcap: ' + f.vc +
					' prechg: ' + Math.floor(f.prechg) + '%';
				break;
			case 2:
				m = 'Registered';
				f.ser = dec(x.buffer, 'txt', 0x14, 8);
				entry.conditions = 'serial: ' + f.ser +
					',  vmod: ' + f.mv + 'V';
				break;
			default:
				m = 'Unknown';
				break;
			}
			return entry;
		case 0x34: // power_state
			if (x[0] === 0) {
				entry.event = 'Power Off';
			} else {
				entry.event = 'Power On';
			}
			switch (x[1]) {
			case 1:
				m = 'Key Switch';
				break;
			case 3:
				m = 'Ext Charger 1';
				break;
			case 4:
				m = 'Onboard Charger';
				break;
			default:
				m = 'Unknown';
			}
			entry.conditions = m;
			return entry;
		//case 0x35: unknown, 5, 6472_MBB_2016-12-12, 0x35 0x00 0x46 0x01 0xcb 0xff ???
		case 0x36: // sevcon_power_state
			if (x[0] === 0) {
				entry.event = 'Sevcon Turned Off';
			} else {
				entry.event = 'Sevcon Turned On';
			}
			return entry;
		//case 0x37: unknown, 0, 3558_MBB_2016-12-25, 0x37  ???
		case 0x38: // show_bluetooth_state
			entry.event = 'BT RX buffer reset';
			return entry;
		case 0x39: // battery_discharge_current_limited
			f.limit = dec(x.buffer, 'u16', 0);
			f.minCell = dec(x.buffer, 'u16', 2);
			f.temp = x[4];
			f.max = dec(x.buffer, 'u16', 5);
			f.percent = Math.floor(f.limit * 100 / f.max);
			entry.event = 'Batt Dischg Cur Limited';
			entry.conditions = f.limit + ' A (' + f.percent + '%), ' +
				'MinCell: ' + f.minCell + 'mV, MaxPackTemp: ' + f.temp + 'C';
			return entry;
		case 0x3a: // low_chassis_isolation
			f.kohms = dec(x.buffer, 'u32', 0);
			f.cell = x[4];
			entry.event = 'Low Chassis Isolation';
			entry.conditions = f.kohms + ' KOhms to cell ' + f.cell;
			return entry;
		case 0x3b: // precharge_decay_too_steep
			entry.event = 'Precharge Decay Too Steep. Restarting Sevcon.';
			return entry;
		case 0x3c: // disarmed_status
			switch (x[0x12]) {
			case 0:
				m = '00';
				break;
			case 1:
				m = '01';
				break;
			case 2:
				m = '10';
				break;
			case 3:
				m = '11';
				break;
			default:
				m = 'Unknown';
				break;
			}
			f.ptHigh = x[0];
			f.ptLow = x[1];
			f.soc = ('   ' + dec(x.buffer, 'u16', 2)).slice(-3);
			f.pv = ('       ' + dec(x.buffer, 'u32', 4) / 1000).slice(-7);
			f.mt = ('    ' + dec(x.buffer, 'i16', 8)).slice(-4);
			f.ct = ('    ' + dec(x.buffer, 'u16', 0xa)).slice(-4);
			f.rpm = ('    ' + dec(x.buffer, 'u16', 0xc)).slice(-4);
			f.bc = ('    ' + dec(x.buffer, 'i16', 0x10)).slice(-4);
			f.mc = ('    ' + dec(x.buffer, 'i16', 0x13)).slice(-4);
			f.at = ('    ' + dec(x.buffer, 'u16', 0x15)).slice(-4);
			f.odo = ('     ' + dec(x.buffer, 'u32', 0x17)).slice(-5);
			entry.event = 'Disarmed';
			entry.conditions = 'PackTemp: h ' + f.ptHigh + 'C, l ' + f.ptLow +
				'C, ' + 'PackSOC:' + f.soc + '%, ' + 'Vpack:' + f.pv + 'V, ' +
				'MotAmps:' + f.mc + ', BattAmps:' + f.bc + ', Mods: ' + m +
				', MotTemp:' + f.mt + 'C, CtrlTemp:' + f.ct + 'C, AmbTemp:' +
				f.at + 'C, MotRPM:' + f.rpm + ', Odo:' + f.odo + 'km';
			return entry;
		case 0x3d: // battery_contactor_closed
			m = x[0];
			entry.event = 'Battery module ' + m + ' contactor closed';
			return entry;
		case 0xfd: // debug_message
			m = '';
			for (i = 0; i < x.length - 4; i++) {
				m += String.fromCharCode(x[i]);
			}
			entry.event = m;
			return entry;
		default: // unknown type
			entry.unknown = messageType;
			entry.event = byteToHex(messageType) + ' ';
			for (i = 0; i < x.length; i++) {
				entry.event += byteToHex(x[i]) + ' ';
			}
			entry.event += '???';
			return entry;
		}
	}

	function parseLog(bin) {
		var logType = dec(bin, 'txt', 0, 3),
			ba = new Uint8Array(bin),
			count = countIt(bin, 0xa2),
			hdr = ba.indexOf(0xa2),
			dv = new DataView(bin),
			u32 = dec(bin, 'u32', hdr),
			entriesStart = ba.indexOf(0xb2),
			entriesEnd = ba.byteLength,
			claimedEntriesCount = 0,
			entriesDataBegin = 0,
			entriesCount = 0,
			eventLog = [],
			eventLogFirst = [],
			eventLogSecond = [],
			readPos = 0,
			unhandled = 0,
			unknownEntries = 0,
			unknown = [],
			notParsed = '',
			entryNum = 1,
			entry = {},
			element;
		
		if (bin.byteLength > 0x100000 || bin.byteLength < 0x20000) {
			parsedText = 'File size out of range.';
			return parsedText;
		}
		
		parsedText = '';

		if ((logType !== 'MBB') && (logType !== 'BMS')) {
			logType = 'Unknown Type';
		}
		parsedText = 'Zero ' + logType + ' log\n\n';
		if (logType === 'MBB') {
			parsedText += 'Serial number      ' + dec(bin, 'txt', 0x200, 21) + '\n' +
				'VIN                ' + dec(bin, 'txt', 0x240, 17) + '\n' +
				'Firmware rev.      ' + dec(bin, 'u16', 0x27b, 1) + '\n' +
				'Board rev.         ' + dec(bin, 'u16', 0x27d, 1) + '\n' +
				'Model              ' + dec(bin, 'txt', 0x27f, 3) + '\n\n';
		}
		if (logType === 'BMS') {
			parsedText += 'Initial date       ' + dec(bin, 'txt', 0x12, 20) + '\n' +
				'BMS serial number  ' + dec(bin, 'txt', 0x300, 21) + '\n' +
				'Pack serial number ' + dec(bin, 'txt', 0x320, 8) + '\n\n';
		}
		if (logType === 'Unknown Type') {
			parsedText += 'System info unknown' + '\n';
		}

		do {
			if (u32 === 0xa2a2a2a2) {
				entriesEnd = dec(bin, 'u32', hdr + 4);
				entriesStart = dec(bin, 'u32', hdr + 8);
				claimedEntriesCount = dec(bin, 'u32', hdr + 12);
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
		parsedText += 'Printing ' + entriesCount  + ' of ' + entriesCount + ' log entries..\n\n';
		parsedText += ' Entry    Time of Log (local)      Event                      Conditions\n';
		parsedText += '+--------+----------------------+--------------------------+----------------------------------\n';

		for (entryNum; entryNum <= entriesCount; entryNum++) {
			entry = parseEntry(eventLog, readPos);
			if (entry.conditions) {
				parsedText += ' ' + ('0000' + entryNum).slice(-5) +
					entry.time + '   ' +
					(entry.event + '                         ').slice(0, 25) +
					'  ' + entry.conditions + '\n';
			} else {
				parsedText += ' ' + ('0000' + entryNum).slice(-5) + entry.time + '   ' + entry.event + '    ' + entry.conditions + '\n';
			}
			if (entry.unknown) {
				unknownEntries += 1;
				if (!unknown.includes(' ' + byteToHex(entry.unknown))) {
					unknown.push(' ' + byteToHex(entry.unknown));
				}
			}
			readPos += entry.length;
			
		}
		if (unknownEntries) {
			notParsed = unknownEntries + ' unknown entries of types' + unknown;
		}
		document.getElementById('print').innerHTML =
			' ' + entriesCount + ' entries found, ' + claimedEntriesCount +
			' claimed. ' + notParsed;
		
		return parsedText;
	}
	
	function readFile() {
		var files = document.getElementById('choose').files,
			reader = new FileReader();

		document.getElementById('print').innerHTML = '';
		document.getElementById('parsed').innerHTML = '';
		document.getElementById('fname').innerHTML = '';
		document.getElementById('print').innerHTML = 'Parsing...';
		if (!files.length) {
			document.getElementById('print').innerHTML = 'Could not parse';
			return;
		}
		if (files[0].name.slice(-4) !== '.bin') {
			document.getElementById('print').innerHTML = 'Could not parse';
			return;
		}
		reader.onloadend = function (evt) {
			if (evt.target.readyState === FileReader.DONE) {
				logFileName = files[0].name.replace('.bin', '.txt');
				document.getElementById('fname').innerHTML = files[0].name;
				document.getElementById('print').innerHTML = 'Could not parse';
				document.getElementById('parsed').innerHTML =
					parseLog(evt.target.result);
			} else {
				document.getElementById('parsed').innerHTML = ' File error';
			}
		};
		reader.readAsArrayBuffer(files[0]);
	}
	
	function saveLog() {
		var blob = new Blob([parsedText], {type: "text/plain;charset=utf-8"});
		
		if (parsedText === undefined) {
			return;
		}
		saveAs(blob, logFileName);
	}

	document.getElementById('choose').addEventListener('change', readFile);
	document.getElementById('down').addEventListener('click', saveLog);
}());