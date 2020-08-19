var Acl = require("../"),
  tests = require("./tests"),
  backendTests = require("./backendtests");

require("dotenv").config();
const MONGO_URL = process.env.MONGO_URL + "/acltest";

describe("MongoDB - Default", function () {
  before(function (done) {
    var self = this,
      mongodb = require("mongodb");

    mongodb.connect(MONGO_URL, function (error, db) {
      db.dropDatabase(function () {
        self.backend = new Acl.mongodbBackend(db, "acl");
        done();
      });
    });
  });

  run();
});

describe("MongoDB - useSingle", function () {
  before(function (done) {
    var self = this,
      mongodb = require("mongodb");

    mongodb.connect(MONGO_URL, function (error, db) {
      db.dropDatabase(function () {
        self.backend = new Acl.mongodbBackend(db, "acl", true);
        done();
      });
    });
  });

  run();
});

describe("Memory", function () {
  before(function () {
    var self = this;
    self.backend = new Acl.memoryBackend();
  });

  run();
});

function run() {
  Object.keys(tests).forEach(function (test) {
    tests[test]();
  });

  Object.keys(backendTests).forEach(function (test) {
    backendTests[test]();
  });
}
