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
    const script = text.match(/<script src="(\/scripts\/.*.min.js)">/)[1];
    const scriptText = await fetch('https://my.bsmart.it' + script).then(res => res.text());
    let keyScript = scriptText.slice(scriptText.indexOf('var i=String.fromCharCode'));
    keyScript = keyScript.slice(0, keyScript.indexOf('()'));
    const sourceCharacters = keyScript.match(/var i=String.fromCharCode\((((\d+),)+(\d+))\)/)[1].split(',').map(e => parseInt(e)).map(e => String.fromCharCode(e));
    const map = keyScript.match(/i\[\d+\]/g).map(e => parseInt(e.slice(2, -1)));
    const snippet = map.map(e => sourceCharacters[e]).join('');
    const key = Buffer.from(snippet.match(/'((?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?)'/)[1], 'base64');
    return key;
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
