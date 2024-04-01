import http from 'http';
import zlib from 'zlib';
import assert from 'assert';
import fs from 'fs';
import path from 'path';

import socks from 'socksv5';
import { SocksProxyAgent } from 'socks-proxy-agent';

import * as httpx from '../lib/index.js';
import { fileURLToPath } from 'url';

const server = http.createServer((req, res) => {
  if (req.url === '/readTimeout') {
    setTimeout(() => {
      res.writeHead(200, {'Content-Type': 'text/plain'});
      res.end('Hello world!');
    }, 200);
  } else if (req.url === '/readTimeout2') {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('Hello world!');
  } else if (req.url === '/timeout') {
    setTimeout(() => {
      res.writeHead(200, {'Content-Type': 'text/plain'});
      res.end('Hello world!');
    }, 200);
  } else if (req.url === '/stream') {
    res.writeHead(200);
    const buffers = [];
    req.on('data', (chunk) => {
      buffers.push(chunk);
    });
    req.on('end', () => {
      res.end(Buffer.concat(buffers).toString());
    });
  } else if (req.url === '/compression') {
    res.writeHead(200, {
      'content-encoding': 'gzip'
    });
    zlib.gzip('Hello world with gzip!', function (err, buff) {
      res.end(buff);
    });
  } else if (req.url === '/compression_with_deflate') {
    res.writeHead(200, {
      'content-encoding': 'deflate'
    });
    zlib.deflate('Hello world with deflate!', function (err, buff) {
      res.end(buff);
    });
  } else if (req.url === '/sse') {
    const headers = {
      'Content-Type': 'text/event-stream',
      'Connection': 'keep-alive',
      'Cache-Control': 'no-cache'
    };
    res.writeHead(200, headers);
    res.flushHeaders();
    let count = 0;
    let timer = setInterval(() => {
      if (count >= 5) {
        clearInterval(timer);
        res.end();
        return;
      }
      res.write(`data: ${JSON.stringify({count: count})}\nevent: flow\nid: sse-test\nretry: 3\n:heartbeat\n\n`);
      count++;
    }, 100);
  } else if (req.url === '/sse_with_no_spaces') {
    const headers = {
      'Content-Type': 'text/event-stream',
      'Connection': 'keep-alive',
      'Cache-Control': 'no-cache'
    };
    res.writeHead(200, headers);
    res.flushHeaders();
    let count = 0;
    let timer = setInterval(() => {
      if (count >= 5) {
        clearInterval(timer);
        res.end();
        return;
      }
      res.write(`data:${JSON.stringify({count: count})}\nevent:flow\nid:sse-test\nretry:3\n\n`);
      count++;
    }, 100);
  } else if (req.url === '/sse_invalid_retry') {
    const headers = {
      'Content-Type': 'text/event-stream',
      'Connection': 'keep-alive',
      'Cache-Control': 'no-cache'
    };
    res.writeHead(200, headers);
    res.flushHeaders();
    let count = 0;
    let timer = setInterval(() => {
      if (count >= 5) {
        clearInterval(timer);
        res.end();
        return;
      }
      res.write(`data:${JSON.stringify({count: count})}\nevent:flow\nid:sse-test\nretry: abc\n\n`);
      count++;
    }, 100);
  } else if (req.url === '/sse_with_data_divided') {
    const headers = {
      'Content-Type': 'text/event-stream',
      'Connection': 'keep-alive',
      'Cache-Control': 'no-cache'
    };
    res.writeHead(200, headers);
    res.flushHeaders();
    let count = 0;
    let timer = setInterval(() => {
      if (count >= 5) {
        clearInterval(timer);
        res.end();
        return;
      }
      if (count === 1) {
        res.write('data:{"count":');
        count++;
        return;
      }
      if (count === 2) {
        res.write(`${count++},"tag":"divided"}\nevent:flow\nid:sse-test\nretry:3\n\n`);
        return;
      }
      res.write(`data:${JSON.stringify({count: count++})}\nevent:flow\nid:sse-test\nretry:3\n\n`);
    }, 100);
  } else {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('Hello world!');
  }
});

const srv = socks.createServer((info, accept, deny) => {
  accept();
});

srv.listen(3001, 'localhost', function() {
  console.log('SOCKS server listening on port 3001');
});

srv.useAuth(socks.auth.None());

function make (server) {
  const port = server.address().port;
  var prefix = 'http://127.0.0.1:' + port;

  return function (path, opts) {
    return httpx.request(prefix + path, opts);
  };
}

function newEvent(d) {
  return new httpx.Event(d.id, d.event, d.data, d.retry);
}

describe('httpx', () => {
  before((done) => {
    server.listen(0, done);
  });

  after(function (done) {
    this.timeout(20000);
    srv.close();
    server.close(done);
  });

  it('should ok', async function () {
    var res = await make(server)('/');
    assert.strictEqual(res.statusCode, 200);
    var result = await httpx.read(res, 'utf8');
    assert.strictEqual(result, 'Hello world!');
  });

  it('should ok with buffer', async function () {
    var res = await make(server)('/');
    assert.strictEqual(res.statusCode, 200);
    var result = await httpx.read(res);
    assert.deepStrictEqual(result, Buffer.from('Hello world!'));
  });

  it('should ok with stream', async function () {
    var res = await make(server)('/stream', {
      method: 'POST',
      data: fs.createReadStream(path.join(path.dirname(fileURLToPath(import.meta.url)), './fixtures/test.txt'))
    });
    assert.strictEqual(res.statusCode, 200);
    var result = await httpx.read(res);
    assert.deepStrictEqual(result, Buffer.from('Hello world!'));
  });

  it('compression should ok', async function () {
    var res = await make(server)('/compression');
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.headers['content-encoding'], 'gzip');
    var result = await httpx.read(res, 'utf8');
    assert.strictEqual(result, 'Hello world with gzip!');
  });

  it('compression with deflate should ok', async function () {
    var res = await make(server)('/compression_with_deflate');
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.headers['content-encoding'], 'deflate');
    var result = await httpx.read(res, 'utf8');
    assert.strictEqual(result, 'Hello world with deflate!');
  });

  it('timeout should ok', async function () {
    try {
      await make(server)('/timeout', {timeout: 100});
    } catch (ex) {
      assert.strictEqual(ex.name, 'RequestTimeoutError');
      const port = server.address().port;
      assert.strictEqual(ex.message, `ReadTimeout(100). GET http://127.0.0.1:${port}/timeout failed.`);
      return;
    }
    assert.ok(false, 'should not ok');
  });

  it('timeout(readTimeout) should ok', async function () {
    try {
      await make(server)('/readTimeout', {readTimeout: 100, connectTimeout: 50});
    } catch (ex) {
      assert.strictEqual(ex.name, 'RequestTimeoutError');
      const port = server.address().port;
      assert.strictEqual(ex.message, `ReadTimeout(100). GET http://127.0.0.1:${port}/readTimeout failed.`);
      return;
    }
    assert.ok(false, 'should not ok');
  });

  it('timeout(readTimeout & timeout) should ok', async function () {
    try {
      await make(server)('/readTimeout', {readTimeout: 100, connectTimeout: 50, timeout: 300});
    } catch (ex) {
      assert.strictEqual(ex.name, 'RequestTimeoutError');
      const port = server.address().port;
      assert.strictEqual(ex.message, `ReadTimeout(100). GET http://127.0.0.1:${port}/readTimeout failed.`);
      return;
    }
    assert.ok(false, 'should not ok');
  });

  it('read timeout should ok', async function () {
    const res = await make(server)('/readTimeout2', {readTimeout: 100, connectTimeout: 50, timeout: 300});
    const err = await new Promise((resolve) => {
      setTimeout(async function () {
        try {
          await httpx.read(res);
          resolve(null);
        } catch (err) {
          resolve(err);
        }
      }, 200);
    });
    assert.ok(err, 'should throw error');
    assert.strictEqual(err.message, 'ReadTimeout: 100. GET /readTimeout2 failed.');
  });

  it('should throw an error', async function () {
    try {
      // socks://127.0.0.1:3000 is an invalid socks proxy address.
      await make(server)('/', { agent: new SocksProxyAgent('socks://127.0.0.1:3000') });
      assert.fail('should not run here');
    } catch (error) {
      const port = server.address().port;
      assert.strictEqual(error.message, `connect ECONNREFUSED 127.0.0.1:3000GET http://127.0.0.1:${port}/ failed.`);
    }
  });

  it('request with proxy agent should ok', async function () {
    var res = await make(server)('/', { agent: new SocksProxyAgent('socks://localhost:3001') });
    assert.strictEqual(res.statusCode, 200);
    var result = await httpx.read(res, 'utf8');
    assert.strictEqual(result, 'Hello world!');
  });

  it('readAsSSE should ok', async function () {
    this.timeout(15000);
    var res = await make(server)('/sse', {readTimeout: 5000});
    assert.strictEqual(res.statusCode, 200);
    const events = [];
    for await (const event of httpx.readAsSSE(res)) {
      events.push(event);
    }

    assert.strictEqual(events.length, 5);

    assert.deepStrictEqual([newEvent({
      data: '{"count":0}',
      event: 'flow',
      id: 'sse-test',
      retry: 3,
    }), newEvent({
      data: '{"count":1}',
      event: 'flow',
      id: 'sse-test',
      retry: 3,
    }), newEvent({
      data: '{"count":2}',
      event: 'flow',
      id: 'sse-test',
      retry: 3,
    }), newEvent({
      data: '{"count":3}',
      event: 'flow',
      id: 'sse-test',
      retry: 3,
    }), newEvent({
      data: '{"count":4}',
      event: 'flow',
      id: 'sse-test',
      retry: 3,
    })], events);
  });

  it('readAsSSE with no spaces should ok', async function () {
    this.timeout(15000);
    var res = await make(server)('/sse_with_no_spaces', {readTimeout: 5000});
    assert.strictEqual(res.statusCode, 200);
    const events = [];
    for await (const event of httpx.readAsSSE(res)) {
      events.push(event);
    }

    assert.strictEqual(events.length, 5);

    assert.deepStrictEqual([newEvent({
      data: '{"count":0}',
      event: 'flow',
      id: 'sse-test',
      retry: 3,
    }), newEvent({
      data: '{"count":1}',
      event: 'flow',
      id: 'sse-test',
      retry: 3,
    }), newEvent({
      data: '{"count":2}',
      event: 'flow',
      id: 'sse-test',
      retry: 3,
    }), newEvent({
      data: '{"count":3}',
      event: 'flow',
      id: 'sse-test',
      retry: 3,
    }), newEvent({
      data: '{"count":4}',
      event: 'flow',
      id: 'sse-test',
      retry: 3,
    })], events);
  });

  it('readAsSSE with invalid retry should ok', async function () {
    this.timeout(15000);
    var res = await make(server)('/sse_invalid_retry', {readTimeout: 5000});
    assert.strictEqual(res.statusCode, 200);
    const events = [];
    for await (const event of httpx.readAsSSE(res)) {
      events.push(event);
    }

    assert.strictEqual(events.length, 5);

    assert.deepStrictEqual([newEvent({
      data: '{"count":0}',
      event: 'flow',
      id: 'sse-test',
      retry: undefined,
    }), newEvent({
      data: '{"count":1}',
      event: 'flow',
      id: 'sse-test',
      retry: undefined,
    }), newEvent({
      data: '{"count":2}',
      event: 'flow',
      id: 'sse-test',
      retry: undefined,
    }), newEvent({
      data: '{"count":3}',
      event: 'flow',
      id: 'sse-test',
      retry: undefined,
    }), newEvent({
      data: '{"count":4}',
      event: 'flow',
      id: 'sse-test',
      retry: undefined,
    })], events);
  });

  it('readAsSSE with data divided should ok', async function () {
    this.timeout(15000);
    var res = await make(server)('/sse_with_data_divided', {readTimeout: 5000});
    assert.strictEqual(res.statusCode, 200);
    const events = [];
    for await (const event of httpx.readAsSSE(res)) {
      events.push(event);
    }

    assert.strictEqual(events.length, 4);

    assert.deepStrictEqual([newEvent({
      data: '{"count":0}',
      event: 'flow',
      id: 'sse-test',
      retry: 3
    }), newEvent({
      data: '{"count":2,"tag":"divided"}',
      event: 'flow',
      id: 'sse-test',
      retry: 3,
    }), newEvent({
      data: '{"count":3}',
      event: 'flow',
      id: 'sse-test',
      retry: 3,
    }), newEvent({
      data: '{"count":4}',
      event: 'flow',
      id: 'sse-test',
      retry: 3,
    })], events);
  });
});
