# API Crud 

Helper class/functions to build a CRUD controller.

## Example:

```js
const crud = require('ywemay-api-crud');
const User = require('../models/user);

const references = {
  name: true,
  username: true,
}

const list = {
  ...references,
  email: true,
  roles: true,
  enabled: true
} 

const view = {
  ..list,
  lastLogIn: true
}

settings = {
  model: User,
  
  // initiate the default values
  defaults: {
    // security: permissions and filters
    security: require('../security/users')
  },

  // filters for columns (projections)
  projections: { list, view, references },

  alter: {
    item: function(i) {
      if (i.roles !== undefined)
        i.roles = crud.arrayExpand(i.roles)
      return i;
    }
  },

  getSearchFilter: (req) => {
    const { t, roles } = req.query;
    const q = {}
    if (t) {
      const re = new RegExp(t, 'i');
      q.$or = [{ username: re}, { email: re }, { name: re }];
    }
    if (roles) {
        q.roles = { $in: roles.split(',') };
    }
    return q;
  },
}

module.exports = { ...crud, settings }

```