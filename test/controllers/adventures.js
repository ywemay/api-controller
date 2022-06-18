const { 
  Controller,
  expand, 
  // reduce 
} = require('../../index');
const model = require('../models/adventures');
const yup = require('yup');

const Adv = new Controller( {
  model,
  defaults: {
    // moking security settings:
    security: {
      list: (req) => (req.allowList || false),
      view: (req) => (req.allowView || false),
      post: (req) => (req.allowPost || false),
      put: (req) => (req.allowPut || false),
      delete: (req) => (req.allowDelete || false),
    },
    validators: {
      post: {
        name: yup.string().min(2).max(30).required(),
        tags: yup.array().of(yup.string().min(1).max(30))
      }
    }
  },
  projections: {
    list: { name: true },
    references: { name: true },
    view: { name: true, tags: true },
  },
  hooks: {
    normalize: (item) => {
      item.tags = expand(item.tags);
      return item;
    }
  }
});

module.exports = Adv; 