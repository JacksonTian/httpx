'use strict';

import zlib from 'zlib';
import http from 'http';
import https from 'https';

import { IncomingMessage, Agent, OutgoingHttpHeaders, RequestOptions } from "http";
import { Readable } from "stream";
import { parse, format } from 'url';
import debug from 'debug';

const debugBody = debug('httpx:body');
const debugHeader = debug('httpx:header');

const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });

const TIMEOUT = 3000; // 3s

const READ_TIMER = Symbol('TIMER::READ_TIMER');
const READ_TIME_OUT = Symbol('TIMER::READ_TIME_OUT');

function append(err: Error, name: string, message: string): Error {
  err.name = name + err.name;
  err.message = `${message}. ${err.message}`;
  return err;
}

function isNumber(num: number): boolean {
  return num !== null && !isNaN(num);
}

export interface Options {
  'method'?: string;
  'readTimeout'?: number;
  'connectTimeout'?: number;
  'timeout'?: number;
  'agent'?: Agent;
  'headers'?: OutgoingHttpHeaders;
  'rejectUnauthorized'?: boolean;
  'compression'?: boolean;
  'beforeRequest'?(options: Options): void;
  'data'?: string|Buffer|Readable|undefined;
}

exports.request = function (url: string, opts: Options): Promise<IncomingMessage> {
  // request(url)
  opts || (opts = {});

  const parsed = typeof url === 'string' ? parse(url) : url;

  let readTimeout: number, connectTimeout: number;
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

  var options: RequestOptions = {
    host: parsed.hostname || 'localhost',
    path: parsed.path || '/',
    method: method,
    port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
    agent: agent,
    headers: opts.headers || {},
    // connect timerout
    timeout: connectTimeout
  };

  if (isHttps && typeof opts.rejectUnauthorized !== 'undefined') {
    (<https.RequestOptions>options).rejectUnauthorized = opts.rejectUnauthorized;
  }

  if (opts.compression) {
    options.headers['accept-encoding'] = 'gzip,deflate';
  }

  const httplib = isHttps ? https : http;

  if (typeof opts.beforeRequest === 'function') {
    opts.beforeRequest(options);
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
      if (request.socket[READ_TIMER]) {
        clearTimeout(request.socket[READ_TIMER]);
      }
      reject(err);
    };

    var abort = (err: Error) => {
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
      timer.startTime = Date.now();
      // start read-timer
      socket[READ_TIME_OUT] = readTimeout;
      socket[READ_TIMER] = timer;
    };

    // string
    if (!body || 'string' === typeof body || body instanceof Buffer) {
      if (debugBody.enabled) {
        if (!body) {
          debugBody('<no request body>');
        } else if ('string' === typeof body) {
          debugBody(body);
        } else {
          debugBody(`Buffer <ignored>, Buffer length: ${(<Buffer>body).length}`);
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
};

exports.read = function (response: IncomingMessage, encoding: null | string) : Promise<string|Buffer> {
  var readable: Readable = response;
  switch (response.headers['content-encoding']) {
  // or, just use zlib.createUnzip() to handle both cases
  case 'gzip':
    readable = response.pipe(zlib.createGunzip());
    break;
  case 'deflate':
    readable = response.pipe(zlib.createInflate());
    break;
  default:
    break;
  }

  return new Promise((resolve, reject) => {
    const makeReadTimeoutError = () => {
      const req = response.req;
      var err = new Error();
      err.name = 'RequestTimeoutError';
      err.message = `ReadTimeout: ${response.socket[READ_TIME_OUT]}. ${req.method} ${req.path} failed.`;
      return err;
    };
    // check read-timer
    let readTimer: NodeJS.Timeout;
    const oldReadTimer = response.socket[READ_TIMER];
    if (!oldReadTimer) {
      reject(makeReadTimeoutError());
      return;
    }
    const remainTime = response.socket[READ_TIME_OUT] - (Date.now() - oldReadTimer.startTime);
    clearTimeout(oldReadTimer);
    if (remainTime <= 0) {
      reject(makeReadTimeoutError());
      return;
    }

    readTimer = setTimeout(function () {
      reject(makeReadTimeoutError());
    }, remainTime);

    // start reading data
    var onError: (err: Error) => void, onData: (buf: Buffer) => void, onEnd: () => void;
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

    const bufs: Buffer[] = [];
    var size = 0;

    onData = function (buf: Buffer) {
      bufs.push(buf);
      size += buf.length;
    };

    onError = function (err: Error): void {
      cleanup();
      reject(err);
    };

    onEnd = function (): void {
      cleanup();
      var buff = Buffer.concat(bufs, size);

      debugBody('');
      if (encoding) {
        const result = buff.toString(encoding);
        debugBody(result);
        resolve(result);
        return;
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
};
