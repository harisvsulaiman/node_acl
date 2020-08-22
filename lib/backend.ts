// @ts-nocheck
/**
  Backend Interface.

  Implement this API for providing a backend for the acl module.
*/

type Backend = {
  begin: () => Promise<object>;
  end: (transaction) => Promise<void>;
  clean: () => Promise<void>;
  get: (bucket, key) => Promise<any>;
  unions: (bucket, keys) => Promise<any>;
  union: (bucket, keys) => Promise<any>;
  add: (transaction, bucket, key) => Promise<any>;
  del: (transaction, bucket, keys) => Promise<any>;
  remove: (transaction, bucket, key, values) => Promise<any>;
};

export default Backend;
