# API Crud

Helper class/functions to build a CRUD controller.

## Example:

Controller definition

```js
// controllers/example.js

// import controller builder class and helper functions
const { Controller, expand, compact } = require("../../index");
// import example model - mongoose defined model (consult mongoose documentation)
const model = require("../models/Example");
// import yup for field validation
const yup = require("yup");
// import role constants and hasRole function to check access
const {
  ADMIN,
  MANAGER,
  SELLER,
  CUSTOMER,
  hasRole,
} = require("ywemay-api-role");

// define validation schema (consult you package documentation)
const schema = yup.object().shape({
  name: yup.string().min(2).max(30).required(),
  tags: yup.array().of(
    yup.object().shape({
      id: yup.string().min(1).max(20),
    })
  ),
});

const Adv = new Controller({
  model,
  // security settings:
  security: {
    // everybody is allowed to list our Example list
    list: () => Promise.resolve(),
    // everybody is allowed to view our Example list
    view: () => Promise.resolve(),
    // only ADMIN, MANAGER and SELLER groups are allowed to post Example record
    post: ({ user }) => {
      return new Promise((resolve, reject) => {
        hasRole(user, [ADMIN, MANAGER, SELLER]) ? resolve({}) : reject();
      });
    },
    // only ADMIN, MANAGER and SELLER groups are allowed to update Example record
    put: ({ user }) => {
      return new Promise((resolve, reject) => {
        hasRole(user, [ADMIN, MANAGER, SELLER]) ? resolve({}) : reject();
      });
    },
    // ADMIN, MANAGER can delete any Example, SELLER can delete own Examples.
    delete: ({ user }) => {
      return new Promise((resolve, reject) => {
        if (hasRole(user, [ADMIN, MANAGER])) return resolve({});
        if (hasRole(user, [SELLER])) return resolve({ owner: user.uid });
        reject();
      });
    },
  },
  // validate schemas for received data before saving/updating
  validators: {
    post: ({ data }) => schema.validate(data),
    put: ({ data }) => schema.pick(Object.keys(data)).validate(data),
  },
  // what fields shall be included during list, getManyReference, view
  projections: {
    list: { name: true },
    references: { name: true },
    view: { name: true, tags: true },
  },
  hooks: {
    // item prepared for sending out from API
    expand: (item) => {
      if (Array.isArray(item.tags)) item.tags = expand(item.tags);
      return item;
    },
    // item prepared to be saved in db
    compact: (item) => {
      if (Array.isArray(item.tags)) item.tags = compact(item.tags);
      return item;
    },
  },
});

module.exports = Adv;
```

Using the controller in routes:

```js
const {
  getList,
  getOne,
  getManyReference,
  create,
  update,
  updateMany,
  deleteOne,
  deleteMany,
} = require("../controllers/example");
const router = require("express").Router();
const { checkAuth, send } = require("ywemay-api-user");

router.use(checkAuth);

router.get("/", getList);
router.get("/id/:id", getOne);
router.get("/ref", getManyReference);
router.post("/", create);
router.put("/", updateMany);
router.put("/id/:id", update);
router.delete("/", deleteMany);
router.delete("/id/:id", deleteOne);

router.use(send);

module.exports = router;
```

Or, shorter version:

```js
const { setRoutes } = require("../controllers/example");
const router = require("express").Router();
const { checkAuth, send } = require("ywemay-api-user");

router.use(checkAuth);

setRoutes(router);

router.use(send);

module.exports = router;
```

## Test Helper

```js
// test/requests/contacts.js
const TestHelper = require("ywemay-api-controller/helpers/test");
const server = require("../../src/index");

const Requests = new TestHelper({ server, uri: "/contacts" });

module.exports = Requests;
```

```js
// test/routes/contacts.test.js
const {
  checkListItems,
  checkGetItem,
  checkCreateItem,
  checkModifyItem,
  checkDeleteItem,
} = require("../requests/contacts");

describe("Contacts", () => {
  it("should load contact list", (done) =>
    checkListItems({
      token,
      done,
      items,
      status, // defaults to 200
    }));

  it("should load one item", (done) =>
    checkGetItem({
      done,
      token,
      item, // shall contain item._id
      status, // defaults to 200
    }));

  // ... Create, Modify and Delete have the same parameters as checkGetItem
});
```
