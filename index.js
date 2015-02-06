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
  var isHttps = parsedUrl.protocol === 'https:';
  var method = (opts.method || 'GET').toUpperCase();
  var defaultAgent = isHttps ? exports.httpsAgent : exports.agent;
  var agent = opts.hasOwnProperty('agent') ? opts.agent : defaultAgent;

  var options = {
    host: parsedUrl.hostname || 'localhost',
    path: parsedUrl.path || '/',
    method: method,
    port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
    agent: agent,
    headers: opts.headers || {}
  };

  var httplib = isHttps ? https : http;
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
