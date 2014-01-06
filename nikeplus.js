var request = require('request');
var jsontoxml = require('jsontoxml');
var moment = require('moment');
var FormData = require('form-data');
var libxmljs = require('libxmljs');


var LOGIN_URL = 'https://api.nike.com/nsl/v2.0/user/login?client_id=9dfa1aef96a54441dfaac68c4410e063&client_secret=3cbd1f1908bc1553&app=app&format=json';

function addRun(email, password, date, duration /* in seconds */, distance /* in km */, successCallback, errorCallback) {
	request({
		url: LOGIN_URL,
		method: 'POST',
		headers: {
			'Accept': 'application/json'
		},
		form: {
			password: password,
			email: email,
		},

	}, function(err, res, body) {

		if (err || res.statusCode !== 200) {
			errorCallback({
				reason: 'connection_error'
			});
			return;
		}

		var json = JSON.parse(body);
		if (!json) {
			errorCallback({
				reason: 'unknown'
			});
			return;
		}

		if (json.serviceResponse &&
			json.serviceResponse.header &&
			json.serviceResponse.header.success === 'false') { // Yes, 'false'. Look of disapproval.
			errorCallback({
				reason: 'login_failed'
			});
			return;
		}

		var pin = json.pin;
		if (!pin) {
			errorCallback({
				reason: 'no_pin'
			});
		}

		uploadRun(pin, date, duration, distance, successCallback, errorCallback);
	});
}


var UPLOAD_URL = 'https://secure-nikerunning.nike.com/gps/sync/plus/iphone';

function patchFormData(form, path) {
	form._multiPartHeader = function(field, value) {
		return FormData.prototype._multiPartHeader(field, { path: path });
	};
};

function uploadRun(pin, date, duration /* in seconds */, distance /* in km */, successCallback, errorCallback) {
	// Turns out Nike will overwrite an existing run if the dates match.
	date.setMinutes(Math.floor(Math.random() * 60));
	date.setSeconds(Math.floor(Math.random() * 60));

	var datetime = moment(date).format('YYYY-MM-DDTHH:mm:ss') + ' GMT00:00';

	var runXml = jsontoxml({
		sportsData: {
			runSummary: [
				{
					name: 'time',
					text: datetime,
				}, {
					name: 'duration',
					text: duration * 1000, // this is in milliseconds
				}, {
					name: 'distance',
					attrs: { unit: 'km' },
					text: distance.toFixed(2),
				}
			],
			userInfo: [
				{
					name: 'localSoftware',
					attrs: { version: '3.4' },
					text: 'Nike+ iPhone',
				}, {
					name: 'device',
					text: 'iPhone4,1',
				}, {
					name: 'empedID',
					text: '0cb942b4451d0df9516b9464cb1bf0cc0176e6f1', // magic
				}
			],
			startTime: datetime,
		}
	}, {
		xmlHeader: true
	});

	var form = new FormData();
	// Make form-data think we are a file. This should really be exposed as an API.
	patchFormData(form, 'runXML.xml');
	form.append('runXML', runXml);

	var uploadReq = request({
		method: 'POST',
		url: UPLOAD_URL,
		headers: form.getHeaders({
			pin: pin,
			'Content-length': form.getLengthSync(),
		}),
	}, function(err, res, body) {
		if (err || res.statusCode !== 200) {
			errorCallback({
				reason: 'upload_failure'
			});
			return;
		}

		var xml = libxmljs.parseXml(body);
		var status = xml.get('/response/status');
		if (!status || status.text() !== 'success') {
			errorCallback({
				reason: 'upload_parse'
			});
			return;
		}

		sync(pin, successCallback, errorCallback);
	});

	form.pipe(uploadReq);
}

var SYNC_URL = 'https://secure-nikerunning.nike.com/nikeplus/v1/services/device/sync_complete.jsp';

function sync(pin, successCallback, errorCallback) {
	request({
		url: SYNC_URL,
		method: 'POST',
		form: {
			pin: pin,
		},
	}, function(err, res, body) {
		if (err || res.statusCode !== 200) {
			errorCallback({
				reason: 'sync_failure'
			});
			return;
		}

		var xml = libxmljs.parseXml(body);
		var status = xml.get('/plusService/status');
		if (!status || status.text() !== 'success') {
			errorCallback({
				reason: 'sync_parse'
			});
			return;
		}

		successCallback();
	});
}

exports.addRun = addRun;
