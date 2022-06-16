const mongoose = require('mongoose');
const { reqPage, reqSort, keyFilter } = require("ywemay-api-utils");
const { sendError, sendData, notFound } = require('ywemay-api-send');
const validate = require("ywemay-api-validate");

module.exports = {

  model: null,

  defaults: {
    security: false
  },

  getSearchFilter: () => {},

  projections: {
    list: {},
    references: {},
    view: {},
    create: {}
  },

  alter: {
    item: false
  },

  arrayExpand: (tags) => {
    if (!tags) return [];
    const rez = tags.map(v => (typeof v !== 'object' ? {id: v} : v));
    return rez;
  },

  arrayReduce: (tags) => {
    if (!tags) return [];
    return tags.map(v => (typeof v === 'string' ? v : v.id));
  },

  // get security definitions (access/permissions)
  getSecurity: function (res) {
    const { security } = res;
    if (security === undefined) {
      return this.defaults.security;
    }
    return security;
  },

  normalizeItem: function (item) {
    item = {
      id: item._id.toString(),
      ...item.toObject()
    }
    delete item._id;
    if (typeof this.alter?.item === 'function') {
      item = this.alter.item(item);
    }
    return item;
  },

  getList: function() {
    const {
      Model,
      defaults,
      getSearchFilter,
      projection,
      getSecurity
    } = this;

    return (req, res, next) => {   
      const { page, skip, limit } = reqPage(req);
      const sort = reqSort(req, defaults.sort || {_id: -1});
      const { filter } = req.query;
      const securityFilter = getSecurity(res, defaults.security || {}).list(req);
      if (securityFilter === false) return res.status(403).send();
      const q = { 
        ...(getSearchFilter(req) || {}),
        ...(filter || {}),
        ...securityFilter 
      }
      
      Model.countDocuments(q)
        .then((total) => {
        res.data = res.data || {};
        res.data.pagination = { total, page, perPage: limit }
        if (total === 0) {
          res.data.items = [];
          return sendData(res);
        }
        Model.find(q)
          .select(projection)
          .skip(skip)
          .limit(limit)
          .sort(sort)
          .then((items) => {
          res.data.items = items.map(v => normalizeItem(v, normalize));
          next();
          })
          .catch(err => sendError(res, err));
      })
    .catch(err => sendError(res, err));
    }
  },

  getManyReference: function() {
    const {
      Model,
      defaults,
      projection
    } = this;

    return (req, res, next) => {
      const q = getSecurity(res, defaults.security || {}).list(req);
      if (q === false) return res.status(403).send();
      const { ids } = req.query;
      const validIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id));

      Model.find(q)
        .where('_id').in(validIds)
        .select(projection.references)
        .then((items) => {
          if (!res.data) res.data = {};
          res.data.items = items.map(v => normalizeItem(v));
          res.data.total = items.length;
          next();
        })
        .catch(err => {
          return sendError(res, err);
        })
    }
  },

  createItem: function({data, alter} = {}) {
    const {
      Model,
      // projections,
    } = this;
    return new Promise((resolve, reject) =>{
      //data = keyFilter(data, Object.keys(getAllowedKeys({contact: true})).join(' '));
      if (typeof alter === 'function') alter(data);
      const item = new Model(data);
      item.save()
        .then((newItem) => {
          resolve(newItem);
        })
        .catch(err => {
          reject(err);
        });
    });
  },

  create: function(req, res, next) {
    const { body, alter }= req; 
    const { createItem, getSecurity } = this;
    if(getSecurity(res).post(req) === false) {
      return res.status(403).send();
    }
    if (body.roles) body.roles = rolesReduce(body.roles);
    const doValidate = validate(res.validators.postSchema);
    doValidate(req, res, () => {
      exports.createUser({data: body, alter})
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