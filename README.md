httpx
===========
http(s) module with power.

## Installation
```bash
$ npm install httpx --save
```

## Usage

```js
'use strict';

var httpx = require('./');
var co = require('co');

co(function *() {
  var response = yield httpx.request('http://www.baidu.com/');
  response.pipe(process.stdout);
}).then(function (data) {
  console.log(data.toString());
}, function () {

});
```

## License
The MIT license
