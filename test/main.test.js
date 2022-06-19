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
  
  it('shall load filtered the list', (done) => {
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

  const newItem = {
    name: 'New Item',
    tags: [{id: "mooo"}, {id: "behehe"}]
  }

  it('shall validate correctly', (done) => {
    Adv.validators.post({data: newItem, req: { body: newItem }}).then((rez) => {
      rez.should.be.eql(newItem);
      done();
    }).catch(err => {
      console.log(err);
    })
  })

  it('shall create new adventure', (done) => {
    const { req, res } = express;
    req.body = { ...newItem }; // create a new object since will be modified:
    req.allowPost = true;
    Adv.create(req, res, () => {
      res.state.should.be.eql(0);
      res.data.should.be.Object();
      res.data.createdItem.should.be.Object();
      res.data.createdItem.name.should.be.eql(newItem.name);
      res.data.createdItem.tags.should.be.Array();
      res.data.createdItem.tags.should.be.eql(newItem.tags);

      done();
    })
  })

  it.skip('shall throw an exeption', () => {
    const { req, res } = express;
    should(Adv.update(req, res)).throw('Operation is not allowed');
  })

  it('shall update an adventure', (done) => {
    AdvModel.findOne({}, (err, item) => {
      if(err) return console.error(err);
      const { req, res } = express;
      req.body = {
        ops: { name: 'Maria' }
      }
      req.params = {
        id: item._id.toString()
      }
      req.allowPut = true;
      Adv.update(req, res, () => {
        const i = res.data.ops;
        i.id.should.be.eql(req.params.id);
        i.name.should.be.eql(req.body.ops.name);
        done();
      })
    })
  })
})