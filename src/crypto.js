import fetch from 'node-fetch';
import msgpack from 'msgpack-lite';
import aesjs from 'aes-js';

/**
 * Fetches the encryption key from the bSmart website
 * @returns {Promise<Buffer>} The encryption key
 */
export async function fetchEncryptionKey() {
    const page = await fetch('https://my.bsmart.it/');
    const text = await page.text();

    const scripts = [...text.matchAll(/<script[^>]+src="([^"]+\.js[^"]*)"[^>]*>/g)]
        .map(match => match[1])
        .filter(src => src.startsWith('/'));

    if (scripts.length === 0) {
        throw new Error('Unable to extract the bSmart encryption key from the current website bundles., because no JavaScript bundles were found on https://my.bsmart.it/');
    }

    for (const script of scripts) {
        const scriptText = await fetch('https://my.bsmart.it' + script).then(res => res.text());
        const constructorMatch = scriptText.match(
            /var\s+([A-Za-z_$][\w$]*)=String\.fromCharCode\(([^)]*)\),([A-Za-z_$][\w$]*)=["']constructor["'];\3\[\3\]\[\3\]\((.*?)\)\(\)/s
        );
        if (!constructorMatch) continue;

        const [, charVar, charCodes, , expression] = constructorMatch;
        const sourceCharacters = charCodes
            .split(',')
            .map(e => parseInt(e.trim(), 10))
            .map(e => String.fromCharCode(e));
        const indexPattern = new RegExp(`${charVar}\\[(\\d+)\\]`, 'g');
        const indexes = [...expression.matchAll(indexPattern)].map(match => parseInt(match[1], 10));
        if (indexes.length === 0) {
            continue;
        }

        const snippet = indexes.map(index => sourceCharacters[index]).join('');
        const keyMatch = snippet.match(/['"]((?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?)['"]/);
        return keyMatch ? Buffer.from(keyMatch[1], 'base64') : null;
    }

    throw new Error('Unable to extract the bSmart encryption key from the current website bundles.');
}

/**
 * Decrypts an encrypted file using the provided encryption key
 * @param {Buffer} file - The encrypted file data
 * @param {Buffer} key - The encryption key
 * @returns {Promise<Uint8Array>} The decrypted file data
 */
export async function decryptFile(file, key) {
    return new Promise((resolve, reject) => {
        try {
            const header = msgpack.decode(file.slice(0, 256));

            const firstPart = file.slice(256, header.start);
            const secondPart = new Uint8Array(file.slice(header.start));

            const aesCbc = new aesjs.ModeOfOperation.cbc(key, firstPart.slice(0, 16));
            let decryptedFirstPart = aesCbc.decrypt(firstPart.slice(16));

            for (let i = 16; i > 0; i--) {
                if (decryptedFirstPart.slice(decryptedFirstPart.length - i).every(e => e == i)) {
                    decryptedFirstPart = decryptedFirstPart.slice(0, decryptedFirstPart.length - i);
                    break;
                }
            }

            const result = new Uint8Array(decryptedFirstPart.length + secondPart.length);
            result.set(decryptedFirstPart);
            result.set(secondPart, decryptedFirstPart.length);
            resolve(result);
        } catch (e) {
            reject({ e, file });
        }
    });
}
