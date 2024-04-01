# httpx

http(s) module with power.

[![NPM version][npm-image]][npm-url]
[![Node.js CI](https://github.com/JacksonTian/httpx/actions/workflows/node.js.yml/badge.svg)](https://github.com/JacksonTian/httpx/actions/workflows/node.js.yml)
[![codecov][cov-image]][cov-url]
[![npm download][download-image]][download-url]

[npm-image]: https://img.shields.io/npm/v/httpx.svg?style=flat-square
[npm-url]: https://npmjs.org/package/httpx
[cov-image]: https://codecov.io/gh/JacksonTian/httpx/branch/master/graph/badge.svg
[cov-url]: https://codecov.io/gh/JacksonTian/httpx
[download-image]: https://img.shields.io/npm/dm/httpx.svg?style=flat-square
[download-url]: https://npmjs.org/package/httpx

## Installation

```bash
npm install httpx --save
```

## Usage

```js
import * as httpx from 'httpx';
```

### Request URL

```js
const response = await httpx.request('http://www.baidu.com/');
const body = await httpx.read(response, 'utf-8');
console.log(body);
```

### Request SSE URL

```js
const response = await httpx.request('sse url');
for await (const event of httpx.readAsSSE(response)) {
  console.log(event);
}
```

## API

### `httpx.request(url[, options])`

It returns `Promise<Response>`.

Requests the url with options, then return the response.

- **url** String | Object - The URL to request, either a String or a Object that return by [url.parse](http://nodejs.org/api/url.html#url_url_parse_urlstr_parsequerystring_slashesdenotehost).
- ***options*** Object - Optional
  - ***method*** String - Request method, defaults to `GET`. Could be `GET`, `POST`, `DELETE` or `PUT`.
  - ***data*** String | [Buffer](http://nodejs.org/api/buffer.html) | Readable - Manually set the content of payload.
  - ***headers*** Object - Request headers.
  - ***timeout*** Number - Request timeout in milliseconds. Defaults to 3000. When timeout happen, will return `RequestTimeout`.
  - ***agent*** [http.Agent](http://nodejs.org/api/http.html#http_class_http_agent) - HTTP/HTTPS Agent object.
      Set `false` if you does not use agent.
  - ***beforeRequest*** Function - Before request hook, you can change every thing here.
  - ***compression*** Boolean - Enable compression support. Tell server side responses compressed data

### `httpx.read(response[, encoding])`

It returns `Promise<Buffer | String>`.

Consume the response and read all data from the response.

- **response** Response - the Client response. Don't setEncoding() for the response.
- **encoding** String - Optional. If specify the encoding, will return String. If not specify encoding, return the buffer.

### `httpx.readAsSSE(response)`

It returns `AsyncGenerator<Event, void, unknown>`.

Consume the response data with async iterator.

- **response** Response - the Client response. Don't setEncoding() for the response.

## Using with http proxy

```js
import { SocksProxyAgent } from 'socks-proxy-agent';
import * as httpx from 'httpx';

await httpx.request('http://www.baidu.com/', {
  // pass a http proxy agent
  agent: new SocksProxyAgent('socks://your_proxy_server:3001')
});
```

## License

The MIT license
