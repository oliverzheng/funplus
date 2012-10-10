var path = require('path');
var express = require('express');
var validate = require('jsonschema').validate;
var nikeplus = require('./nikeplus');


var app = express();

app.configure(function() {
	app.use(express.bodyParser());
	app.use(express.static(path.join(__dirname, 'public')));
});

var schema = {
	type: 'object',
	properties: {
		email: {
			type: 'string',
			required: true,
		},
		password: {
			type: 'string',
			required: true,
		},
		date: {
			type: 'object',
			required: true,
			properties: {
				year: {
					type: 'integer',
					required: true,
					maximum: 9999
				},
				month: {
					type: 'integer',
					required: true,
					minimum: 1,
					maximum: 12,
				},
				day: {
					type: 'integer',
					required: true,
					minimum: 1,
					maximum: 31,
				},
				hour: {
					type: 'integer',
					required: true,
					minimum: 0,
					maximum: 23,
				},
				minute: {
					type: 'integer',
					required: true,
					minimum: 0,
					maximum: 59,
				}
			}
		},
		duration: {
			type: 'integer',
			required: true,
			minimum: 0,
		},
		distance: {
			type: 'number',
			required: true,
			minimum: 0,
		},
	},
};

app.post('/', function(req, res) {
	// This is so disgusting. Just give me the damn raw data already.
	var data = JSON.parse(Object.keys(req.body)[0]);
	var validation = validate(data, schema);
	if (validation.length !== 0) {
		res.json({ success: false, reason: 'invalid_message' });
		return;
	}

	var email = data.email;
	var password = data.password;
	var date = new Date(data.date.year, data.date.month, data.date.day, data.date.hour, data.date.minute);
	var duration = data.duration;
	var distance = data.distance;

	nikeplus.addRun(email, password, date, duration, distance, function() {
		res.json({ success: true });
	}, function(err) {
		res.json({ success: false, reason: err.reason });
	});
});

var port = process.env.PORT || 8000;
app.listen(port, function() {
	console.log('Listening on port ' + port);
});
