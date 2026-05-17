import crypto from 'crypto';

export function checksumBuffer(buffer: Buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

export default { checksumBuffer };
