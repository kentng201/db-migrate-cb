# db-migrate-cb

This is a driver for couchbase data migrations. It is based on the [db-migrate](https://db-migrate.readthedocs.io/en/latest/)

## Getting Started

```bash
npm install db-migrate
npm install db-migrate-cb
```

## Configuration

To use this driver, create a `database.json` file with information similar to the following:

```json
{
    "defaultEnv": "dev",
    "dev": {
        "driver": "cb",
        "host": "couchbase://localhost",
        "username": "username",
        "password": "password",
        "bucket": "default"
    }
}
```

## Create a migration

You can create a migration with the following command:

```bash
db-migrate create <file_name>
```

## API

### Create Collection

You may call `createCollection` to create a collection in the bucket.

```js
'use strict';

var dbm;
var type;
var seed;

exports.setup = function (options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = async function (db) {
  await db.createCollection('test');
};

exports.down = async function (db) {
  await db.dropCollection('test');
};

exports._meta = {
  version: 1,
};
```

Pass in the second parameter to `createCollection` to specify the scope. By default, the scope is `_default`.

```js
exports.up = async function (db) {
  await db.createCollection('test', 'my_scope');
};
```

### Drop Collection

You may call `dropCollection` to create a collection in the bucket.
Pass in the second parameter to `dropCollection` to specify the scope. By default, the scope is `_default`.

```js
exports.down = async function (db) {
  await db.dropCollection('test', 'my_scope');
};
```

### Create Index

You may call `createIndex` to create an index in the bucket.

```js
exports.up = async function (db) {
  await db.createIndex('test', 'test_index', ['test']);
};
```

### Drop Index

You may call `dropIndex` to drop an index in the bucket.

```js
exports.down = async function (db) {
  await db.dropIndex('test', 'test_index');
};
```

### Create Scope

You may call `createScope` to create a scope in the bucket.

```js
exports.up = async function (db) {
  await db.createScope('new_scope');
};
```

### Drop Scope

You may call `dropScope` to drop a scope in the bucket.

```js
exports.down = async function (db) {
  await db.dropScope('new_scope');
};
```
