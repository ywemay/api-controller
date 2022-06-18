const mongoose = require('mongoose');

const mongooseOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
};

const { MONGO_TEST_SERVER } = process.env

const connect = async () => {
  try {
    await mongoose.connect(MONGO_TEST_SERVER, mongooseOptions)
  }
  catch (err) {
    console.log(err);
  }
}

const db = mongoose.connection;

db.on('error', console.error.bind(console, 'connection error:'));

db.on('error', function(error) {
  console.error(error);
  mongoose.disconnect();
});

db.on('disconnected', function() {
  // connect();
});

connect();