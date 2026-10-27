const sql = require('mssql');
require('dotenv').config();
const logger = require('./logger');

const buildConfig = () => {
    const instanceName = process.env.MSSQL_INSTANCE || undefined;
    const trustServerCertificate =
        (process.env.MSSQL_TRUST_SERVER_CERTIFICATE ?? process.env.MSSQL_TRUST_SERVER_CERT) === 'true';
    return {
        server: process.env.MSSQL_SERVER,
        port: instanceName ? undefined : Number(process.env.MSSQL_PORT) || 1433,
        database: process.env.MSSQL_DATABASE,
        user: process.env.MSSQL_USER,
        password: process.env.MSSQL_PASSWORD,
            pool: { max: 10, min: 2, idleTimeoutMillis: 30000 },
        options: {
            instanceName,
            encrypt: process.env.MSSQL_ENCRYPT !== 'false',
            trustServerCertificate,
        },
    };
};

let poolPromise = null;

const getPool = () => {
    if (!poolPromise) {
        poolPromise = new sql.ConnectionPool(buildConfig())
            .connect()
            .catch((error) => {
                poolPromise = null;
                throw error;
            });
    }
    return poolPromise;
};

const connectSql = async () => {
    try {
        await getPool();
        logger.info('sql.connected', { pid: process.pid, database: process.env.MSSQL_DATABASE });
    } catch (error) {
        logger.error('sql.connection_failed', { pid: process.pid, error });
        process.exit(1);
    }
};

const closePool = async () => {
    if (!poolPromise) return;
    const pool = await poolPromise;
    poolPromise = null;
    await pool.close();
};


const withTransaction = async (work) => {
    const pool = await getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
        const result = await work(tx);
        await tx.commit();
        return result;
    } catch (error) {
        try {
            await tx.rollback();
        } catch (rollbackError) {
            logger.error('sql.rollback_failed', { error: rollbackError?.message });
        }
        throw error;
    }
};

const createRequest = async (executor) => new sql.Request(executor || (await getPool()));

const toSqlDateTime = (value) => new Date(value).toISOString().slice(0, 23);

module.exports = {
    sql,
    getPool,
    connectSql,
    closePool,
    withTransaction,
    createRequest,
    toSqlDateTime,
};
