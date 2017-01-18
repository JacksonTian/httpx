'use strict';

const url = require('url');

class Timings {
  constructor() {
    this.blocked;
    this.dns;
    this.connect;
    this.send;
    this.wait;
    this.receive;
    this.ssl;
  }
}

class Request {
  constructor(request) {
    this.method = request.method;
    this.url = request.path;
    this.httpVersion = 'HTTP/' + request.httpVersion;
    this.headers = Object.keys(request._headers).map((key) => {
      return {
        name: key,
        value: request._headers[key]
      };
    }); // Array
    var query = url.parse(request.path, true).query;
    this.queryString = Object.keys(query).map((key) => {
      return {
        name: key,
        value: query[key],
        comment: ''
      };
    }); // Array
    var cookie = request._headers.cookie;
    this.cookies = (cookie ? cookie.split('; ') : [])
      .map((pair) => {
        var [name, value] = pair.split('=');
        return {
          name,
          value,
          expires: null,
          httpOnly: false,
          secure: false
        };
      });
    this.headersSize = Buffer.byteLength(request._header); //
    this.bodySize = request.connection._bytesDispatched - this.headersSize; //
  }
}

class Response {
  constructor(response) {
    this.status = response.statusCode;
    this.statusText = response.statusMessage;
    this.httpVersion = 'HTTP/' + response.httpVersion;
    this.headers = Object.keys(response.headers).map((key) => {
      return {
        name: key,
        value: response.headers[key]
      };
    });
    var cookie = response.headers['set-cookie'];
    this.cookies = cookie;
    this.content = {
      size: 0,
      mimeType: response.headers['content-type'],
      compression: 0,
      text: ''
    };
    this.redirectURL = '';
    this.headersSize = 0;
    this.bodySize = 0;
    this._transferSize = this.headersSize + this.bodySize;
  }
}

class Entry {
  constructor(req, res) {
    this.startedDateTime = undefined; // '2017-01-16T03:15:42.068Z'
    this.time = undefined; // 79.48899996699765
    this.request = new Request(req);
    this.response = new Response(res);
    this.timings = new Timings();
    this.serverIPAddress = req.socket.remoteAddress;
  }
}

module.exports = Entry;
