const prompt = require('prompt-sync')({sigint: true});
const PDFDocument = require('pdf-lib').PDFDocument;
const fs = require('fs');

(async () => {
    
    console.log("Merging pages");
    let files = fs.readdirSync('./temp');

    files = files.map(n => Number(n.substr(0, n.length-6)));

    files = files.sort((a, b) => a - b);

    //const outputPdf = await PDFDocument.create();
    let tmp = "pdftk";

    for (i = 0; i < files.length; i++) {
        console.log(`Merging ${i+1} of ${files.length}`);
        //const page = await PDFDocument.load(fs.readFileSync("./temp/" + files[i] + "-1.pdf"));
        //const [firstDonorPage] = await outputPdf.copyPages(page, [0]);
        //outputPdf.addPage(firstDonorPage);
        tmp += " " + files[i] + "-1.pdf"
    }

    tmp += " cat pog.pdf";

    console.log(tmp);

    //fs.writeFile(prompt("Input file name:") + ".pdf", await outputPdf.save(), (e)=>{});*/

    console.log("Saving . . .");

})();