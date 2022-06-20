const mongoose = require('mongoose');
const { reqPage, reqSort, keyFilter } = require("ywemay-api-utils");
const { sendError, sendData, notFound, sendForbidden } = require('ywemay-api-send');
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

  storage = {}

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

  checkSecurity = ({req, key}) => {
    const { security } = this;
    req = req || this.storage?.req;
    return new Promise((resolve, reject) => {
      if (!security[key]) {
        return reject(new Error('Security key is missing: ' + key))
      }
      const check = security[key];
      const user = req.userData || null;
      check({req, user}).then(q => resolve({q})).catch(err => reject(err));
    });
  }

  loadList = ({q, projection, skip, limit, sort}) => {
    const {
      model,
      expandItem
    } = this;
    let data = {};

    return new Promise((resolve, reject) => {
      model.countDocuments(q)
        .then((total) => {
        data.pagination = { total, perPage: limit }
        
        if (total === 0) {
          data.items = [];
          return resolve(data);
        }
        
        model.find(q)
          .select(projection)
          .skip(skip)
          .limit(limit)
          .sort(sort)
          .then((items) => {
            data.items = items.map(v => expandItem(v));
            resolve(data);
          }).catch(err => reject(err));
      
      }).catch(err => reject(err));
    });
  }

  getList = (req, res, next) => {
    const { loadList, projections, getSearchFilter, defaults } = this;    
    this.storage = { req, res, next }
    this.checkSecurity({req, key: 'list'}).then(securityFilter => {
      const { skip, limit } = reqPage(req);
      const sort = reqSort(req, defaults.sort || {_id: -1});
      const q = { 
        ...(getSearchFilter(req) || {}),
        ...(req.query?.filter || {}),
        ...securityFilter 
      }
      const projection = projections.list || {};
      loadList({q, projection, skip, limit, sort}).then((data) => {
        res.data = data;
        next();
      }).catch(err => sendError(res, err));
    }).catch(() => sendForbidden(res))
  }

  getManyReference = (req, res, next) => {
    const { model, projections, checkSecurity, expandItem } = this;
    checkSecurity({req, key: 'list'}).then((filter) => {
      const ids = req.query?.ids || req.body?.ids || [];
      if (!Array.isArray(ids)) {
        console.error(new Error('no ids provided filter'));
        return res.status(500).send();
      }
      const validIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id));

      model.find(filter)
        .where('_id').in(validIds)
        .select(projections?.references)
        .then((items) => {
          if (!res.data) res.data = {};
          res.data.items = items.map(v => expandItem(v));
          res.data.total = items.length;
          next();
        }).catch(err => sendError(res, err));
    }).catch(() => sendForbidden(res));
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
    const { createItem, checkSecurity, validators, expandItem, compactItem } = this;

    checkSecurity({req, key: 'post'}).then(() => {
      const validate = validators.post || (() => Promise.resolve(req.body));
      validate({ data: req.body, req, user: req.userData || null }).then((data) => {
        createItem({data: compactItem(data)})
          .then((item) => {
            res.data = { createdItem: expandItem(item) }
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
    }).catch(() => sendForbidden(res));
  }

  update = (req, res, next) => {
    const { model, validators, checkSecurity, compactItem, expandItem } = this;
    checkSecurity({req, key: 'put'}).then((q) => {

      q._id = req.params?.id || false;
      if (!q._id) {
        console.error(new Error('ID expected'));
        return res.status(403).send();
      }
      
      const validate = validators.put || (() => Promise.resolve());
      const ops = req.body.ops || {};
      const user = req.userData || null;
      
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
      }).catch((err) => sendError(res, err) );
    }).catch(() => sendForbidden(res));
  }
  
  updateMany = (req, res, next) => {
    const { model, validators, checkSecurity, compactItem, expandItem } = this;
    checkSecurity({req, key: 'put'}).then((q) => {

      const ids = req.query?.ids || req.body?.ids || []; 
      q._id = { $in: ids };
    
      const validate = validators.put || (() => Promise.resolve());
      const ops = req.body?.ops || {};
      const user = req.userData || null;

      validate({ data: ops, req, user }).then((data) => {
    
        data = compactItem(data);
        model.updateMany(q, { $set: data })
          .exec()
          .then((result) => {
            model.find(q).select({_id: true}).then(items => {
              res.data = {
                result,
                ops, 
                ids: items.map(v => v._id.toString())
              };
              next();
            }).catch(err => sendError(res, err));
          })
          .catch(err => sendError(res, err));
      });
    }).catch(() => sendForbidden(res));
  }

  delete = (req, res, next) => {
    const { model, checkSecurity } = this;
    checkSecurity({req, key: 'delete'}).then((q) => {
      q._id = req.params?.id || false;
      if (!q._id) return sendError(res, new Error('No id provided'));
      model.deleteOne(q).then(result => {
        res.data = { result }
        next();
      }).catch(err => sendError(res, err));
    })
  }

  deleteMany = (req, res, next) => {
    const { model, checkSecurity } = this;
    checkSecurity({req, key: 'delete'}).then((q) => {
      const ids = req.query?.ids || req.body?.id || false;
      if (!ids) return sendError(res, new Error('No ids provided'));
      q._id = { $in: ids }
      model.deleteMany(q).then(result => {
        res.data = { result }
        next();
      }).catch(err => sendError(res, err));
    })
  }
}

module.exports = { Controller, expand, compact }