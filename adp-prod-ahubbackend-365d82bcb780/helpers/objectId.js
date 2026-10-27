const crypto = require('crypto');
const PROCESS_UNIQUE = crypto.randomBytes(5);
let counter = crypto.randomInt(0xffffff);

const newObjectId = () => {
    const buffer = Buffer.alloc(12);
    buffer.writeUInt32BE(Math.floor(Date.now() / 1000), 0);
    PROCESS_UNIQUE.copy(buffer, 4);
    counter = (counter + 1) % 0xffffff;
    buffer.writeUIntBE(counter, 9, 3);
    return buffer.toString('hex');
};

const isObjectId = (value) => typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value);

const objectIdTime = (id) => new Date(parseInt(String(id).slice(0, 8), 16) * 1000);

module.exports = { newObjectId, isObjectId, objectIdTime };
