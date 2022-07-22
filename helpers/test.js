const chai = require('chai');
require('chai').should();
const chaiHttp = require('chai-http');
chai.use(chaiHttp);

class TestHelper {

  uri = '';
  headers = { "content-type": "application/json" }
  server = null;

  constructor(params = {}) {
    const { uri, headers, server } = params;
    if (uri !== undefined) this.uri = uri;
    if (headers !== undefined) this.headers = headers;
    if (server !== undefined) this.server = server;
    else throw new Error('Server variable required for tests');
  }

  checkListItems = ({done, token = null, items, status = 200}) => {
    chai.request(this.server)
    .get(this.uri)
    .set({"x-token": token, ...headers})
    .end((err, res) => {
      if (!err) {
        res.status.should.be.eq(status);
        if (status === 200) {
          res.body.items.should.be.an('array');
          res.body.items[0].should.be.a('object');
          if (products) {
            res.body.items.length.should.be.equal(items.length);
          }
        }
        done();
      }
      else {
        console.error(err);
      }
    })
  }
  checkGetItem = ({done, token = null, item, cb = false, status = 200}) => {
    const url = this.uri + '/' + item._id.toString();
    chai.request(this.server)
    .get(url)
    .set({"x-token": token, ...headers})
    .end((err, res) => {
      if (!err) {
        res.status.should.be.eq(status);
        if (status === 200) {
          res.body.item.should.be.an('object');
          if (typeof cb === 'function') cb(res);
        }
        done();
      }
    })
  }

  checkCreateItem = ({done, token = null, item, cb = false,  status = 200}) => {
    chai.request(this.server)
    .post(this.uri)
    .set({"x-token": token, ...headers})
    .send(item)
    .end((err, res) => {
      if (!err) {
        res.status.should.be.eq(status);
        if (status === 200) {
          res.body.createdItem.should.be.an('object');
          res.body.createdItem._id.should.be.a('string');
          if (typeof cb === 'function') cb(res);
        }
        done();
      }
    })
  }

  checkModifyItem = ({done, token = null, item, cb = false, status = 200}) => {
    chai.request(this.server)
    .put(this.uri + '/' + item._id.toString())
    .set({"x-token": token, ...headers})
    .send({ops: {published: true, title: 'Modified Product'}})
    .end((err, res) => {
      if (!err) {
        res.status.should.be.eq(status);
        if (status === 200) {
          res.body.ops.should.be.an('object');
          res.body.result.should.be.an('object');
          if (typeof cb === 'function') cb(res);
        }
        done();
      }
    })
  }

  checkDeleteItem = ({done, item, token = null, cb = false, status = 200}) => {
    chai.request(this.server)
    .delete(this.uri + '/' + item._id.toString())
    .set({"x-token": token, ...headers})
    .end((err, res) => {
      if (!err) {
        res.status.should.be.eq(status);
        if (typeof cb === 'function') cb(res);
        done();
      }
    })
  }
}

module.exports = TestHelper;