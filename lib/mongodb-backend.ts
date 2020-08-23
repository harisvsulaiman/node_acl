/**
  MongoDB Backend.
  Implementation of the storage backend using MongoDB
*/

import _ from "lodash";
import { Db as MongoDB } from "mongodb";
import Backend from "./backend";

// Name of the collection where meta and allowsXXX are stored.
// If prefix is specified, it will be prepended to this name, like acl_resources
const aclCollectionName = "resources";

export class MongoDBBackend implements Backend {
  db: MongoDB = null;
  prefix: any;
  useSingle: boolean;
  useRawCollectionNames: boolean;

  constructor(
    db: MongoDB,
    prefix?: any,
    useSingle?: any,
    useRawCollectionNames?: boolean
  ) {
    this.db = db;
    this.prefix = typeof prefix !== "undefined" ? prefix : "";
    this.useSingle = typeof useSingle !== "undefined" ? useSingle : false;
    this.useRawCollectionNames = useRawCollectionNames === false; // requires explicit boolean false value
  }

  /**
      Begins a transaction.
   */
  async begin() {
    // returns a transaction object(just an array of functions will do here.)
    return [];
  }

  /**
     Ends a transaction (and executes it)
  */
  async end(transaction) {
    // const session = client.startSession();
    // await session.withTransaction(async () => {})

    // contract(arguments).params("array", "function").end();
    await Promise.all(transaction);
  }

  /**
    Cleans the whole storage.
  */
  async clean() {
    // // contract(arguments).params("function").end();
    // this.db.collections((err, collections) => {
    //   if (err instanceof Error) return cb(err);
    //   async.forEach(
    //     collections,
    //     (coll, innercb) => {
    //       coll.drop(() => {
    //         innercb();
    //       }); // ignores errors
    //     },
    //     cb
    //   );
    // });
  }

  /**
     Gets the contents at the bucket's key.
  */
  async get(bucket, key) {
    // contract(arguments).params("string", "string|number", "function").end();
    key = encodeText(key);
    const searchParams = this.useSingle
      ? { _bucketname: bucket, key }
      : { key };
    const collName = this.useSingle ? aclCollectionName : bucket;

    return await new Promise((resolve, reject) => {
      this.db.collection(
        this.prefix + this.removeUnsupportedChar(collName),
        (err, collection) => {
          if (err instanceof Error) reject(err);

          // Excluding bucket field from search result
          collection.findOne(
            searchParams,
            // @ts-ignore
            { _bucketname: 0 },
            (err, doc) => {
              if (err) return reject(err);
              if (!_.isObject(doc)) return resolve([]);
              doc = fixKeys(doc);

              resolve(_.without(_.keys(doc), "key", "_id"));
            }
          );
        }
      );
    });
  }

  /**
    Returns the union of the values in the given keys.
  */
  async union(bucket, keys) {
    // contract(arguments).params("string", "array", "function").end();
    keys = encodeAll(keys);
    const searchParams = this.useSingle
      ? { _bucketname: bucket, key: { $in: keys } }
      : { key: { $in: keys } };
    const collName = this.useSingle ? aclCollectionName : bucket;

    return await new Promise((resolve, reject) => {
      this.db.collection(
        this.prefix + this.removeUnsupportedChar(collName),
        (err, collection) => {
          if (err instanceof Error) return reject(err);
          // Excluding bucket field from search result
          collection
            //@ts-ignore
            .find(searchParams, { _bucketname: 0 })
            .toArray((err, docs) => {
              if (err instanceof Error) return reject(err);
              if (!docs.length) return resolve([]);

              const keyArrays = [];
              docs = fixAllKeys(docs);
              docs.forEach((doc) => {
                keyArrays.push(..._.keys(doc));
              });

              resolve(_.without(_.union(keyArrays), "key", "_id"));
            });
        }
      );
    });
  }

  /**
    Adds values to a given key inside a bucket.
  */
  async add(transaction, bucket, key, values) {
    // contract(arguments)
    //   .params("array", "string", "string|number", "string|array|number")
    //   .end();

    if (key == "key") throw new Error("Key name 'key' is not allowed.");
    key = encodeText(key);
    const self = this;
    const updateParams = self.useSingle
      ? { _bucketname: bucket, key }
      : { key };
    const collName = self.useSingle ? aclCollectionName : bucket;

    transaction.push(async (cb) => {
      values = makeArray(values);

      return await new Promise((resolve, reject) => {
        self.db.collection(
          self.prefix + self.removeUnsupportedChar(collName),
          (err, collection) => {
            if (err instanceof Error) return reject(err);

            // build doc from array values
            const doc = {};
            values.forEach((value) => {
              doc[value] = true;
            });

            // update document
            collection.updateMany(
              updateParams,
              { $set: doc },
              { upsert: true },
              (err) => {
                if (err instanceof Error) return reject(err);
                resolve(undefined);
              }
            );
          }
        );
      });
    });

    transaction.push(async (cb) => {
      return await new Promise((resolve, reject) => {
        self.db.collection(
          self.prefix + self.removeUnsupportedChar(collName),
          (err, collection) => {
            // Create index
            collection.createIndex({ _bucketname: 1, key: 1 }, (err) => {
              if (err instanceof Error) {
                return reject(err);
              } else {
                resolve();
              }
            });
          }
        );
      });
    });
  }

  /**
     Delete the given key(s) at the bucket
  */
  async del(transaction, bucket, keys) {
    // contract(arguments).params("array", "string", "string|array").end();
    keys = makeArray(keys);
    const self = this;
    const updateParams = self.useSingle
      ? { _bucketname: bucket, key: { $in: keys } }
      : { key: { $in: keys } };
    const collName = self.useSingle ? aclCollectionName : bucket;

    transaction.push(async (cb) => {
      return await new Promise((resolve, reject) => {
        self.db.collection(
          self.prefix + self.removeUnsupportedChar(collName),
          async (err, collection) => {
            if (err instanceof Error) return reject(err);
            await collection.deleteMany(updateParams, (err) => {
              if (err instanceof Error) return reject(err);
              resolve();
            });
          }
        );
      });
    });
  }

  /**
    Removes values from a given key inside a bucket.
  */
  async remove(transaction, bucket, key, values) {
    // contract(arguments)
    //   .params("array", "string", "string|number", "string|array|number")
    //   .end();
    key = encodeText(key);
    const self = this;
    const updateParams = self.useSingle
      ? { _bucketname: bucket, key }
      : { key };
    const collName = self.useSingle ? aclCollectionName : bucket;

    values = makeArray(values);
    transaction.push(async (cb) => {
      return await new Promise((resolve, reject) => {
        self.db.collection(
          self.prefix + self.removeUnsupportedChar(collName),
          (err, collection) => {
            if (err instanceof Error) return reject(err);

            // build doc from array values
            const doc = {};
            values.forEach((value) => {
              doc[value] = true;
            });

            // update document
            collection.updateMany(
              updateParams,
              { $unset: doc },
              { upsert: true },
              (err) => {
                if (err instanceof Error) return reject(err);
                resolve();
              }
            );
          }
        );
      });
    });
  }

  removeUnsupportedChar(text: string) {
    if (!this.useRawCollectionNames) {
      text = decodeURIComponent(text);
      text = text.replace(/[/\s]/g, "_"); // replaces slashes and spaces
    }
    return text;
  }
}

function encodeText(text: string) {
  text = encodeURIComponent(text);
  text = text.replace(/\./g, "%2E");
  return text;
}

function decodeText(text: string) {
  text = decodeURIComponent(text);
  return text;
}

function encodeAll(arr) {
  if (Array.isArray(arr)) {
    const ret = [];
    arr.forEach((aval) => {
      ret.push(encodeText(aval));
    });
    return ret;
  } else {
    return arr;
  }
}

function decodeAll(arr) {
  if (Array.isArray(arr)) {
    const ret = [];
    arr.forEach((aval) => {
      ret.push(decodeText(aval));
    });
    return ret;
  } else {
    return arr;
  }
}

function fixKeys(doc) {
  if (doc) {
    const ret = {};
    for (const key in doc) {
      if (doc.hasOwnProperty(key)) {
        ret[decodeText(key)] = doc[key];
      }
    }
    return ret;
  } else {
    return doc;
  }
}

function fixAllKeys(docs) {
  if (docs && docs.length) {
    const ret = [];
    docs.forEach((adoc) => {
      ret.push(fixKeys(adoc));
    });
    return ret;
  } else {
    return docs;
  }
}

function makeArray(arr) {
  return Array.isArray(arr) ? encodeAll(arr) : [encodeText(arr)];
}
