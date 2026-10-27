const argValue = (name) => {
    const index = process.argv.indexOf(name);
    return index > -1 ? process.argv[index + 1] : undefined;
};

const mongoDatabaseName = (uri = '') => {
    const afterHosts = String(uri).replace(/^mongodb(\+srv)?:\/\/[^/]*\/?/, '');
    return afterHosts.split(/[/?]/)[0] || 'test';
};

const confirmTarget = (database, action, where) => {
    if (!database) {
        console.error(
            `Cannot tell which ${where} database this would change (not set in .env). Nothing was done.`,
        );
        process.exitCode = 1;
        return false;
    }
    if (argValue('--confirm') === database) return true;
    console.error(`This will ${action} in ${where} database "${database}".`);
    console.error('Nothing was done. If that is really what you want, run the same command again and add:');
    console.error(`  --confirm ${database}`);
    process.exitCode = 1;
    return false;
};

module.exports = { confirmTarget, mongoDatabaseName, argValue };
