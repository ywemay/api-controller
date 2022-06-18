const { Query } = require("mongoose");

const req = () => {};
req.query = {}
req.params = {}

const res = () => {};
res.send = () => {};
res.status = (status) => { this.state = status; return this; }
res.status.send = () => {};

class Request {
  query = {}
  params = {}
}

class Response {
  state = 0
  send = () => { return this; }
  status = ( st ) => {
    this.state = st;
    return this
  }
}

class Express {
  req = new Request();
  res = new Response();

}
module.exports = new Express(); 