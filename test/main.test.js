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
  
  const newItem = {
    name: 'New Item',
    tags: [{id: "mooo"}, {id: "behehe"}]
  }

  const filter = { $in: ['Item 8', 'Item 12', 'Item 24'] }

  const expressMock = (done) => {
    const { req, res } = express;
    res.send = () => console.log(new Error('Failed to complete')) && done(); 
    res.status = (state) => console.error(new Error('Exit with state ' + state)) && done(); 
    return { req, res };
  }

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

  it('shall load by references', (done) => {
    AdvModel.find({name: filter}).then((items) => {
      const { req, res } = expressMock(done);
      req.query = {
        perPage: 10,
      }
      req.body = {
        ids: items.map(v => v.id.toString())
      }
      req.allowList = true; //mock security filter returns true - access allowed
      try {
        Adv.getManyReference(req, res, () => {
          res.state.should.be.eql(0);
          res.data.should.be.Object();
          res.data.items.should.be.Object();
          res.data.items.length.should.be.eql(3);
          res.data.items[0].name.should.be.eql(filter.$in[0]);
          done();
        });
      } catch(err) {
        return console.error(err);
      }
    }).catch(err => console.error(err));
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

  it('shall validate correctly', (done) => {
    Adv.validators.post({data: newItem, req: { body: newItem }}).then((rez) => {
      rez.should.be.eql(newItem);
      done();
    }).catch(err => {
      console.log(err);
    })
  })

  it('shall create new adventure', (done) => {
    const { req, res } = expressMock(done);
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

  it('shall update many adventures', (done) => {
    AdvModel.find({name: filter}).then(items => {
      const { req, res } = expressMock(done);
      const tags = [{ id: 'marine', id: 'sport' }];
      req.body = {
        ids: items.map(v => v._id.toString()),
        ops: { tags }
      }
      req.allowPut = true;
      Adv.updateMany(req, res, () => {
        res.data.ids.should.be.Array();
        res.data.ids.length.should.be.eql(items.length);
        const id = res.data.ids[0];
        id.should.be.type('string');
        (id.length > 3).should.be.eql(true);
        done();
      });
    })
  })

  it('shall delete one adventure', (done) => {
    AdvModel.findOne({name: 'Item 13'}).then(item => {
      const { req, res } = expressMock(done);
      req.params = { id: item._id.toString() };
      req.allowDelete = true;
      Adv.delete(req, res, () => {
        res.data.result.should.be.Object();
        res.data.result.deletedCount.should.be.eql(1);
        done();
      })
    })
  })
  
  it.only('shall delete many adventures', (done) => {
    AdvModel.find({name: filter}).then(items => {
      const { req, res } = expressMock(done);
      req.query = { ids: items.map(v => v._id) };
      req.allowDelete = true;
      Adv.deleteMany(req, res, () => {
        res.data.result.should.be.Object();
        res.data.result.deletedCount.should.be.eql(items.length);
        done();
      })
    })
  })
})