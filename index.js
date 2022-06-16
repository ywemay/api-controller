exports.arrayExpand = (tags) => {
  if (!tags) return [];
  const rez = tags.map(v => (typeof v !== 'object' ? {id: v} : v));
  return rez;
}

exports.arrayReduce = (tags) => {
  if (!tags) return [];
  return tags.map(v => (typeof v === 'string' ? v : v.id));
}

exports.arrayExpand = arrayExpand;
exports.arrayReduce = arrayReduce;

// get security definitions (access/permissions)
const getSecurity = (res, def) => {
  const { security } = res;
  if (security === undefined) {
    return def;
  }
  return security;
}

exports.getSecurity = getSecurity;

const normalizeItem = (item, alter = false) => {
  item = {
    id: item._id.toString(),
    ...item.toObject()
  }
  delete item._id;
  if (alter) item = alter(item);
  return item;
}

exports.normalizeItem = normalizeItem;

exports.getList = (Model, params) => {
  const {
    defaults,
    getSearchFilter,
    projection, 
    normalize // alter item normalizer
  } = params;

  return (req, res, next) => {   
    const { page, skip, limit } = reqPage(req);
    const sort = reqSort(req, defaults.sort || {_id: -1});
    const { filter } = req.query;
    const securityFilter = getSecurity(res, defaults.security || {}).list(req);
    if (securityFilter === false) return res.status(403).send();
    const q = typeof getSearchFilter === 'function' 
        ? getSearchFilter(req, securityFilter) : securityFilter;
    if (typeof filter === 'object') q = { ...q, ...filter };
    
    Model.countDocuments(q)
      .then((total) => {
      res.data = res.data || {};
      res.data.pagination = { total, page }
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
}

exports.getManyReference = (params) => {
  const {
    defaults,
    projection,
    normalize
  } = params;
  return (req, res, next) => {
    const q = getSecurity(res).list(req);
    if (q === false) return res.status(403).send();
    const { ids } = req.query;
    const validIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id));

    User.find(q)
      .where('_id').in(validIds)
      .select(projection)
      .then((items) => {
        if (!res.data) res.data = {};
        res.data.items = items.map(v => normalizeItem(v, normalize));
        res.data.total = items.length;
        next();
      })
      .catch(err => {
        return sendError(res, err);
      })
  }
}