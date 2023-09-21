// @ts-ignore
import MigratorInterface from 'db-migrate/lib/interface/migratorInterface';
import {
    CallbackFunction,
    InternalOptions
} from 'db-migrate-base';
const Base = require('db-migrate-base');
import Promise from 'bluebird';
import {
    Bucket,
    Cluster,
    ICollectionSpec
} from 'couchbase';
import moment from 'moment';

function dummy() {
    // eslint-disable-next-line prefer-rest-params
    arguments[arguments.length - 1]('not implemented');
}

// Add ability to create scope
MigratorInterface.prototype.createScope = dummy;
// Add ability to drop scope
MigratorInterface.prototype.dropScope = dummy;

let internals: InternalOptions = {
    mod: {
        log: 'info',
        type: 'cb'
    }
};
let config: CouchbaseConfig = {};

export type CouchbaseConfig = {
    host?: string;
    username?: string;
    password?: string;
    bucket?: string;
    scope?: string;
    collection?: string;
};

let connection: Cluster;
let bucket: Bucket;
let scopeName: string;
let collectionName: string;

const CouchbaseDriver = Base.extend({
    init: function (conn: Cluster) {
        this._super(internals);
        connection = conn;

        if (!config.bucket) {
            throw new Error('Configuration must specify bucket');
        }
        try {
            bucket = connection.bucket(config.bucket);
        } catch (err) {
            if (err) {
                throw new Error(`Could not open migration bucket: ${err}`);
            }
        }
    },

    close: function (callback?: CallbackFunction) {
        return new Promise(async (resolve, reject) => {
            try {
                await connection.close();
                resolve(true);
            } catch (err) {
                reject(err);
            }
        }).nodeify(callback);

    },

    startMigration: function (callback: CallbackFunction) {
        return Promise.resolve(true).nodeify(callback);
    },

    endMigration: function (callback: CallbackFunction) {
        return Promise.resolve(true).nodeify(callback);
    },

    allLoadedMigrations: function (callback?: CallbackFunction) {
        return new Promise((resolve) => {
            bucket.scope(scopeName).query(`
                SELECT meta().id, name, run_on
                FROM \`${bucket.name}\`.\`${scopeName}\`.\`${collectionName}\`
                ORDER BY run_on DESC, name DESC
            `).then((res) => res.rows).then(resolve);
        }).nodeify(callback);
    },

    createMigrationsTable: function (callback?: CallbackFunction) {
        return new Promise(async (resolve) => {
            const spec: ICollectionSpec = {
                name: collectionName,
                scopeName
            };
            let collectionExisted;
            try {
                const collection = bucket.scope(scopeName).collection('migrations');
                await collection.upsert('TestMigrationExist', { ok: true });
                await collection.remove('TestMigrationExist');
                collectionExisted = true;
            } catch (err) {
                collectionExisted = false;
            }
            if (!collectionExisted) {
                console.log('[Info] Initialize migrations collection');
                await bucket.collections().createCollection(spec, {});
                await new Promise((res) => setTimeout(res, 1000));
                const createIndexQuery = `CREATE PRIMARY INDEX \`#primary\` ON \`${bucket.name}\`.\`${scopeName}\`.\`${collectionName}\``;
                await connection.query(createIndexQuery);
                console.log('[Info] Initialized migrations collection');
            }
            resolve();
        }).nodeify(callback);
    },

    addMigrationRecord: function (migrationName: string, callback?: CallbackFunction) {
        migrationName = migrationName.replace(/\//g, '');
        return new Promise((resolve) => {
            bucket
                .scope(scopeName)
                .collection(collectionName)
                .upsert(migrationName, {
                    name: migrationName,
                    run_on: moment().toISOString()
                })
                .then(resolve);
        }).nodeify(callback);
    },

    deleteMigration: function (migrationName: string, callback?: CallbackFunction) {
        migrationName = migrationName.replace(/\//g, '');
        return new Promise(async (resolve) => {
            try {
                const isMigrated = await bucket.scope(scopeName).collection(collectionName).get(migrationName);
                if (isMigrated) {
                    await bucket.scope(scopeName).collection(collectionName).remove(migrationName);
                }
                resolve();
            } catch (error) {
                resolve();
            }
        }).nodeify(callback);
    },

    createCollection: function (collectionName: string, scope?: string, callback?: CallbackFunction) {
        if (!scope) {
            scope = scopeName;
        }
        return new Promise(async (resolve) => {
            const spec: ICollectionSpec = {
                name: collectionName,
                scopeName: scope as string
            };
            await bucket.collections().createCollection(spec, {});
            await new Promise((res) => setTimeout(res, 1000));
            const createIndexQuery = `CREATE PRIMARY INDEX \`#primary\` ON \`${bucket.name}\`.\`${scope}\`.\`${collectionName}\``;
            await connection.query(createIndexQuery);
            resolve();
        }).nodeify(callback);
    },

    dropCollection: function (collectionName: string, scope?: string, callback?: CallbackFunction) {
        if (!scope) {
            scope = scopeName;
        }
        scope = scope || scopeName;
        return new Promise(async (resolve) => {
            await bucket.collections().dropCollection(collectionName, scope as string);
            await new Promise((res) => setTimeout(res, 1000));
            resolve();
        }).nodeify(callback);
    },

    addIndex(collectionName: string, indexName: string, columns: string[], scope?: string, callback?: CallbackFunction) {
        if (!scope) {
            scope = scopeName;
        }
        return new Promise(async (resolve) => {
            const indexQuery = `CREATE INDEX \`${indexName}\` ON \`${bucket.name}\`.\`${scope}\`.\`${collectionName}\`(${columns.join(', ')})`;
            await connection.query(indexQuery);
            resolve();
        }).nodeify(callback);
    },

    removeIndex(collectionName: string, indexName: string, scope?: string, callback?: CallbackFunction) {
        if (!scope) {
            scope = scopeName;
        }
        return new Promise(async (resolve) => {
            const indexQuery = `DROP INDEX \`${bucket.name}\`.\`${scope}\`.\`${collectionName}\`.\`${indexName}\``;
            await connection.query(indexQuery);
            resolve();
        }).nodeify(callback);
    },

    createScope(scopeName: string, callback?: CallbackFunction) {
        return new Promise(async (resolve) => {
            await bucket.collections().createScope(scopeName);
            await new Promise((res) => setTimeout(res, 1000));
            resolve();
        }).nodeify(callback);
    },

    dropScope(scopeName: string, callback?: CallbackFunction) {
        return new Promise(async (resolve) => {
            await bucket.collections().dropScope(scopeName);
            await new Promise((res) => setTimeout(res, 1000));
            resolve();
        }).nodeify(callback);
    }
});

Promise.promisifyAll(CouchbaseDriver);

exports.connect = async function (conf: CouchbaseConfig, intern?: InternalOptions, callback?: CallbackFunction) {
    config = conf;
    scopeName = config.scope || '_default';
    collectionName = config.collection || 'migrations';

    const host = config.host || process.env.HOST as string;
    const db = await Cluster.connect(host, { username: config.username, password: config.password });
    if (intern) {
        internals = intern;
    }

    if (callback) {
        callback(null, new CouchbaseDriver(db));
    }
};