import { PDFDocument } from 'pdf-lib';

/**
 * Merges multiple PDF pages into a single PDF document
 * @param {Array<Buffer>} pages - Array of PDF page data
 * @returns {Promise<PDFDocument>} The merged PDF document
 */
export async function mergePdfPages(pages) {
    const outputPdf = await PDFDocument.create();

    for (const pageData of pages) {
        const page = await PDFDocument.load(pageData);
        const [firstDonorPage] = await outputPdf.copyPages(page, [0]);
        outputPdf.addPage(firstDonorPage);
    }

    return outputPdf;
}

/**
 * Saves a PDF document to a buffer
 * @param {PDFDocument} pdfDoc - The PDF document to save
 * @returns {Promise<Uint8Array>} The PDF data as a buffer
 */
export async function savePdf(pdfDoc) {
    return await pdfDoc.save();
}
