const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  name: String,
  tags: [ String ]
});

const AdventureModel = mongoose.model('Adventures', schema);

module.exports = AdventureModel;