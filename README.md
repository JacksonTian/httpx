httpx
===========
http(s) module with power.

[![NPM version][npm-image]][npm-url]
[![build status][travis-image]][travis-url]
[![Coverage Status](https://coveralls.io/repos/JacksonTian/httpx/badge.svg?branch=master&service=github)](https://coveralls.io/github/JacksonTian/httpx?branch=master)
[![David deps][david-image]][david-url]
[![npm download][download-image]][download-url]

[npm-image]: https://img.shields.io/npm/v/httpx.svg?style=flat-square
[npm-url]: https://npmjs.org/package/httpx
[travis-image]: https://img.shields.io/travis/JacksonTian/httpx.svg?style=flat-square
[travis-url]: https://travis-ci.org/JacksonTian/httpx
[david-image]: https://img.shields.io/david/JacksonTian/httpx.svg?style=flat-square
[david-url]: https://david-dm.org/JacksonTian/httpx
[download-image]: https://img.shields.io/npm/dm/httpx.svg?style=flat-square
[download-url]: https://npmjs.org/package/httpx

## Installation

```bash
$ npm install httpx --save
```

## Usage

```js
'use strict';

const httpx = require('httpx');

httpx.request('http://www.baidu.com/').then((response) => {
  response.pipe(process.stdout);

  response.on('end', () => {
    process.stdout.write('\n');
  });
}, (err) => {
  // on error
});
```

Or with `co`.

```js
co(function* () {
  var response = yield httpx.request('http://www.baidu.com/');

  response.pipe(process.stdout);

  response.on('end', () => {
    process.stdout.write('\n');
  });
});
```

Or with `async/await`.

```js
(async function () {
  var response = await httpx.request('http://www.baidu.com/');

  response.pipe(process.stdout);

  response.on('end', () => {
    process.stdout.write('\n');
  });
})();
```

## API

### `httpx.request(url[, options])`

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

- **response** Response - the Client response. Don't setEncoding() for the response.
- **encoding** String - Optional.

## License
The MIT license
