const { 
  Controller,
  expand, 
  compact
} = require('../../index');
const model = require('../models/adventures');
const yup = require('yup');

const schema = yup.object().shape({
  name: yup.string().min(2).max(30).required(),
  tags: yup.array().of(
    yup.object().shape({
      id: yup.string().min(1).max(20)
    })
  )
});

const securityCheck = (allow) => {
  return allow ? Promise.resolve({}) 
    : Promise.reject(new Error('Insufficient permissions'));
} 

const Adv = new Controller({
  model,
  // moking security settings:
  security: {
    list: ({req}) => securityCheck(req.allowList),
    view: ({req}) => securityCheck(req.allowView),
    post: ({req}) => securityCheck(req.allowPost),
    put: ({req}) => securityCheck(req.allowPut),
    delete: ({req}) => securityCheck(req.allowDelete),
  },
  validators: {
    post: ({req, data}) => schema.validate(req.body || data),
    put: ({data}) => schema.pick(Object.keys(data)).validate(data),
  },
  projections: {
    list: { name: true },
    references: { name: true },
    view: { name: true, tags: true },
  },
  hooks: {
    expand: (item) => {
      if (Array.isArray(item.tags))
        item.tags = expand(item.tags);
      return item;
    },
    compact: (item) => {
      if (Array.isArray(item.tags))
        item.tags = compact(item.tags);
      return item;
    }
  }
});

module.exports = Adv; 