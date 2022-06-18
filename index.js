const mongoose = require('mongoose');
const { reqPage, reqSort, keyFilter } = require("ywemay-api-utils");
const { sendError, sendData, notFound } = require('ywemay-api-send');
// const validate = require("ywemay-api-validate");

const validate =  (schema) => async (req, res, next) => {
  try {
    const s = typeof schema === 'function' ? schema({req, res}) : schema;
    if (s.schema !== undefined) {
      console.log('Validating....')
      const keys = Object.keys(req.body);
      const unknownKeys = keys.filter(key => !s.keys.includes(key));
      await s.schema.validate(req.body);
      const keysSchema = yup.array(yup.string()
        .oneOf(s.keys, 'Unknown keys: ' + unknownKeys.join(', ')));
      await keysSchema.validate(keys);
      console.log('Arrived gere......')
      return next();
    }
    await s.validate(req.body);
    next();
  } catch (err) {
    console.log(err.errors);
    res.status(400).send(err);
  }
}

const expand = (tags) => {
  if (!tags) return [];
  const rez = tags.map(v => (typeof v !== 'object' ? {id: v} : v));
  return rez;
}

const reduce = (tags) => {
  if (!tags) return [];
  return tags.map(v => (typeof v === 'string' ? v : v.id));
}

class Controller {

  model = null;

  defaults = {}

  getSearchFilter = () => {}

  projections = {}

  hooks = { 
    expand: false,
    reduce: false,
  }

  constructor(params) {
    const { model, defaults, projections, getSearchFilter, hooks } = params;
    this.model = model || null;
    this.defaults = defaults || { security: false, validators: {} };
    this.getSearchFilter = getSearchFilter || (() => {});
    this.projections = projections || {
      list: {},
      references: {},
      view: {},
    }
    this.hooks = hooks || { normalise: false }
  }

  // get security definitions (access/permissions)
  getSecurity = (res) => {
    const { security } = res;
    if (security === undefined) {
      return this.defaults.security || {};
    }
    return security;
  }

  expandItem = (item) => {
    item = {
      id: item._id.toString(),
      ...item.toObject()
    }
    delete item._id;
    if (typeof this.hooks?.expand === 'function') {
      item = this.hooks.expand(item);
    }
    return item;
  }

  reduceItem = (item) => {
    if (typeof this.hooks?.reduce === 'function') {
      item = this.hooks.reduce(item);
    }
    return item;
  }

  getList = (req, res, next) => {
    
    const {
      model,
      defaults,
      getSearchFilter,
      projection,
      getSecurity,
      expandItem
    } = this;

    const { page, skip, limit } = reqPage(req);
    const sort = reqSort(req, defaults.sort || {_id: -1});
    const { filter } = req.query;
    const securityFilter = getSecurity(res).list(req);
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
    const { model, projection } = this;
    const q = getSecurity(res).list(req);
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

  createItem ({data, alter} = {}) {
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
    const { createItem, getSecurity, expandItem, reduceItem, defaults } = this;
    if(getSecurity(res).post(req) === false) {
      return res.status(403).send();
    }

    const validator = res.validators?.postSchema
      || defaults.validators.post;
    
    const doValidate = validate(validator);
    
    const { body, alter } = req;
    doValidate(req, res, () => {
      console.log('Validated.....');
      createItem({data: reduceItem(body), alter})
        .then((item) => {
          console.log('Created', item)
          res.data = {
            createdItem: expandItem(item) 
          }
          next();
        })
        .catch(err => sendError(res, err));
    })
  }
}

module.exports = { Controller, expand, reduce }