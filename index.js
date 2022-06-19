const mongoose = require('mongoose');
const { reqPage, reqSort, keyFilter } = require("ywemay-api-utils");
const { sendError, sendData, notFound } = require('ywemay-api-send');
// const validate = require("ywemay-api-validate");
const yup = require('yup');

/*
const validate =  (req, res, schema) => {
  return new Promise((resolve, reject) => {
    console.log(typeof schema)
    const s = typeof schema === 'function' ? schema({req, res}) : schema;
    if (s.schema !== undefined) {
      const keys = Object.keys(req.body);
      const unknownKeys = keys.filter(key => !s.keys.includes(key));
      const keysSchema = yup.array(yup.string()
        .oneOf(s.keys, 'Unknown keys: ' + unknownKeys.join(', ')));
      s.schema.validate(req.body).then(() => {
        keysSchema.validate(keys).then(() => resolve())
      }).catch(err => {
        console.error(err);
        reject(); 
      })
    }
    else s.validate(req.body).then(resolve()).catch(err => reject(err));
  })
}*/

const expand = (tags) => {
  if (!tags) return [];
  const rez = tags.map(v => (typeof v !== 'object' ? {id: v} : v));
  return rez;
}

const compact = (tags) => {
  if (!tags) return [];
  return tags.map(v => (typeof v === 'string' ? v : v.id));
}

class Controller {

  model = null;

  defaults = {}

  getSearchFilter = () => {}

  security = {}
  validators = {}
  projections = {}

  hooks = {}

  constructor(params) {
    const { model, security, validators, projections, getSearchFilter, hooks } = params;
    this.model = model || null;
    this.security = security || { 
      list: () => false,
      view: () => false,
      post: () => false,
      put: () => false,
      delete: () => false,
     };
    this.validators  = validators || {
      post: () => new Promise.resolve(),
      put: () => new Promise.resolve(),
      putMany: () => new Promise.resolve(),
      delete: () => new Promise.resolve(),
      deleteMany: () => new Promise.resolve(),
    };
    this.getSearchFilter = getSearchFilter || (() => {});
    this.projections = projections || {
      list: {},
      references: {},
      view: {},
    }
    this.hooks = hooks || { expand: false, compact: false }
  }

  expandItem = (item) => {
    item = {
      id: item._id.toString(),
      ...(typeof item.toObject === 'function' ? item.toObject() : item)
    }
    delete item._id;
    if (typeof this.hooks?.expand === 'function') {
      item = this.hooks.expand(item);
    }
    return item;
  }

  compactItem = (item) => {
    if (typeof this.hooks?.compact === 'function') {
      item = this.hooks.compact(item);
    }
    return item;
  }

  getList = (req, res, next) => {
    
    const {
      model,
      defaults,
      getSearchFilter,
      projection,
      security,
      expandItem
    } = this;

    const { page, skip, limit } = reqPage(req);
    const sort = reqSort(req, defaults.sort || {_id: -1});
    const { filter } = req.query;
    const user = req.userData || null;
    const securityFilter = security.list({req, user});
    if (securityFilter === false) return res.status(403).send();
    const q = { 
      ...(getSearchFilter(req) || {}),
      ...(filter || {}),
      ...securityFilter 
    }
    
    model.countDocuments(q)
      .then((total) => {
      res.data = res.data || {};
      res.data.pagination = { total, page, perPage: limit }
      
      if (total === 0) {
        res.data.items = [];
        return sendData(res);
      }

      model.find(q)
        .select(projection)
        .skip(skip)
        .limit(limit)
        .sort(sort)
        .then((items) => {
        res.data.items = items.map(v => expandItem(v));
        next();
      }).catch(err => sendError(res, err));

    }).catch(err => sendError(res, err));
  }

  getManyReference = (req, res, next) => {
    const { model, projection, security } = this;
    const user = req.userData || null;
    const q = security.list({req, user});
    if (q === false) return res.status(403).send();
    const { ids } = req.query;
    const validIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id));

    model.find(q)
      .where('_id').in(validIds)
      .select(projection.references)
      .then((items) => {
        if (!res.data) res.data = {};
        res.data.items = items.map(v => expandItem(v));
        res.data.total = items.length;
        next();
      }).catch(err => sendError(res, err))
  }

  createItem = ({data, alter} = {}) => {
    const {
      model,
      // projections,
    } = this;
    return new Promise((resolve, reject) =>{
      //data = keyFilter(data, Object.keys(getAllowedKeys({contact: true})).join(' '));
      if (typeof alter === 'function') alter(data);
      const item = new model(data);
      item.save()
        .then((newItem) => {
          resolve(newItem);
        })
        .catch(err => {
          reject(err);
        });
    });
  }

  create = (req, res, next) => {
    const { createItem, security, validators, expandItem, compactItem } = this;
    const user = req.userData || null;
    if(security.post({req, user}) === false) {
      console.error(new Error('Operation is not allowed'));
      return res.status(403).send();
    }

    const validate = validators.post || (() => Promise.resolve(req.body));
    validate({ data: req.body, req, user: req.userData || null }).then((data) => {
      createItem({data: compactItem(data)})
        .then((item) => {
          res.data = {
            createdItem: expandItem(item) 
          }
          next();
        })
        .catch(err => {
          console.error(err);
          sendError(res, err);
        })
    })
    .catch(err => {
      console.error(err);
      sendError(res, err);
    })
  }

  update = (req, res, next) => {
    const { model, security, validators, compactItem, expandItem } = this;
    const user = req.userData || null;
    const q = security.put({req, user});
    if(q === false) {
      console.error(new Error('Opration is not allowed'));
      return res.status(403).send();
    }
    q._id = req.params?.id || false;
    if (!q._id) {
      console.error(new Error('ID expected'));
      return res.status(403).send();
    }
    
    const validate = validators.put || (() => Promise.resolve());
    const ops = req.body.ops || {};

    validate({ data: ops, req, user }).then((data) => {
  
      data = compactItem(data);
      model.updateOne(q, { $set: data })
        .exec()
        .then((result) => {
          data._id = q._id;
          res.data = { result, ops: expandItem(data) };
          next();
        })
        .catch(err => sendError(res, err));
    });
  }
  
}

module.exports = { Controller, expand, compact }