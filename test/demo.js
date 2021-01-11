'use strict';

const httpx = require('./');
const Entry = require('./lib/entry');

var url = 'https://opencollective.com/mochajs/sponsors/badge.svg';

httpx.request(url, {
  enableCompress: true
}).then((response) => {
  var entry = new Entry(response.req, response);
  console.log(JSON.stringify(entry, null, 2));
  return httpx.read(response, 'utf8');
}).then((content) => {
  console.log(content);
}, (err) => {
  // on error
  console.error(err.stack);
});
