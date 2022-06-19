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

const Adv = new Controller({
  model,
  // moking security settings:
  security: {
    list: ({req}) => (req.allowList ? {} : false),
    view: ({req}) => (req.allowView ? {} : false),
    post: ({req}) => (req.allowPost ? {} : false),
    put: ({req}) => (req.allowPut ? {} : false),
    delete: ({req}) => (req.allowDelete ? {} : false),
  },
  validators: {
    post: ({req, data}) => schema.validate(req.body || data),
    put: ({req}) => {
      const data = req.body?.ops || {};
      return schema.pick(Object.keys(data)).validate(data);
    }
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