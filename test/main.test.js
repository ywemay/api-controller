require('dotenv').config();
const mocha = require('mocha');
const should = require('should');
const AdvModel = require('./models/adventures');
const Adv = require('./controllers/adventures');
const express = require('./mock-express')
const mongoose = require('mongoose');
// require('./db');

const mongooseOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
};
mongoose.connect(process.env.MONGO_TEST_SERVER, mongooseOptions);

describe('Crud Controller Builder test', () => {
  before(async () => {
    try {
      await AdvModel.deleteMany({});
      for(let i = 1; i <= 30; i++) {
        const data = { name: `Item ${i}`, tags: ['one', 'two', 'three']}
        await Adv.createItem({data});
      }
    } catch(err) {
      console.log(err);
    }
  })

  after(() => {
   //  mongoose.connection.close();
  })

  it('getList shall be a function', () => {
    Adv.getList.should.be.Function();
  })

  it('shall return security object', (done) => {
    const { res } = express;
    Adv.getSecurity(res).should.be.Object();
    done();
  })

  it('shall load the list', (done) => {
    const { req, res } = express;
    req.query = {
      perPage: 10,
    }
    req.allowList = true; //mock security filter returns true - access allowed
    Adv.getList(req, res, () => {
      res.state.should.be.eql(0);
      res.data.should.be.Object();
      res.data.items.should.be.Object();
      res.data.items.length.should.be.eql(10);
      done();
    });
  })
  
  it('shall load the list', (done) => {
    const { req, res } = express;
    req.query = {
      perPage: 10,
      filter: { name: 'Item 3' }
    }
    req.allowList = true; //mock security filter returns true - access allowed
    Adv.getList(req, res, () => {
      res.state.should.be.eql(0);
      res.data.should.be.Object();
      res.data.items.should.be.Object();
      res.data.items.length.should.be.eql(1);
      res.data.items[0].name.should.be.eql('Item 3');
      done();
    });
  })

  it.only('shall create new adventure', (done) => {
    const { req, res } = express;
    req.body = {
      name: 'New Item',
      tags: [{id: 'mooo'}, {id: 'behehe'}]
    }
    req.allowPost = true;
    Adv.create(req, res, () => {
      console.log(res)
      res.state.should.be.eql(0);
      res.data.should.be.Object();
      done();
    })
  })
})