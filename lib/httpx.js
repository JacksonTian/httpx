'use strict';

var http = require('http');
var https = require('https');
var urlutil = require('url');

var thunkify = require('thunkify');

// change Agent.maxSockets to 1000
exports.agent = new http.Agent();
exports.agent.maxSockets = 1000;

exports.httpsAgent = new https.Agent();
exports.httpsAgent.maxSockets = 1000;

exports.request = thunkify(function (url, opts, callback) {
  // request(url, callback)
  if (arguments.length === 2 && typeof opts === 'function') {
    callback = opts;
    opts = {};
  }

  var parsedUrl = typeof url === 'string' ? urlutil.parse(url) : url;

  opts.timeout = opts.timeout || exports.TIMEOUT;
  var method = (opts.method || 'GET').toUpperCase();
  var port = parsedUrl.port || 80;
  var httplib = http;
  var agent = opts.agent || exports.agent;

  if (parsedUrl.protocol === 'https:') {
    httplib = https;
    agent = opts.httpsAgent || exports.httpsAgent;
    if (opts.httpsAgent === false) {
      agent = false;
    }
    if (!parsedUrl.port) {
      port = 443;
    }
  }

  if (opts.agent === false) {
    agent = false;
  }

  var options = {
    host: parsedUrl.hostname || parsedUrl.host || 'localhost',
    path: parsedUrl.path || '/',
    method: method,
    port: port,
    agent: agent,
    headers: opts.headers || {}
  };

  var req = httplib.request(options, function(res) {
    callback(null, res);
  });

  req.on('error', function (err) {
    callback(err);
  });

  var body = opts.data;

  // string
  if (!body || 'string' === typeof body || Buffer.isBuffer(body)) {
    req.end(body);
  } else if ('function' === typeof body.pipe) { // stream
    body.pipe(req);
  }
});
