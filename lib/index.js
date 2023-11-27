

import zlib from 'zlib';
import http from 'http';
import https from 'https';
import { parse, format } from 'url';
import debug from 'debug';

const debugBody = debug('httpx:body');
const debugHeader = debug('httpx:header');

const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });

const TIMEOUT = 3000; // 3s

const READ_TIMER = Symbol('TIMER::READ_TIMER');
const READ_TIME_OUT = Symbol('TIMER::READ_TIME_OUT');
const READ_TIMER_START_AT = Symbol('TIMER::READ_TIMER_START_AT');

/**
 * Check the content-encoding header, and auto decompress it.
 * @param {Readable} response http response
 * @returns Readable
 */
function decompress(response) {
  switch (response.headers['content-encoding']) {
  // or, just use zlib.createUnzip() to handle both cases
  case 'gzip':
    return response.pipe(zlib.createGunzip());
  case 'deflate':
    return response.pipe(zlib.createInflate());
  default:
    return response;
  }
}

var append = function (err, name, message) {
  err.name = name + err.name;
  err.message = `${message}. ${err.message}`;
  return err;
};

const isNumber = function (num) {
  return num !== null && !isNaN(num);
};

export function request(url, opts) {
  opts || (opts = {});

  const parsed = typeof url === 'string' ? parse(url) : url;

  let readTimeout, connectTimeout;
  if (isNumber(opts.readTimeout) || isNumber(opts.connectTimeout)) {
    readTimeout = isNumber(opts.readTimeout) ? Number(opts.readTimeout) : TIMEOUT;
    connectTimeout = isNumber(opts.connectTimeout) ? Number(opts.connectTimeout) : TIMEOUT;
  } else if (isNumber(opts.timeout)) {
    readTimeout = connectTimeout = Number(opts.timeout);
  } else {
    readTimeout = connectTimeout = TIMEOUT;
  }

  const isHttps = parsed.protocol === 'https:';
  const method = (opts.method || 'GET').toUpperCase();
  const defaultAgent = isHttps ? httpsAgent : httpAgent;
  const agent = opts.agent || defaultAgent;

  var options = {
    host: parsed.hostname || 'localhost',
    path: parsed.path || '/',
    method: method,
    port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
    agent: agent,
    headers: opts.headers || {},
    // ssl config
    key: opts.key || '',
    cert: opts.cert || '',
    ca: opts.ca || '',
    // connect timerout
    timeout: connectTimeout
  };

  if (isHttps && typeof opts.rejectUnauthorized !== 'undefined') {
    options.rejectUnauthorized = opts.rejectUnauthorized;
  }

  if (opts.compression) {
    options.headers['accept-encoding'] = 'gzip,deflate';
  }

  const httplib = isHttps ? https : http;

  if (typeof opts.beforeRequest === 'function') {
    options = opts.beforeRequest(options);
  }

  return new Promise((resolve, reject) => {
    const request = httplib.request(options);
    const body = opts.data;

    var fulfilled = (response) => {
      if (debugHeader.enabled) {
        const requestHeaders = response.req._header;
        requestHeaders.split('\r\n').forEach((line) => {
          debugHeader('> %s', line);
        });

        debugHeader('< HTTP/%s %s %s', response.httpVersion, response.statusCode, response.statusMessage);
        Object.keys(response.headers).forEach((key) => {
          debugHeader('< %s: %s', key, response.headers[key]);
        });
      }
      resolve(response);
    };

    var rejected = (err) => {
      err.message += `${method} ${format(parsed)} failed.`;
      // clear response timer when error
      if (request.socket && request.socket[READ_TIMER]) {
        clearTimeout(request.socket[READ_TIMER]);
      }
      reject(err);
    };

    var abort = (err) => {
      request.abort();
      rejected(err);
    };

    const startResponseTimer = function (socket) {
      const timer = setTimeout(() => {
        if (socket[READ_TIMER]) {
          clearTimeout(socket[READ_TIMER]);
          socket[READ_TIMER] = null;
        }
        var err = new Error();
        var message = `ReadTimeout(${readTimeout})`;
        abort(append(err, 'RequestTimeout', message));
      }, readTimeout);
      // start read-timer
      socket[READ_TIME_OUT] = readTimeout;
      socket[READ_TIMER] = timer;
      socket[READ_TIMER_START_AT] = Date.now();
      // don't block the loop
      timer.unref();
    };

    // string
    if (!body || 'string' === typeof body || body instanceof Buffer) {
      if (debugBody.enabled) {
        if (!body) {
          debugBody('<no request body>');
        } else if ('string' === typeof body) {
          debugBody(body);
        } else {
          debugBody(`Buffer <ignored>, Buffer length: ${body.length}`);
        }
      }
      request.end(body);
    } else if ('function' === typeof body.pipe) { // stream
      body.pipe(request);
      if (debugBody.enabled) {
        debugBody('<request body is a stream>');
      }
      body.once('error', (err) => {
        abort(append(err, 'HttpX', 'Stream occor error'));
      });
    }

    request.on('response', fulfilled);
    request.on('error', rejected);
    request.once('socket', function (socket) {
      // reuse socket
      if (socket.readyState === 'opening') {
        socket.once('connect', function () {
          startResponseTimer(socket);
        });
      } else {
        startResponseTimer(socket);
      }
    });
  });
}

export function read(response, encoding) {
  const readable = decompress(response);

  return new Promise((resolve, reject) => {
    // node.js 14 use response.client
    const socket = response.socket || response.client;

    const makeReadTimeoutError = () => {
      const req = response.req;
      var err = new Error();
      err.name = 'RequestTimeoutError';
      err.message = `ReadTimeout: ${socket[READ_TIME_OUT]}. ${req.method} ${req.path} failed.`;
      return err;
    };
    // check read-timer
    let readTimer;
    const oldReadTimer = socket[READ_TIMER];
    if (!oldReadTimer) {
      reject(makeReadTimeoutError());
      return;
    }
    const remainTime = socket[READ_TIME_OUT] - (Date.now() - socket[READ_TIMER_START_AT]);
    clearTimeout(oldReadTimer);
    if (remainTime <= 0) {
      reject(makeReadTimeoutError());
      return;
    }
    readTimer = setTimeout(function () {
      reject(makeReadTimeoutError());
    }, remainTime);

    // start reading data
    var onError, onData, onEnd;
    var cleanup = function () {
      // cleanup
      readable.removeListener('error', onError);
      readable.removeListener('data', onData);
      readable.removeListener('end', onEnd);
      // clear read timer
      if (readTimer) {
        clearTimeout(readTimer);
      }
    };

    const bufs = [];
    var size = 0;

    onData = function (buf) {
      bufs.push(buf);
      size += buf.length;
    };

    onError = function (err) {
      cleanup();
      reject(err);
    };

    onEnd = function () {
      cleanup();
      var buff = Buffer.concat(bufs, size);

      debugBody('');
      if (encoding) {
        const result = buff.toString(encoding);
        debugBody(result);
        return resolve(result);
      }

      if (debugBody.enabled) {
        debugBody(buff.toString());
      }
      resolve(buff);
    };

    readable.on('error', onError);
    readable.on('data', onData);
    readable.on('end', onEnd);
  });
}

function readyToRead(readable) {
  return new Promise((resolve, reject) => {
    var onReadable, onEnd, onError;
    var cleanup = function () {
      // cleanup
      readable.removeListener('error', onError);
      readable.removeListener('end', onEnd);
      readable.removeListener('readable', onReadable);
    };

    onReadable = function () {
      cleanup();
      resolve(false);
    };

    onEnd = function () {
      cleanup();
      resolve(true);
    };

    onError = function (err) {
      cleanup();
      reject(err);
    };

    readable.once('readable', onReadable);
    readable.once('end', onEnd);
    readable.once('error', onError);
  });
}

export class Event {
  constructor(id, event, data, retry) {
    this.id = id;
    this.event = event;
    this.data = data;
    this.retry = retry;
  }
}

const DATA_PREFIX = 'data:';
const EVENT_PREFIX = 'event:';
const ID_PREFIX = 'id:';
const RETRY_PREFIX = 'retry:';

function isDigitsOnly(str) {
  for (let i = 0; i < str.length; i++) {
    const c = str.charAt(i);
    if (c < '0' || c > '9') {
      return false;
    }
  }
  return str.length > 0;
}

function tryGetEvents(head, chunk) {
  const all = head + chunk;
  let start = 0;
  const events = [];
  for (let i = 0; i < all.length - 1; i++) {
    const c = all[i];
    const c2 = all[i + 1];
    if (c === '\n' && c2 === '\n') {
      const part = all.substring(start, i);
      const lines = part.split('\n');
      const event = new Event();
      lines.forEach((line) => {
        if (line.startsWith(DATA_PREFIX)) {
          event.data = line.substring(DATA_PREFIX.length).trim();
        } else if (line.startsWith(EVENT_PREFIX)) {
          event.event = line.substring(EVENT_PREFIX.length).trim();
        } else if (line.startsWith(ID_PREFIX)) {
          event.id = line.substring(ID_PREFIX.length).trim();
        } else if (line.startsWith(RETRY_PREFIX)) {
          const retry = line.substring(RETRY_PREFIX.length).trim();
          if (isDigitsOnly(retry)) {
            event.retry = parseInt(retry, 10);
          }
        } else if (line.startsWith(':')) {
          // ignore the line
        }
      });
      events.push(event);
      start = i + 2;
    }
  }

  const rest = all.substring(start);
  return [events, rest];
}

/**
 * consume response and parse to event stream
 * @param {ReadableStream} response 
 * @returns AsyncGenerator<Event, void, unknown>
 */
export async function* readAsSSE(response) {
  const readable = decompress(response);

  const socket = response.socket || response.client;
  clearTimeout(socket[READ_TIMER]);

  let rest = '';

  while (true) {
    const ended = await readyToRead(readable);
    if (ended) {
      return;
    }

    let chunk;
    while (null !== (chunk = readable.read())) {
      const [ events, remain ] = tryGetEvents(rest, chunk.toString());
      rest = remain;
      if (events && events.length > 0) {
        for (const event of events) {
          yield event;
        }
      }
    }
  }
}