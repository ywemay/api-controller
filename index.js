const mongoose = require('mongoose');
const { reqPage, reqSort, keyFilter } = require("ywemay-api-utils");
const { sendError, sendData, notFound } = require('ywemay-api-send');
const validate = require("ywemay-api-validate");

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

  hooks = { normalise: false }

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

  normalizeItem = (item) => {
    item = {
      id: item._id.toString(),
      ...item.toObject()
    }
    delete item._id;
    if (typeof this.hooks?.normalize === 'function') {
      item = this.hooks.normalize(item);
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
      normalizeItem
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
        res.data.items = items.map(v => normalizeItem(v));
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
        res.data.items = items.map(v => normalizeItem(v));
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
    const { body, alter }= req; 
    const { createItem, getSecurity, normalizeItem, defaults } = this;
    if(getSecurity(res).post(req) === false) {
      return res.status(403).send();
    }
    console.log('Here.......')
    if (body.roles) body.roles = rolesReduce(body.roles);
    const doValidate = validate(res.validators?.postSchema
      || defaults.validators.post);
    doValidate(req, res, () => {
      createItem({data: body, alter})
        .then((item) => {
          res.data = {
            createdItem: normalizeItem(item) 
          }
          next();
        })
        .catch(err => sendError(res, err));
    })
  }
}

module.exports = { Controller, expand, reduce }