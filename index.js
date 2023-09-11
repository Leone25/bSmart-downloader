const prompt = require('prompt-sync')({sigint: true});
const fetch = require('node-fetch');
const msgpack = require('msgpack-lite');
const aesjs = require('aes-js');
const PDFDocument = require('pdf-lib').PDFDocument;
const fs = require('fs');
const sanitize = require("sanitize-filename");
const yargs = require('yargs/yargs');
const md5 = require('md5');
const { spawn } = require('child_process');

const argv = yargs(process.argv.slice(2))
    .option('cookie', {
        describe: 'Input "_bsw_session_v1_production" cookie',
        type: 'string',
        default: null
    })
    .option('book-id', {
        describe: 'Book id',
        type: 'string',
        default: null
    })
    .option('download-only', {
        describe: 'Downloads the pages as individual pdfs and will provide a command that can be used to merge them with pdftk',
        type: 'boolean',
        default: false
    })
    .option('pdftk', {
        describe: 'Downloads the pages as individual pdfs and merges them with pdftk',
        type: 'boolean',
        default: false
    })
    .option('pdftk-path', {
        describe: 'Path to pdftk executable',
        type: 'string',
        default: 'pdftk'
    })
    .option('check-md5', {
        describe: 'Checks the md5 hash of the downloaded pages',
        type: 'boolean',
        default: false
    })
    .option('output-filename', {
        describe: 'Output filename',
        type: 'string',
        default: null
    })
    .help()
    .argv;


let key = new Uint8Array([30, 0, 184, 152, 115, 19, 157, 33, 4, 237, 80, 26, 139, 248, 104, 155]);

async function downloadAndDecryptFile(url) { 
    
    return new Promise(async (resolve, reject) => {
        let file = await fetch(url, {method: "GET"}).then(res => res.buffer());

        try {
            let header = msgpack.decode(file.slice(0, 256));

            let firstPart = file.slice(256, header.start);
            let secondPart = new Uint8Array(file.slice(header.start));

            var aesCbc = new aesjs.ModeOfOperation.cbc(key, firstPart.slice(0, 16));
            var decryptedFirstPart = aesCbc.decrypt(firstPart.slice(16));

            for(let i=16;i>0;i--){
                if (decryptedFirstPart.slice(decryptedFirstPart.length-i).every(e=>e==i)) {
                    decryptedFirstPart = decryptedFirstPart.slice(0, decryptedFirstPart.length-i);
                    break;
                }
            }

            let result = new Uint8Array(decryptedFirstPart.length + secondPart.length);
            result.set(decryptedFirstPart);
            result.set(secondPart, decryptedFirstPart.length);
            resolve(result);
        } catch (e) {
            reject({e, file})
        }
        
    });
    

}

var vaiAncora = true;

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

    let cookie = argv.cookie;
    while (!cookie) {
        cookie = prompt('Input "_bsw_session_v1_production" cookie:');
    }

    let user = await fetch("https://www.bsmart.it/api/v5/user", {headers: {cookie:'_bsw_session_v1_production='+cookie}});

    if (user.status != 200) {
        console.log("Bad cookie");
        return;
    }

    user = await user.json();

    let headers = {"auth_token": user.auth_token};

    let books = await fetch(`https://www.bsmart.it/api/v6/books?page_thumb_size=medium&per_page=25000`, {headers}).then(res => res.json());

    let preactivations = await fetch(`https://www.bsmart.it/api/v5/books/preactivations`, {headers}).then(res => res.json());

    let bookFound = true;

    while(vaiAncora){
        preactivations.forEach(preactivation => {
            if (preactivation.no_bsmart === false) {
                books.push(...preactivation.books);
            }
        });

        if (books.length == 0) {
            console.log('No books in your library!');
        } else {
            console.log("Book list:");
            console.table(books.map(book => ({ id: book.id, title: book.title })))
        }
        
        let bookId = argv.bookId;
    
        while (!bookId) {
            bookId = prompt(`Please input book id${(books.length == 0 ? " manually" : "")}:`);
        }

        let book = await fetch(`https://www.bsmart.it/api/v6/books/by_book_id/${bookId}`, {headers});

        if(book.status == 404){
            console.log("Book not found");
            bookFound = false;
        }

        if (book.status != 200) {
            console.log("Error during the request");
            bookFound = false;
        }
        
        if(bookFound){
            book = await book.json();

            let info = [];
            let page = 1;
            while (true) {
                //console.log(page);
                let tempInfo = await fetch(`https://api.bsmart.it/api/v5/books/${book.id}/${book.current_edition.revision}/resources?per_page=500&page=${page}`, {headers}).then(res => res.json());
                info = info.concat(tempInfo);
                if (tempInfo.length < 500) break;
                page++;
            }
            
            console.log("Downloading pages");
    
            const outputPdf = await PDFDocument.create();
    
            const writeAwaitng = [];
    
            const filenames = [];
    
            for (i = 0; i<info.length; i++) {
                for (j = 0; j<info[i].assets.length; j++) {
    
                    console.log(`Progress ${(i/info.length*100).toFixed(2)}%`);
    
                    if (info[i].assets[j].use != "page_pdf") continue;
    
                    let pageData = await downloadAndDecryptFile(info[i].assets[j].url).catch((e) => {console.log("Error Downloading page", e, i, j, info[i].assets[j].url)});
    
                    if (argv.checkMd5 && md5(pageData) != info[i].assets[j].url) console.log("Missmatching md5 hash", i, j, info[i].assets[j].url)
    
                    if (argv.downloadOnly || argv.pdftk) {
                        writeAwaitng.push(fs.promises.writeFile(`temp/${i}-${j}.pdf`, pageData, (e)=>{}));
                        filenames.push(`temp/${i}-${j}.pdf`);
                    } else {
                        const page = await PDFDocument.load(pageData);
                        const [firstDonorPage] = await outputPdf.copyPages(page, [0]);
                        outputPdf.addPage(firstDonorPage);
                    }
                }
            }
    
            await Promise.all(writeAwaitng);
    
            if (!argv.downloadOnly && !argv.pdftk) await fs.promises.writeFile(argv.outputFilename || sanitize(book.id + " - " + book.title + ".pdf"), await outputPdf.save());
    
            if (argv.downloadOnly || argv.pdftk) {
                let pdftkCommand = `${argv.pdftkPath} ${filenames.join(' ')} cat output "${argv.outputFilename || sanitize(book.id + " - " + book.title + ".pdf")}"`;
                console.log("Run this command to merge the pages with pdftk:");
                console.log(pdftkCommand);
            }
            if (argv.pdftk) {
                console.log("Merging pages with pdftk");
                let pdftk = spawn(argv.pdftkPath, filenames.concat(['cat', 'output', argv.outputFilename || sanitize(book.id + " - " + book.title + ".pdf")]));
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
            } else {
                console.log("Done");
            }
        }
       
        vaiAncora = prompt("Vuoi scaricare altri libri?(Si: true, No: false):");
    }
})();

/*(async ()=> {
    fs.writeFile("test.pdf", await downloadAndDecryptFile("https://s3-eu-west-1.amazonaws.com/dea.bsmart.it/0/9/092662be7c3701b1c596057205fc8a7e"), (e)=>{});
})()*/
