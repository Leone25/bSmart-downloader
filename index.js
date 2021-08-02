const prompt = require('prompt-sync')({sigint: true});
const fetch = require('node-fetch');
const aesjs = require('aes-js');
const PDFDocument = require('pdf-lib').PDFDocument;
const fs = require('fs');
// const md5 = require('md5');


let key = new Uint8Array([30, 0, 184, 152, 115, 19, 157, 33, 4, 237, 80, 26, 139, 248, 104, 155]);

async function downloadAndDecryptFile(url) { 
    
    return new Promise(async (resolve, reject) => {
        let file = await fetch(url, {method: "GET"}).then(res => res.buffer());

        //console.log(file);

        try {
            let start = file.indexOf("start")+6;
            let startEnd = file.indexOf("path", start)-1;

            let startPosition = file.slice(start, startEnd).reverse().reduce((a,c,i) => a+c*Math.pow(256,i));

            let firstPart = file.slice(256, startPosition);
            let secondPart = new Uint8Array(file.slice(startPosition));

            var aesCbc = new aesjs.ModeOfOperation.cbc(key, firstPart.slice(0, 16));
            var decryptedFirstPart = aesCbc.decrypt(firstPart.slice(16));

            // this mess is to fix what i belive to be a bug in the aes js module
            if (decryptedFirstPart.slice(decryptedFirstPart.length-16).every(e=>e==16)) {
                decryptedFirstPart = decryptedFirstPart.slice(0, decryptedFirstPart.length-16);
            }

            if (decryptedFirstPart.slice(decryptedFirstPart.length-15).every(e=>e==15)) {
                decryptedFirstPart = decryptedFirstPart.slice(0, decryptedFirstPart.length-15);
            }

            if (decryptedFirstPart.slice(decryptedFirstPart.length-14).every(e=>e==14)) {
                decryptedFirstPart = decryptedFirstPart.slice(0, decryptedFirstPart.length-14);
            }

            if (decryptedFirstPart.slice(decryptedFirstPart.length-13).every(e=>e==13)) {
                decryptedFirstPart = decryptedFirstPart.slice(0, decryptedFirstPart.length-13);
            }

            if (decryptedFirstPart.slice(decryptedFirstPart.length-12).every(e=>e==12)) {
                decryptedFirstPart = decryptedFirstPart.slice(0, decryptedFirstPart.length-12);
            }

            if (decryptedFirstPart.slice(decryptedFirstPart.length-11).every(e=>e==11)) {
                decryptedFirstPart = decryptedFirstPart.slice(0, decryptedFirstPart.length-11);
            }

            if (decryptedFirstPart.slice(decryptedFirstPart.length-10).every(e=>e==10)) {
                decryptedFirstPart = decryptedFirstPart.slice(0, decryptedFirstPart.length-10);
            }

            if (decryptedFirstPart.slice(decryptedFirstPart.length-9).every(e=>e==9)) {
                decryptedFirstPart = decryptedFirstPart.slice(0, decryptedFirstPart.length-9);
            }

            if (decryptedFirstPart.slice(decryptedFirstPart.length-8).every(e=>e==8)) {
                decryptedFirstPart = decryptedFirstPart.slice(0, decryptedFirstPart.length-8);
            }

            if (decryptedFirstPart.slice(decryptedFirstPart.length-7).every(e=>e==7)) {
                decryptedFirstPart = decryptedFirstPart.slice(0, decryptedFirstPart.length-7);
            }

            if (decryptedFirstPart.slice(decryptedFirstPart.length-6).every(e=>e==6)) {
                decryptedFirstPart = decryptedFirstPart.slice(0, decryptedFirstPart.length-6);
            }

            if (decryptedFirstPart.slice(decryptedFirstPart.length-5).every(e=>e==5)) {
                decryptedFirstPart = decryptedFirstPart.slice(0, decryptedFirstPart.length-5);
            }

            if (decryptedFirstPart.slice(decryptedFirstPart.length-4).every(e=>e==4)) {
                decryptedFirstPart = decryptedFirstPart.slice(0, decryptedFirstPart.length-4);
            }

            if (decryptedFirstPart.slice(decryptedFirstPart.length-3).every(e=>e==3)) {
                decryptedFirstPart = decryptedFirstPart.slice(0, decryptedFirstPart.length-3);
            }

            if (decryptedFirstPart.slice(decryptedFirstPart.length-2).every(e=>e==2)) {
                decryptedFirstPart = decryptedFirstPart.slice(0, decryptedFirstPart.length-2);
            }

            if (decryptedFirstPart[decryptedFirstPart.length-1] == 1) {
                decryptedFirstPart = decryptedFirstPart.slice(0, decryptedFirstPart.length-1);
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

(async () => {
    //

    let bookId = prompt("Input book id:");

    let headers = {"auth_token": prompt("Input auth_token:")};

    console.log("Gathering information");

    let title = await fetch(`https://www.bsmart.it/api/v6/books/by_book_id/${bookId}`, {method: "GET",headers}).then(res => res.json()).then(j => j.title);

    let info = [];
    let page = 1;
    while (true) {
        console.log(page);
        let tempInfo = await fetch(`https://api.bsmart.it/api/v5/books/${bookId}/1/resources?per_page=500&page=${page}`, {method: "GET",headers}).then(res => res.json());
        info = info.concat(tempInfo);
        if (tempInfo.length < 500) break;
        page++;
    }
    
    console.log("Downloading pages");

    const outputPdf = await PDFDocument.create()

    for (i = 0; i<info.length; i++) {
        for (j = 0; j<info[i].assets.length; j++) {

            console.log(`Progress ${(i/info.length*100).toFixed(2)}%`);

            if (info[i].assets[j].use != "page_pdf") continue;

            let pageData = await downloadAndDecryptFile(info[i].assets[j].url).catch((e) => {console.log("Error Downloading page", e, i, j, info[i].assets[j].url)});

            // if (md5(pageData) != info[i].assets[j].url) console.log("Missmatching md5 hash", i, j, info[i].assets[j].url)

            //fs.writeFile(`temp/${i}-${j}.pdf`, pageData, (e)=>{});

            const page = await PDFDocument.load(pageData);
            const [firstDonorPage] = await outputPdf.copyPages(page, [0]);
            outputPdf.addPage(firstDonorPage);

        }
    }

    //fs.writeFile(prompt("Input file name:") + ".pdf", await outputPdf.save(), (e)=>{});

    fs.writeFile(title + ".pdf", await outputPdf.save(), (e)=>{});

    console.log("Saving . . .");

})();

/*(async ()=> {
    fs.writeFile("test.pdf", await downloadAndDecryptFile("https://s3-eu-west-1.amazonaws.com/dea.bsmart.it/0/9/092662be7c3701b1c596057205fc8a7e"), (e)=>{});
})()*/
