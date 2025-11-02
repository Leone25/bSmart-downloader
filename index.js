const prompt = require("prompt-sync")({ sigint: true });
const fetch = require("node-fetch");
const msgpack = require("msgpack-lite");
const aesjs = require("aes-js");
const PDFDocument = require("pdf-lib").PDFDocument;
const fs = require("fs");
const sanitize = require("sanitize-filename");
const yargs = require("yargs/yargs");
const md5 = require("md5");
const { spawn } = require("child_process");
const path = require("path");

const argv = yargs(process.argv.slice(2))
  .option("site", {
    describe:
      "The site to download from, currently either bsmart or digibook24",
    type: "string",
    default: null,
  })
  .option("siteUrl", {
    describe:
      "This overwrites the base url for the site, useful in case a new platform is added",
    type: "string",
    default: null,
  })
  .option("cookie", {
    describe: 'Input "_bsw_session_v1_production" cookie',
    type: "string",
    default: null,
  })
  .option("bookId", {
    describe: "Book id",
    type: "string",
    default: null,
  })
  .option("downloadOnly", {
    describe:
      "Downloads the pages as individual pdfs and will provide a command that can be used to merge them with pdftk",
    type: "boolean",
    default: false,
  })
  .option("pdftk", {
    describe:
      "Downloads the pages as individual pdfs and merges them with pdftk",
    type: "boolean",
    default: false,
  })
  .option("pdftkPath", {
    describe: "Path to pdftk executable",
    type: "string",
    default: "pdftk",
  })
  .option("checkMd5", {
    describe: "Checks the md5 hash of the downloaded pages",
    type: "boolean",
    default: false,
  })
  .option("output", {
    describe: "Output filename",
    type: "string",
    default: null,
  })
  .option("resources", {
    describe: "Download resources of the book instrad of the book it self",
    type: "boolean",
    default: false,
  })
  .option("listOnly", {
    describe: "Only list available books in JSON format and exit",
    type: "boolean",
    default: false,
  })
  .help().argv;

let key = null;

// Retry function for network requests
async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response;
    } catch (error) {
      const isLastAttempt = attempt === maxRetries;
      const isNetworkError =
        error.code === "ECONNREFUSED" ||
        error.code === "ETIMEDOUT" ||
        error.code === "ENOTFOUND" ||
        error.type === "system";

      if (isNetworkError && !isLastAttempt) {
        const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // exponential backoff, max 5s
        console.log(
          `Network error on attempt ${attempt}/${maxRetries}, retrying in ${waitTime}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        continue;
      }

      throw error;
    }
  }
}

async function decryptFile(file) {
  return new Promise(async (resolve, reject) => {
    try {
      let header = msgpack.decode(file.slice(0, 256));

      let firstPart = file.slice(256, header.start);
      let secondPart = new Uint8Array(file.slice(header.start));

      var aesCbc = new aesjs.ModeOfOperation.cbc(key, firstPart.slice(0, 16));
      var decryptedFirstPart = aesCbc.decrypt(firstPart.slice(16));

      for (let i = 16; i > 0; i--) {
        if (
          decryptedFirstPart
            .slice(decryptedFirstPart.length - i)
            .every((e) => e == i)
        ) {
          decryptedFirstPart = decryptedFirstPart.slice(
            0,
            decryptedFirstPart.length - i
          );
          break;
        }
      }

      let result = new Uint8Array(
        decryptedFirstPart.length + secondPart.length
      );
      result.set(decryptedFirstPart);
      result.set(secondPart, decryptedFirstPart.length);
      resolve(result);
    } catch (e) {
      reject({ e, file });
    }
  });
}

async function fetchEncryptionKey() {
  let page = await fetchWithRetry("https://my.bsmart.it/");
  let text = await page.text();
  let script = text.match(/<script src="(\/scripts\/.*.min.js)">/)[1];
  let scriptText = await fetchWithRetry("https://my.bsmart.it" + script).then(
    (res) => res.text()
  );
  let keyScript = scriptText.slice(
    scriptText.indexOf("var i=String.fromCharCode")
  );
  keyScript = keyScript.slice(0, keyScript.indexOf("()"));
  let sourceCharacters = keyScript
    .match(/var i=String.fromCharCode\((((\d+),)+(\d+))\)/)[1]
    .split(",")
    .map((e) => parseInt(e))
    .map((e) => String.fromCharCode(e));
  let map = keyScript.match(/i\[\d+\]/g).map((e) => parseInt(e.slice(2, -1)));
  let snippet = map.map((e) => sourceCharacters[e]).join("");
  key = Buffer.from(
    snippet.match(
      /'((?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?)'/
    )[1],
    "base64"
  );
}

(async () => {
  if (argv.downloadOnly && argv.pdftk) {
    console.log("Can't use --download-only and --pdftk at the same time");
    return;
  }

  if ((argv.downloadOnly || argv.pdftk) && !fs.existsSync("temp")) {
    fs.mkdirSync("temp");
  }

  if ((argv.downloadOnly || argv.pdftk) && fs.readdirSync("temp").length > 0) {
    console.log(
      "Files already in temp folder, please manually delete them if you want to download a new book"
    );
    return;
  }

  let baseSite = argv.siteUrl;

  if (!baseSite) {
    let platform = argv.site;
    while (!platform) {
      platform = prompt("Input site (bsmart or digibook24):");
      if (platform != "bsmart" && platform != "digibook24") {
        platform = null;
        console.log("Invalid site");
      }
    }

    baseSite = platform == "bsmart" ? "www.bsmart.it" : "web.digibook24.com";
  }

  let cookie = argv.cookie;
  while (!cookie) {
    cookie = prompt('Input "_bsw_session_v1_production" cookie:');
  }

  let user = await fetchWithRetry(`https://${baseSite}/api/v5/user`, {
    headers: { cookie: "_bsw_session_v1_production=" + cookie },
  });

  if (user.status != 200) {
    console.log("Bad cookie");
    return;
  }

  user = await user.json();

  let headers = { auth_token: user.auth_token };

  let books = await fetchWithRetry(
    `https://${baseSite}/api/v6/books?page_thumb_size=medium&per_page=25000`,
    { headers }
  ).then((res) => res.json());

  let preactivations = await fetchWithRetry(
    `https://${baseSite}/api/v5/books/preactivations`,
    { headers }
  ).then((res) => res.json());

  preactivations.forEach((preactivation) => {
    if (preactivation.no_bsmart === false) {
      books.push(...preactivation.books);
    }
  });

  // If listOnly flag is set, output JSON and exit
  if (argv.listOnly) {
    console.log(
      JSON.stringify(books.map((book) => ({ id: book.id, title: book.title })))
    );
    return;
  }

  if (books.length == 0) {
    console.log("No books in your library!");
  } else {
    console.log("Book list:");
    console.table(books.map((book) => ({ id: book.id, title: book.title })));
  }

  let bookId = argv.bookId;
  while (!bookId) {
    bookId = prompt(
      `Please input book id${books.length == 0 ? " manually" : ""}:`
    );
  }

  console.log(`Fetching book info`);

  let book = await fetchWithRetry(
    `https://${baseSite}/api/v6/books/by_book_id/${bookId}`,
    { headers }
  );

  if (book.status != 200) {
    console.log("Invalid book id");
    return;
  }

  book = await book.json();

  let info = [];
  let page = 1;
  while (true) {
    //console.log(page);
    let tempInfo = await fetchWithRetry(
      `https://${baseSite}/api/v5/books/${book.id}/${book.current_edition.revision}/resources?per_page=500&page=${page}`,
      { headers }
    ).then((res) => res.json());
    info = info.concat(tempInfo);
    if (tempInfo.length < 500) break;
    page++;
  }

  const outputPdf = await PDFDocument.create();

  const writeAwaitng = [];

  const filenames = [];

  const outputDir = process.env.OUTPUT_DIR || ".";
  const outputname = argv.output || sanitize(book.id + " - " + book.title);
  const outputPath = `${outputDir}/${outputname}`;

  let assets = info.map((e) => e.assets).flat();

  console.log("Fetching encryption key");

  await fetchEncryptionKey();

  if (argv.resources) {
    assets = assets.filter((e) => e.use == "launch_file");
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
    }
    console.log("Downloading resources");
  } else {
    assets = assets.filter((e) => e.use == "page_pdf");
    console.log("Downloading pages");
  }

  for (let i = 0; i < assets.length; i++) {
    console.log(
      `Progress ${((i / assets.length) * 100).toFixed(2)}% (${i + 1}/${
        assets.length
      })`
    );

    let asset = assets[i];

    if (argv.resources) {
      let resourceData = await fetchWithRetry(asset.url).then((res) =>
        res.buffer()
      );
      if (asset.encrypted !== false)
        resourceData = await decryptFile(resourceData).catch((e) => {
          console.log("Error Downloading resource", e, i, asset);
        }); // some resources don't say they aren't encrypted but they are
      if (argv.checkMd5 && md5(resourceData) != asset.url)
        console.log("Missmatching md5 hash", i, asset.url);
      let filename = path.basename(asset.filename);
      writeAwaitng.push(
        fs.promises.writeFile(
          `${outputPath}/${filename}`,
          resourceData,
          (e) => {}
        )
      );
    } else {
      let pageData = await fetchWithRetry(asset.url).then((res) =>
        res.buffer()
      );
      pageData = await decryptFile(pageData).catch((e) => {
        console.log("Error Downloading page", e, i, asset);
      });

      if (argv.checkMd5 && md5(pageData) != asset.url)
        console.log("Missmatching md5 hash", i, asset.url);

      if (argv.downloadOnly || argv.pdftk) {
        let filename = path.basename(asset[i].filename, ".pdf");
        writeAwaitng.push(
          fs.promises.writeFile(`temp/${filename}.pdf`, pageData, (e) => {})
        );
        filenames.push(`temp/${filename}.pdf`);
      } else {
        const page = await PDFDocument.load(pageData);
        const [firstDonorPage] = await outputPdf.copyPages(page, [0]);
        outputPdf.addPage(firstDonorPage);
      }
    }
  }

  await Promise.all(writeAwaitng);

  if (argv.resources) {
  }
  if (!argv.downloadOnly && !argv.pdftk)
    await fs.promises.writeFile(outputPath + ".pdf", await outputPdf.save());
  else {
    let pdftkCommand = `${argv.pdftkPath} ${filenames.join(
      " "
    )} cat output "${outputPath}.pdf"`;
    console.log("Run this command to merge the pages with pdftk:");
    console.log(pdftkCommand);
    if (argv.pdftk) {
      console.log("Merging pages with pdftk");
      let pdftk = spawn(
        argv.pdftkPath,
        filenames.concat(["cat", "output", outputPath + ".pdf"])
      );
      pdftk.stdout.on("data", (data) => {
        console.log(`stdout: ${data}`);
      });
      pdftk.stderr.on("data", (data) => {
        console.log(`stderr: ${data}`);
      });
      pdftk.on("close", (code) => {
        console.log(`child process exited with code ${code}`);
        console.log("Done");
      });
    }
  }
  console.log("Done");
})();
