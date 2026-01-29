import prompt from 'prompt-sync';
import fetch from 'node-fetch';
import { PDFDocument } from 'pdf-lib';
import fs from 'fs';
import sanitize from 'sanitize-filename';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import md5 from 'md5';
import { spawn } from 'child_process';
import path from 'path';
import pLimit from 'p-limit';

import { fetchEncryptionKey, decryptFile } from './src/crypto.js';
import { getUserInfo, getBooks, getBookInfo, getBookResources } from './src/api.js';

const promptSync = prompt({ sigint: true });

const argv = yargs(hideBin(process.argv))
    .option('site', {
        describe: 'The site to download from, currently either bsmart or digibook24',
        type: 'string',
        default: null
    })
    .option('siteUrl', {
        describe: 'This overwrites the base url for the site, useful in case a new platform is added',
        type: 'string',
        default: null
    })
    .option('cookie', {
        describe: 'Input "_bsw_session_v1_production" cookie',
        type: 'string',
        default: null
    })
    .option('bookId', {
        describe: 'Book id',
        type: 'string',
        default: null
    })
    .option('downloadOnly', {
        describe: 'Downloads the pages as individual pdfs and will provide a command that can be used to merge them with pdftk',
        type: 'boolean',
        default: false
    })
    .option('pdftk', {
        describe: 'Downloads the pages as individual pdfs and merges them with pdftk',
        type: 'boolean',
        default: false
    })
    .option('pdftkPath', {
        describe: 'Path to pdftk executable',
        type: 'string',
        default: 'pdftk'
    })
    .option('checkMd5', {
        describe: 'Checks the md5 hash of the downloaded pages',
        type: 'boolean',
        default: false
    })
    .option('output', {
        describe: 'Output filename',
        type: 'string',
        default: null
    })
    .option('resources', {
        describe: 'Download resources of the book instrad of the book it self',
        type: 'boolean',
        default: false
    })
    .option('concurrency', {
        describe: 'Number of parallel downloads',
        type: 'number',
        default: 4
    })
    .help()
    .argv;

(async () => {
    if (argv.downloadOnly && argv.pdftk) {
        console.log("Can't use --download-only and --pdftk at the same time");
        return;
    }

    if ((argv.downloadOnly || argv.pdftk) && !fs.existsSync('temp')) {
        fs.mkdirSync('temp');
    }

    if ((argv.downloadOnly || argv.pdftk) && fs.readdirSync('temp').length > 0) {
        console.log("Files already in temp folder, please manually delete them if you want to download a new book");
        return;
    }

    let baseSite = argv.siteUrl;

    if (!baseSite) {
        let platform = argv.site;
        while (!platform) {
            platform = promptSync('Input site (bsmart or digibook24):');
            if (platform != 'bsmart' && platform != 'digibook24') {
                platform = null;
                console.log('Invalid site');
            }
        }

        baseSite = platform == 'bsmart' ? 'www.bsmart.it' : 'web.digibook24.com';
    }

    let cookie = argv.cookie;
    while (!cookie) {
        cookie = promptSync('Input "_bsw_session_v1_production" cookie:');
    }

    // Get user info with cookie to obtain auth_token
    let user;
    try {
        const cookieHeaders = { cookie: '_bsw_session_v1_production=' + cookie };
        const userResponse = await fetch(`https://${baseSite}/api/v5/user`, { headers: cookieHeaders });

        if (userResponse.status != 200) {
            console.log("Bad cookie");
            return;
        }

        user = await userResponse.json();
    } catch (error) {
        console.log("Error fetching user info:", error);
        return;
    }

    // Create headers object with auth_token for all subsequent API calls
    const headers = { "auth_token": user.auth_token };

    // Get books list
    let books;
    try {
        books = await getBooks(baseSite, headers);
    } catch (error) {
        console.log("Error fetching books:", error);
        return;
    }

    if (books.length == 0) {
        console.log('No books in your library!');
    } else {
        console.log("Book list:");
        console.table(books.map(book => ({ id: book.id, title: book.title })));
    }

    let bookId = argv.bookId;
    while (!bookId) {
        bookId = promptSync(`Please input book id${(books.length == 0 ? " manually" : "")}:`);
    }

    console.log(`Fetching book info`);

    // Get book info
    let book;
    try {
        book = await getBookInfo(baseSite, bookId, headers);
    } catch (error) {
        console.log(error.message);
        return;
    }

    // Get book resources
    let info;
    try {
        info = await getBookResources(baseSite, book, headers);
    } catch (error) {
        console.log("Error fetching book resources:", error);
        return;
    }

    const outputPdf = await PDFDocument.create();
    const writeAwaiting = [];
    const filenames = [];
    const outputname = argv.output || sanitize(book.id + " - " + book.title);

    let assets = info.map(e => e.assets).flat();

    console.log('Fetching encryption key');

    // Fetch encryption key once and store it
    let encryptionKey;
    try {
        encryptionKey = await fetchEncryptionKey();
    } catch (error) {
        console.log("Error fetching encryption key:", error);
        return;
    }

    if (argv.resources) {
        assets = assets.filter(e => e.use == "launch_file");
        if (!fs.existsSync(outputname)) {
            fs.mkdirSync(outputname);
        }
        console.log("Downloading resources");
    } else {
        assets = assets.filter(e => e.use == "page_pdf");
        console.log("Downloading pages");
    }

    // Set up concurrency limit
    const limit = pLimit(argv.concurrency);

    // Create download tasks with concurrency control
    const downloadTasks = assets.map((asset, i) =>
        limit(async () => {
            try {
                let data = await fetch(asset.url).then(res => res.buffer());
                if (asset.encrypted !== false) {
                    data = await decryptFile(data, encryptionKey);
                }
                if (argv.checkMd5 && md5(data) != asset.url) {
                    console.log(`\nMismatching md5 hash for asset ${i}: ${asset.url}`);
                }
                return data;
            } catch (e) {
                console.log(`\nError downloading asset ${i}: ${e.message}`);
                throw e;
            }
        })
    );

    // Process results in order to maintain page order
    for (let i = 0; i < assets.length; i++) {
        const asset = assets[i];
        let data;
        try {
            data = await downloadTasks[i];
        } catch (e) {
            // Error already logged in the task
            return;
        }

        process.stdout.write(`\rProgress ${((i + 1) / assets.length * 100).toFixed(2)}% (${i + 1}/${assets.length})`);

        if (argv.resources) {
            const filename = path.basename(asset.filename);
            await fs.promises.writeFile(`${outputname}/${filename}`, data);
        } else {
            if (argv.downloadOnly || argv.pdftk) {
                const filename = path.basename(asset.filename, '.pdf');
                const filePath = `temp/${filename}.pdf`;
                await fs.promises.writeFile(filePath, data);
                filenames.push(filePath);
            } else {
                const page = await PDFDocument.load(data);
                const [firstDonorPage] = await outputPdf.copyPages(page, [0]);
                outputPdf.addPage(firstDonorPage);
            }
        }
    }
    console.log(); // New line after progress bar

    if (argv.resources) {
        // do nothing
    } else if (!argv.downloadOnly && !argv.pdftk) {
        await fs.promises.writeFile(outputname + ".pdf", await outputPdf.save());
    } else {
        const pdftkCommand = `${argv.pdftkPath} ${filenames.join(' ')} cat output "${outputname}.pdf"`;
        console.log("Run this command to merge the pages with pdftk:");
        console.log(pdftkCommand);
        if (argv.pdftk) {
            console.log("Merging pages with pdftk");
            const pdftk = spawn(argv.pdftkPath, filenames.concat(['cat', 'output', outputname + ".pdf"]));
            pdftk.stdout.on('data', (data) => {
                console.log(`stdout: ${data}`);
            });
            pdftk.stderr.on('data', (data) => {
                console.log(`stderr: ${data}`);
            });
            pdftk.on('close', (code) => {
                console.log(`child process exited with code ${code}`);
                console.log("Done");
            });
        }
    }
    console.log("Done");
})();
